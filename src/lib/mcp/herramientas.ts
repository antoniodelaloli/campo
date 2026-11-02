import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextoAgente } from "@/lib/mcp/auth";
import {
  cargarContadores,
  cargarFincas,
  cargarHitos,
  cargarIncidenciasAbiertas,
  cargarTareasAbiertas,
  cargarTratamientos,
  lugarDeTarea,
  ultimaLectura,
  ultimoNivel,
  type Finca,
} from "@/lib/datos";
import { previsionFincas, RACHA_MAX_KMH, VIENTO_MAX_KMH } from "@/lib/alertas-tiempo";
import { construirAgenda, cuentaAtras, NOMBRE_TIPO_HITO, TIPOS_HITO } from "@/lib/agenda";
import { esFechaISO, hoyISO, normalizar, sumarDias } from "@/lib/texto";

// Herramientas del conector de Campo para ChatGPT y Claude.
// Todas trabajan con el cliente de Supabase del usuario que inició sesión:
// RLS decide lo que puede ver y apuntar, igual que en la web.
// Lo que se apunta queda con origen = 'conector' y a su nombre.

const ORIGEN = "conector";

export const INSTRUCCIONES = `Campo es la app interna de las fincas de limoneros de la familia (Valladolises, Corvera y Lobosillo, en Murcia).
Cómo usar estas herramientas:
- Habla en español, claro y breve: quien pregunta es agricultor, no informático. Usa los nombres de las fincas y zonas tal como los dice él.
- Para saber qué pasa hoy, empieza por «resumen_del_dia».
- ANTES de apuntar nada (tareas, niveles, lecturas, fechas clave, incidencias, notas), repite en una frase lo que vas a guardar y espera a que diga que sí. La única excepción son las ideas (ver abajo).
- Si un sitio es ambiguo (por ejemplo «el sector 2», que existe en dos fincas), pregunta cuál, o usa «buscar_lugar».
- Las fechas van en formato AAAA-MM-DD y en hora de España. «Hoy» es la fecha que devuelve resumen_del_dia.
- No inventes datos: si algo no está en Campo, dilo («eso no está apuntado»).
- Nada se borra: si algo está mal, se marca como anulado o se corrige apuntándolo de nuevo.
- IDEAS: está atento a lo que cuenta aunque divague. Si suelta una idea, reflexión, duda, plan o algo aprendido sobre el campo que merezca la pena recordar (sin fecha ni trabajo concreto), guárdala tú con «apuntar_idea» SIN preguntar y con detectada=true; al final de tu respuesta dile en una línea «📝 Apuntado en la libreta de ideas: …». No guardes saludos, quejas sueltas ni cosas que ya estén apuntadas (si dudas, mira «buscar_ideas»). Si es una tarea o una fecha, eso sí pregúntalo antes. Solo lo del campo: nada personal ni familiar.
- Si preguntan qué día se puede fumigar, si hace viento o si va a granizar, usa «tiempo_para_fumigar». Con viento no se fumiga: el caldo se lo lleva el aire. Si van a apuntar un tratamiento para un día con viento, avísalo antes de guardarlo.`;

type Resultado = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(datos: unknown): Resultado {
  return { content: [{ type: "text", text: typeof datos === "string" ? datos : JSON.stringify(datos, null, 1) }] };
}

function fallo(mensaje: string): Resultado {
  return { content: [{ type: "text", text: mensaje }], isError: true };
}

const LECTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const ESCRITURA = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
  .refine(esFechaISO, "Fecha no válida");

/** Busca una finca por nombre o alias. */
function buscarFinca(fincas: Finca[], texto: string | undefined) {
  if (!texto) return { finca: null as Finca | null, error: null as string | null };
  const t = normalizar(texto);
  const coinciden = fincas.filter(
    (f) => normalizar(f.nombre).includes(t) || t.includes(normalizar(f.nombre)) || f.alias.some((a) => normalizar(a) === t),
  );
  if (coinciden.length === 1) return { finca: coinciden[0], error: null };
  if (coinciden.length === 0)
    return { finca: null, error: `No hay ninguna finca «${texto}». Fincas: ${fincas.map((f) => f.nombre).join(", ")}.` };
  return { finca: null, error: `«${texto}» puede ser ${coinciden.map((f) => f.nombre).join(" o ")}: ¿cuál?` };
}

type FilaLugar = { tipo: "finca" | "zona" | "sector"; id: string; finca_id: string; nombre: string; coincidencia?: string };

async function resolverLugar(supabase: SupabaseClient, texto: string) {
  const { data, error } = await supabase.rpc("resolver_ubicacion", { q: texto });
  if (error) return { filas: [] as FilaLugar[], error: error.message };
  return { filas: (data ?? []) as FilaLugar[], error: null };
}

function sinPermiso(ctx: ContextoAgente): Resultado | null {
  return ctx.puedeEditar
    ? null
    : fallo("Tu usuario de Campo solo puede consultar, no apuntar. Pide a Antonio que te dé permiso de editor.");
}

function porcentaje(nivel: number | null, tope: number | null) {
  return nivel != null && tope ? Math.round((nivel / tope) * 100) : null;
}

export function registrarHerramientas(server: McpServer, ctx: ContextoAgente) {
  const { supabase } = ctx;

  // ------------------------------------------------------------------
  // Consultas
  // ------------------------------------------------------------------
  server.registerTool(
    "resumen_del_dia",
    {
      title: "Resumen del día",
      description:
        "Lo que hay hoy en las fincas: fecha de hoy, fechas clave próximas y atrasadas, tareas abiertas, nivel de los pantanos, avisos abiertos y tratamientos en curso. Úsala primero para cualquier pregunta general («¿qué tengo hoy?», «¿cómo va todo?»).",
      annotations: LECTURA,
    },
    async () => {
      const hoy = hoyISO();
      const [{ fincas }, { hitos }, { tareas }, incidencias, { tratamientos }] = await Promise.all([
        cargarFincas(supabase),
        cargarHitos(supabase, sumarDias(hoy, 14)),
        cargarTareasAbiertas(supabase),
        cargarIncidenciasAbiertas(supabase),
        cargarTratamientos(supabase),
      ]);
      const agenda = construirAgenda({ hitos, tratamientos, hoy, hasta: sumarDias(hoy, 14) });
      const fecha = (e: { fecha: string | null; aproximada: boolean }) =>
        e.fecha ? `${e.fecha} (${cuentaAtras(e.fecha, hoy, e.aproximada).texto})` : "sin fecha";
      return ok({
        hoy,
        usuario: ctx.nombre,
        fechas_clave_atrasadas: agenda.atrasados.map((e) => ({ titulo: e.titulo, finca: e.finca, fecha: fecha(e), id: e.hitoId })),
        fechas_clave_proximas_14_dias: agenda.proximos.map((e) => ({
          titulo: e.titulo,
          tipo: e.etiqueta,
          finca: e.finca,
          fecha: fecha(e),
          detalle: e.detalle,
          id: e.hitoId,
        })),
        tareas_abiertas: tareas.slice(0, 15).map((t) => ({
          id: t.id,
          titulo: t.titulo,
          estado: t.estado,
          fecha: t.fecha_prevista,
          donde: lugarDeTarea(t),
          quien: t.tareas_personas.map((p) => p.personas?.nombre).filter(Boolean),
        })),
        pantanos: fincas.flatMap((f) =>
          f.pantanos.map((p) => {
            const n = ultimoNivel(p);
            const tope = Number(p.capacidad_util_m3 ?? p.capacidad_m3 ?? 0) || null;
            return {
              finca: f.nombre,
              pantano: p.nombre,
              ultimo_nivel_m3: n?.nivel_m3 ?? null,
              porcentaje: porcentaje(n?.nivel_m3 ?? null, tope),
              fecha_nivel: n?.fecha ?? null,
            };
          }),
        ),
        avisos_abiertos: incidencias.map((i) => ({ finca: i.fincas?.nombre, titulo: i.titulo, tipo: i.tipo, desde: i.fecha })),
        tratamientos_en_curso: tratamientos
          .filter((t) => t.estado === "en_curso")
          .map((t) => ({ finca: t.fincas?.nombre, desde: t.fecha, objetivo: t.objetivo })),
      });
    },
  );

  server.registerTool(
    "fechas_clave",
    {
      title: "Fechas clave",
      description:
        "Fechas clave pendientes (cortes, tratamientos, plazos de papeles, agua…) de aquí a N días, más las atrasadas y el fin de los plazos de seguridad. Cada una lleva su id para marcarla como hecha.",
      inputSchema: { dias: z.number().int().min(1).max(400).default(90).describe("Cuántos días hacia delante (90 por defecto)") },
      annotations: LECTURA,
    },
    async ({ dias }) => {
      const hoy = hoyISO();
      const hasta = sumarDias(hoy, dias);
      const [{ hitos, falta }, { tratamientos }] = await Promise.all([cargarHitos(supabase, hasta), cargarTratamientos(supabase)]);
      if (falta) return fallo("La tabla de fechas clave aún no existe en Campo.");
      const agenda = construirAgenda({ hitos, tratamientos, hoy, hasta });
      const fila = (e: (typeof agenda.proximos)[number]) => ({
        id: e.hitoId ?? null,
        titulo: e.titulo,
        tipo: e.etiqueta,
        finca: e.finca,
        fecha: e.fecha,
        aproximada: e.aproximada,
        cuenta_atras: e.fecha ? cuentaAtras(e.fecha, hoy, e.aproximada).texto : null,
        detalle: e.detalle,
        tareas: e.tareas,
      });
      return ok({
        hoy,
        atrasadas: agenda.atrasados.map(fila),
        proximas: agenda.proximos.map(fila),
        por_confirmar: agenda.porConfirmar.map((e) => ({ titulo: e.titulo, detalle: e.detalle, finca: e.finca })),
      });
    },
  );

  server.registerTool(
    "tareas",
    {
      title: "Tareas abiertas",
      description: "Tareas sin terminar (previstas, en curso o aplazadas), con dónde, cuándo y quién. Se puede filtrar por finca.",
      inputSchema: { finca: z.string().optional().describe("Nombre de la finca (opcional)") },
      annotations: LECTURA,
    },
    async ({ finca }) => {
      const [{ fincas }, { tareas, error }] = await Promise.all([cargarFincas(supabase), cargarTareasAbiertas(supabase)]);
      if (error) return fallo(`No se pudieron leer las tareas: ${error}`);
      const { finca: f, error: errorFinca } = buscarFinca(fincas, finca);
      if (errorFinca) return fallo(errorFinca);
      const lista = f ? tareas.filter((t) => t.finca_id === f.id) : tareas;
      return ok(
        lista.map((t) => ({
          id: t.id,
          titulo: t.titulo,
          descripcion: t.descripcion,
          tipo: t.tipo,
          estado: t.estado,
          prioridad: t.prioridad,
          fecha_prevista: t.fecha_prevista,
          donde: lugarDeTarea(t),
          quien: t.tareas_personas.map((p) => p.personas?.nombre).filter(Boolean),
          fecha_clave: t.hitos?.titulo ?? null,
        })),
      );
    },
  );

  server.registerTool(
    "agua",
    {
      title: "Agua: pantanos y contadores",
      description:
        "Estado del agua por finca: capacidad y último nivel de cada pantano, y cada contador con sus últimas lecturas (y el consumo entre ellas). Úsala para «¿cuánta agua queda?» o antes de apuntar una lectura.",
      annotations: LECTURA,
    },
    async () => {
      const [{ fincas }, contadores] = await Promise.all([cargarFincas(supabase), cargarContadores(supabase)]);
      return ok(
        fincas.map((f) => ({
          finca: f.nombre,
          pantanos: f.pantanos.map((p) => {
            const n = ultimoNivel(p);
            const tope = Number(p.capacidad_util_m3 ?? p.capacidad_m3 ?? 0) || null;
            return {
              nombre: p.nombre,
              capacidad_m3: p.capacidad_m3,
              capacidad_util_m3: p.capacidad_util_m3,
              ultimo_nivel_m3: n?.nivel_m3 ?? null,
              porcentaje: porcentaje(n?.nivel_m3 ?? null, tope),
              fecha: n?.fecha ?? null,
              como: n?.metodo ?? null,
            };
          }),
          contadores: contadores
            .filter((c) => c.finca_id === f.id)
            .map((c) => {
              const lecturas = [...c.lecturas_contador]
                .filter((l) => !l.anulada)
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .slice(0, 3);
              const [ultima, anterior] = lecturas;
              return {
                nombre: c.nombre,
                tipo: c.tipo,
                agua: c.origen_agua,
                ultimas_lecturas: lecturas.map((l) => ({ fecha: l.fecha, m3: Number(l.lectura_m3), por_confirmar: l.pendiente_conciliar })),
                consumo_entre_las_dos_ultimas_m3:
                  ultima && anterior ? Number(ultima.lectura_m3) - Number(anterior.lectura_m3) : null,
              };
            }),
        })),
      );
    },
  );

  server.registerTool(
    "tratamientos",
    {
      title: "Tratamientos",
      description: "Últimos tratamientos (fumigaciones) con finca, fecha, estado, objetivo y productos con su plazo de seguridad.",
      inputSchema: { limite: z.number().int().min(1).max(30).default(8) },
      annotations: LECTURA,
    },
    async ({ limite }) => {
      const { tratamientos, error } = await cargarTratamientos(supabase);
      if (error) return fallo(`No se pudieron leer los tratamientos: ${error}`);
      return ok(
        tratamientos.slice(0, limite).map((t) => ({
          finca: t.fincas?.nombre,
          fecha: t.fecha,
          aproximada: t.fecha_aproximada,
          estado: t.estado,
          objetivo: t.objetivo,
          aplicador: t.personas?.nombre ?? null,
          notas: t.notas,
          productos: t.tratamiento_productos.map((p) => ({
            nombre: p.productos?.nombre,
            dosis_por_cuba: p.dosis_por_cuba,
            unidad: p.unidad,
            plazo_seguridad_dias: p.productos?.plazo_seguridad_dias ?? "sin confirmar",
          })),
        })),
      );
    },
  );

  server.registerTool(
    "tiempo_para_fumigar",
    {
      title: "Tiempo para fumigar",
      description: `Previsión de los próximos 6 días por finca: viento de 7 a 13 h (km/h y rachas), si es buen día para fumigar (viento < ${VIENTO_MAX_KMH} km/h y rachas < ${RACHA_MAX_KMH}) y avisos de tormenta o granizo. Úsala cuando pregunten qué día se puede fumigar, si hace viento o si va a granizar. Es una previsión, no una certeza.`,
      inputSchema: {},
      annotations: { ...LECTURA, openWorldHint: true },
    },
    async () => {
      const { viento, alertas } = await previsionFincas();
      if (viento.length === 0 && alertas.length === 0) return fallo("No se ha podido cargar la previsión del tiempo. Prueba más tarde.");
      return ok({
        hoy: hoyISO(),
        criterio: `Buen día para fumigar: viento por debajo de ${VIENTO_MAX_KMH} km/h y rachas por debajo de ${RACHA_MAX_KMH} km/h entre las 7 y las 13 h.`,
        dias: viento.map((v) => ({
          fecha: v.fecha,
          finca: v.finca,
          viento_kmh: v.kmh,
          rachas_kmh: v.rachas,
          se_puede_fumigar: v.apto && !alertas.some((a) => a.fecha === v.fecha && a.fincas.includes(v.finca)),
        })),
        tormentas_y_granizo: alertas,
      });
    },
  );

  server.registerTool(
    "buscar_lugar",
    {
      title: "Buscar un sitio",
      description:
        "Encuentra a qué finca, zona o sector se refiere un nombre («Los Nuevos», «la del panadero», «sector 2 de Corvera»). Devuelve las coincidencias; si hay varias, pregunta cuál.",
      inputSchema: { texto: z.string().min(2).max(80) },
      annotations: LECTURA,
    },
    async ({ texto }) => {
      const { filas, error } = await resolverLugar(supabase, texto);
      if (error) return fallo(`No se pudo buscar: ${error}`);
      const { fincas } = await cargarFincas(supabase);
      const nombreFinca = new Map(fincas.map((f) => [f.id, f.nombre]));
      if (filas.length === 0) return ok(`No encuentro «${texto}» en ninguna finca.`);
      return ok(filas.map((l) => ({ tipo: l.tipo, nombre: l.nombre, finca: nombreFinca.get(l.finca_id) ?? null })));
    },
  );

  // ------------------------------------------------------------------
  // Apuntar (siempre después de que el usuario confirme)
  // ------------------------------------------------------------------
  server.registerTool(
    "crear_tarea",
    {
      title: "Apuntar una tarea",
      description:
        "Apunta una tarea del día a día. «lugar» puede ser una finca, zona o sector («Corvera», «Los Olivos», «sector 1 de Valladolises»). Si lleva fecha, Campo la recuerda en el aviso al móvil de esa mañana: úsala también para «recuérdame…». Confirma antes con el usuario.",
      inputSchema: {
        titulo: z.string().min(3).max(200).describe("Qué hay que hacer, corto"),
        lugar: z.string().max(80).optional(),
        fecha: fechaSchema.optional().describe("Para cuándo (AAAA-MM-DD)"),
        descripcion: z.string().max(1000).optional(),
        tipo: z
          .enum(["riego", "tratamiento", "poda", "revision", "mantenimiento", "cosecha", "administrativa", "otro"])
          .default("otro"),
        prioridad: z.enum(["baja", "normal", "alta"]).default("normal"),
      },
      annotations: ESCRITURA,
    },
    async ({ titulo, lugar, fecha, descripcion, tipo, prioridad }) => {
      const p = sinPermiso(ctx);
      if (p) return p;
      let fila: FilaLugar | null = null;
      if (lugar) {
        const { filas, error } = await resolverLugar(supabase, lugar);
        if (error) return fallo(`No se pudo comprobar el sitio: ${error}`);
        if (filas.length > 1) {
          const { fincas } = await cargarFincas(supabase);
          const nf = new Map(fincas.map((f) => [f.id, f.nombre]));
          return fallo(
            `«${lugar}» puede ser: ${filas.map((f) => `${f.nombre} (${nf.get(f.finca_id)})`).join(", ")}. Pregunta cuál y vuelve a llamar con el nombre exacto.`,
          );
        }
        fila = filas[0] ?? null;
      }
      const { data, error } = await supabase
        .from("tareas")
        .insert({
          titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1),
          descripcion: descripcion ?? null,
          tipo,
          prioridad,
          estado: "prevista",
          fecha_prevista: fecha ?? null,
          finca_id: fila?.finca_id ?? null,
          zona_id: fila?.tipo === "zona" ? fila.id : null,
          sector_id: fila?.tipo === "sector" ? fila.id : null,
          ubicacion_texto: lugar ?? null,
          origen: ORIGEN,
        })
        .select("id")
        .single<{ id: string }>();
      if (error) return fallo(`No se pudo guardar la tarea: ${error.message}`);
      return ok({
        guardado: true,
        id: data.id,
        mensaje: `Tarea apuntada${fila ? ` en ${fila.nombre}` : lugar ? ` (no encontré «${lugar}»: queda sin sitio)` : ""}${fecha ? ` para el ${fecha}` : ""}.`,
      });
    },
  );

  server.registerTool(
    "cambiar_estado_tarea",
    {
      title: "Cambiar el estado de una tarea",
      description: "Marca una tarea como en curso, terminada, aplazada o prevista. Usa el id que da la herramienta «tareas».",
      inputSchema: {
        tarea_id: z.string().uuid(),
        estado: z.enum(["prevista", "en_curso", "terminada", "aplazada"]),
        nota: z.string().max(500).optional().describe("Comentario al cerrarla (opcional)"),
      },
      annotations: ESCRITURA,
    },
    async ({ tarea_id, estado, nota }) => {
      const p = sinPermiso(ctx);
      if (p) return p;
      const { data, error } = await supabase
        .from("tareas")
        .update({
          estado,
          completada_en: estado === "terminada" ? new Date().toISOString() : null,
          ...(nota ? { notas_cierre: nota } : {}),
        })
        .eq("id", tarea_id)
        .select("titulo")
        .maybeSingle<{ titulo: string }>();
      if (error) return fallo(`No se pudo cambiar: ${error.message}`);
      if (!data) return fallo("No encuentro esa tarea.");
      return ok({ guardado: true, mensaje: `«${data.titulo}»: ${estado.replace("_", " ")}.` });
    },
  );

  server.registerTool(
    "apuntar_nivel_pantano",
    {
      title: "Apuntar el nivel de un pantano",
      description:
        "Apunta cuánta agua tiene un pantano: en m³ o en porcentaje («está a la mitad» = 50). Se identifica por la finca (Valladolises, Corvera).",
      inputSchema: {
        finca: z.string().min(2),
        nivel_m3: z.number().min(0).optional(),
        porcentaje: z.number().min(0).max(100).optional(),
        como: z.enum(["a_ojo", "sensor", "calculado"]).default("a_ojo"),
        fecha: fechaSchema.optional().describe("Por defecto, hoy"),
        notas: z.string().max(500).optional(),
      },
      annotations: ESCRITURA,
    },
    async ({ finca, nivel_m3, porcentaje: pct, como, fecha, notas }) => {
      const p = sinPermiso(ctx);
      if (p) return p;
      const hoy = hoyISO();
      if (fecha && fecha > hoy) return fallo("No se puede apuntar un nivel con fecha futura.");
      const { fincas } = await cargarFincas(supabase);
      const { finca: f, error } = buscarFinca(fincas, finca);
      if (error || !f) return fallo(error ?? "Finca no encontrada.");
      if (f.pantanos.length === 0) return fallo(`${f.nombre} no tiene pantano dado de alta en Campo.`);
      if (f.pantanos.length > 1) return fallo(`${f.nombre} tiene varios pantanos: ${f.pantanos.map((x) => x.nombre).join(", ")}.`);
      const pantano = f.pantanos[0];
      let nivel = nivel_m3 ?? null;
      if (nivel == null && pct != null) {
        const tope = Number(pantano.capacidad_util_m3 ?? pantano.capacidad_m3 ?? 0);
        if (!tope) return fallo("Este pantano no tiene capacidad apuntada: dime los m³.");
        nivel = Math.round((pct / 100) * tope);
      }
      if (nivel == null) return fallo("Falta el nivel: en m³ o en porcentaje.");
      const { error: e } = await supabase.from("niveles_pantano").insert({
        pantano_id: pantano.id,
        fecha: fecha ?? hoy,
        nivel_m3: nivel,
        metodo: como,
        notas: notas ?? (pct != null && nivel_m3 == null ? `Dicho como ${pct} %` : null),
        origen: ORIGEN,
      });
      if (e) return fallo(`No se pudo guardar: ${e.message}`);
      return ok({ guardado: true, mensaje: `${pantano.nombre}: ${nivel.toLocaleString("es-ES")} m³ apuntados.` });
    },
  );

  server.registerTool(
    "apuntar_lectura_contador",
    {
      title: "Apuntar la lectura de un contador",
      description:
        "Apunta el número que marca un contador de agua (en m³). «contador» es su nombre o parte de él junto con la finca («entrada trasvase Valladolises», «pozo Corvera», «salida Corvera»). Mira antes la herramienta «agua» para ver los nombres. Si la lectura es menor que la anterior, avisa y pide confirmación (usa confirmar_bajada).",
      inputSchema: {
        contador: z.string().min(2).max(120),
        lectura_m3: z.number().min(0),
        fecha: fechaSchema.optional().describe("Por defecto, hoy"),
        notas: z.string().max(500).optional(),
        confirmar_bajada: z.boolean().default(false).describe("true solo si el usuario confirma que la lectura baja"),
      },
      annotations: ESCRITURA,
    },
    async ({ contador, lectura_m3, fecha, notas, confirmar_bajada }) => {
      const p = sinPermiso(ctx);
      if (p) return p;
      const hoy = hoyISO();
      if (fecha && fecha > hoy) return fallo("No se puede apuntar una lectura con fecha futura.");
      const [{ fincas }, contadores] = await Promise.all([cargarFincas(supabase), cargarContadores(supabase)]);
      const nombreFinca = new Map(fincas.map((f) => [f.id, f.nombre]));
      const palabras = normalizar(contador)
        .split(" ")
        .filter((w) => w.length > 2 && !["contador", "del", "las", "los"].includes(w));
      const puntos = contadores
        .map((c) => {
          const texto = normalizar(`${c.nombre} ${nombreFinca.get(c.finca_id) ?? ""} ${c.origen_agua ?? ""}`);
          return { c, puntos: palabras.filter((w) => texto.includes(w)).length };
        })
        .filter((x) => x.puntos > 0)
        .sort((a, b) => b.puntos - a.puntos);
      const mejores = puntos.filter((x) => x.puntos === puntos[0]?.puntos);
      const lista = contadores.map((c) => `«${c.nombre}» (${nombreFinca.get(c.finca_id)})`).join(", ");
      if (mejores.length === 0) return fallo(`No encuentro ese contador. Contadores: ${lista}.`);
      if (mejores.length > 1)
        return fallo(
          `Puede ser: ${mejores.map((x) => `«${x.c.nombre}» (${nombreFinca.get(x.c.finca_id)})`).join(", ")}. Pregunta cuál.`,
        );
      const c = mejores[0].c;
      const ultima = ultimaLectura(c);
      if (ultima && lectura_m3 < Number(ultima.lectura_m3) && !confirmar_bajada) {
        return fallo(
          `Ojo: la última lectura de «${c.nombre}» fue ${Number(ultima.lectura_m3).toLocaleString("es-ES")} m³ (${ultima.fecha}) y esta es menor. ¿Está bien el número? Si lo confirma, vuelve a llamar con confirmar_bajada = true.`,
        );
      }
      const { error } = await supabase.from("lecturas_contador").insert({
        contador_id: c.id,
        fecha: fecha ?? hoy,
        lectura_m3,
        notas: notas ?? null,
        origen: ORIGEN,
      });
      if (error) return fallo(`No se pudo guardar: ${error.message}`);
      const consumo = ultima ? lectura_m3 - Number(ultima.lectura_m3) : null;
      return ok({
        guardado: true,
        mensaje: `«${c.nombre}» (${nombreFinca.get(c.finca_id)}): ${lectura_m3.toLocaleString("es-ES")} m³ apuntados.${
          consumo != null && consumo >= 0 ? ` Desde el ${ultima!.fecha}: ${consumo.toLocaleString("es-ES")} m³.` : ""
        }`,
      });
    },
  );

  server.registerTool(
    "crear_fecha_clave",
    {
      title: "Apuntar una fecha clave",
      description:
        "Apunta una fecha importante de la campaña (corte, tratamiento, plazo de papeles, agua, revisión, compra…). Campo avisará al móvil una semana antes, el día antes y el mismo día. No es para tareas del día a día.",
      inputSchema: {
        titulo: z.string().min(3).max(200),
        fecha: fechaSchema,
        tipo: z.enum(TIPOS_HITO as [string, ...string[]]).default("otro").describe(Object.entries(NOMBRE_TIPO_HITO).map(([k, v]) => `${k} = ${v}`).join(", ")),
        finca: z.string().optional(),
        aproximada: z.boolean().default(false).describe("true si es «más o menos» esa fecha"),
        repetir_cada_ano: z.boolean().default(false),
        nota: z.string().max(500).optional(),
      },
      annotations: ESCRITURA,
    },
    async ({ titulo, fecha, tipo, finca, aproximada, repetir_cada_ano, nota }) => {
      const p = sinPermiso(ctx);
      if (p) return p;
      let fincaId: string | null = null;
      if (finca) {
        const { fincas } = await cargarFincas(supabase);
        const r = buscarFinca(fincas, finca);
        if (r.error) return fallo(r.error);
        fincaId = r.finca!.id;
      }
      const { data, error } = await supabase
        .from("hitos")
        .insert({
          titulo,
          fecha,
          tipo,
          finca_id: fincaId,
          fecha_aproximada: aproximada,
          repetir: repetir_cada_ano ? "anual" : "no",
          texto: nota ?? null,
          origen: ORIGEN,
        })
        .select("id")
        .single<{ id: string }>();
      if (error) return fallo(`No se pudo guardar: ${error.message}`);
      return ok({ guardado: true, id: data.id, mensaje: `Fecha clave apuntada: «${titulo}», ${aproximada ? "hacia el " : ""}${fecha}.` });
    },
  );

  server.registerTool(
    "marcar_fecha_clave",
    {
      title: "Marcar una fecha clave como hecha o anulada",
      description:
        "Cierra una fecha clave pendiente: «hecho» o «anulado» (nada se borra). Si se repite cada año, Campo crea sola la del año siguiente. Usa el id de «fechas_clave».",
      inputSchema: { fecha_clave_id: z.string().uuid(), estado: z.enum(["hecho", "anulado"]) },
      annotations: ESCRITURA,
    },
    async ({ fecha_clave_id, estado }) => {
      const p = sinPermiso(ctx);
      if (p) return p;
      const { data: h, error } = await supabase
        .from("hitos")
        .update({ estado, hecho_en: estado === "hecho" ? new Date().toISOString() : null })
        .eq("id", fecha_clave_id)
        .eq("estado", "pendiente")
        .select("id, titulo, texto, tipo, finca_id, fecha, hora, fecha_aproximada, avisar_dias, repetir")
        .maybeSingle<{
          id: string;
          titulo: string;
          texto: string | null;
          tipo: string;
          finca_id: string | null;
          fecha: string;
          hora: string | null;
          fecha_aproximada: boolean;
          avisar_dias: number[];
          repetir: "no" | "anual";
        }>();
      if (error) return fallo(`No se pudo cambiar: ${error.message}`);
      if (!h) return fallo("No encuentro esa fecha clave pendiente (puede que ya esté cerrada).");
      let siguiente: string | null = null;
      if (estado === "hecho" && h.repetir === "anual") {
        const y = Number(h.fecha.slice(0, 4));
        siguiente = `${y + 1}${h.fecha.slice(4)}`;
        if (!esFechaISO(siguiente)) siguiente = `${y + 1}-02-28`;
        const { data: ya } = await supabase.from("hitos").select("id").eq("viene_de", h.id).maybeSingle();
        if (!ya) {
          await supabase.from("hitos").insert({
            titulo: h.titulo,
            texto: h.texto,
            tipo: h.tipo,
            finca_id: h.finca_id,
            fecha: siguiente,
            hora: h.hora,
            fecha_aproximada: h.fecha_aproximada,
            avisar_dias: h.avisar_dias,
            repetir: "anual",
            viene_de: h.id,
            origen: ORIGEN,
          });
        }
      }
      return ok({
        guardado: true,
        mensaje: `«${h.titulo}» marcada como ${estado}.${siguiente ? ` Apuntada la del año que viene (${siguiente}).` : ""}`,
      });
    },
  );

  server.registerTool(
    "apuntar_incidencia",
    {
      title: "Apuntar un aviso o incidencia",
      description: "Apunta un problema en una finca: fuga de riego, avería, plaga, la piscina u otro. Sale en el mapa y en los avisos de la web.",
      inputSchema: {
        finca: z.string().min(2),
        titulo: z.string().min(3).max(200),
        tipo: z.enum(["fuga_riego", "averia", "plaga", "piscina", "otro"]).default("otro"),
        descripcion: z.string().max(1000).optional(),
        gravedad: z.enum(["baja", "media", "alta"]).default("media"),
      },
      annotations: ESCRITURA,
    },
    async ({ finca, titulo, tipo, descripcion, gravedad }) => {
      const p = sinPermiso(ctx);
      if (p) return p;
      const { fincas } = await cargarFincas(supabase);
      const r = buscarFinca(fincas, finca);
      if (r.error || !r.finca) return fallo(r.error ?? "Finca no encontrada.");
      const { error } = await supabase.from("incidencias").insert({
        finca_id: r.finca.id,
        titulo,
        tipo,
        descripcion: descripcion ?? null,
        severidad: gravedad,
        estado: "abierta",
        fecha: hoyISO(),
        origen: ORIGEN,
      });
      if (error) return fallo(`No se pudo guardar: ${error.message}`);
      return ok({ guardado: true, mensaje: `Aviso apuntado en ${r.finca.nombre}: «${titulo}».` });
    },
  );

  server.registerTool(
    "nota_diario",
    {
      title: "Nota en el diario",
      description:
        "Apunta una nota libre en el diario de la finca: lo que se ha hecho o visto hoy («ha venido Diego, dice que hay algo de cotonet»).",
      inputSchema: {
        texto: z.string().min(3).max(2000),
        finca: z.string().optional(),
        fecha: fechaSchema.optional().describe("Por defecto, hoy"),
      },
      annotations: ESCRITURA,
    },
    async ({ texto, finca, fecha }) => {
      const p = sinPermiso(ctx);
      if (p) return p;
      const hoy = hoyISO();
      if (fecha && fecha > hoy) return fallo("El diario es de lo que ya ha pasado: la fecha no puede ser futura.");
      let fincaId: string | null = null;
      if (finca) {
        const { fincas } = await cargarFincas(supabase);
        const r = buscarFinca(fincas, finca);
        if (r.error) return fallo(r.error);
        fincaId = r.finca!.id;
      }
      const { error } = await supabase.from("diario").insert({ texto, finca_id: fincaId, fecha: fecha ?? hoy, origen: ORIGEN });
      if (error) return fallo(`No se pudo guardar: ${error.message}`);
      return ok({ guardado: true, mensaje: "Nota apuntada en el diario." });
    },
  );

  // ------------------------------------------------------------------
  // Ideas y reflexiones (migración 0007)
  // ------------------------------------------------------------------
  const TIPOS_IDEA = ["idea", "reflexion", "duda", "plan", "aprendizaje"] as const;

  server.registerTool(
    "apuntar_idea",
    {
      title: "Guardar una idea o reflexión",
      description:
        "Guarda una idea, reflexión, duda, plan o algo aprendido sobre el campo que NO es una tarea ni una fecha («habría que probar a soltar bichos contra el cotonet», «Los Olivos rinden menos desde que cambiamos el riego»). «texto» = lo que dijo, completo y con sus palabras; «titulo» = resumen de una línea. Si la idea la has detectado tú en la conversación, guárdala sin preguntar con detectada=true y avísale después en una línea; si te la ha pedido él, detectada=false.",
      inputSchema: {
        titulo: z.string().min(3).max(200).describe("Resumen en una línea"),
        texto: z.string().min(3).max(8000).describe("Lo que dijo, completo"),
        tipo: z.enum(TIPOS_IDEA).default("idea"),
        finca: z.string().optional().describe("Si habla de una finca concreta"),
        temas: z
          .array(z.string().min(2).max(30))
          .max(6)
          .default([])
          .describe("Palabras clave en minúscula: riego, plagas, cosecha, abono, dinero, maquinaria, personal, agua, poda…"),
        detectada: z
          .boolean()
          .default(false)
          .describe("true si la has sacado tú de la conversación sin que él pidiera guardarla"),
      },
      annotations: ESCRITURA,
    },
    async ({ titulo, texto, tipo, finca, temas, detectada }) => {
      const p = sinPermiso(ctx);
      if (p) return p;
      let fincaId: string | null = null;
      if (finca) {
        const { fincas } = await cargarFincas(supabase);
        const r = buscarFinca(fincas, finca);
        if (r.error) return fallo(r.error);
        fincaId = r.finca!.id;
      }
      const { error } = await supabase.from("ideas").insert({
        titulo,
        texto,
        tipo,
        finca_id: fincaId,
        // «detectada» = la apuntó el asistente por su cuenta, para revisarla en la libreta
        temas: [...new Set([...temas.map((t) => normalizar(t)), ...(detectada ? ["detectada"] : [])])],
        origen: ORIGEN,
      });
      if (error) {
        if (/ideas/.test(error.message) && /exist|schema cache/i.test(error.message))
          return fallo("La libreta de ideas aún no está creada en Campo (falta la migración 0007).");
        return fallo(`No se pudo guardar: ${error.message}`);
      }
      return ok({ guardado: true, mensaje: `Idea guardada: «${titulo}».` });
    },
  );

  server.registerTool(
    "buscar_ideas",
    {
      title: "Buscar ideas y reflexiones",
      description:
        "Busca en las ideas y reflexiones guardadas («¿qué pensaba yo del riego de Los Olivos?», «ideas sobre Lobosillo»). Sin texto, devuelve las últimas.",
      inputSchema: {
        texto: z.string().max(80).optional().describe("Palabra o tema a buscar"),
        finca: z.string().optional(),
        limite: z.number().int().min(1).max(50).default(15),
      },
      annotations: LECTURA,
    },
    async ({ texto, finca, limite }) => {
      let q = supabase
        .from("ideas")
        .select("id, titulo, texto, tipo, temas, estado, created_at, fincas(nombre), profiles:created_by(nombre)")
        .neq("estado", "descartada")
        .order("created_at", { ascending: false })
        .limit(limite);
      if (finca) {
        const { fincas } = await cargarFincas(supabase);
        const r = buscarFinca(fincas, finca);
        if (r.error) return fallo(r.error);
        q = q.eq("finca_id", r.finca!.id);
      }
      if (texto) {
        const t = texto.replace(/[%,()]/g, " ").trim();
        const tema = normalizar(t);
        q = q.or(`titulo.ilike.%${t}%,texto.ilike.%${t}%,temas.cs.{${tema}}`);
      }
      const { data, error } = await q;
      if (error) return fallo(`No se pudieron leer las ideas: ${error.message}`);
      if (!data?.length) return ok(texto ? `No hay ideas guardadas sobre «${texto}».` : "Aún no hay ideas guardadas.");
      return ok(
        data.map((i) => ({
          fecha: String(i.created_at).slice(0, 10),
          titulo: i.titulo,
          texto: i.texto,
          tipo: i.tipo,
          temas: i.temas,
          estado: i.estado,
          finca: (i.fincas as unknown as { nombre: string } | null)?.nombre ?? null,
          quien: (i.profiles as unknown as { nombre: string | null } | null)?.nombre ?? null,
        })),
      );
    },
  );
}
