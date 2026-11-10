import { leerCuerpo, texto as textoSiri, usuarioDeAtajo, type UsuarioAtajo } from "@/lib/atajos";
import { cargarFincas, type Finca } from "@/lib/datos";
import { NOMBRE_TROZO, repartir, type TipoTrozo, type Trozo } from "@/lib/repartidor";
import { fechaCorta, hoyISO, normalizar } from "@/lib/texto";

// Atajo de Siri «Cuaderno»: Juan Carlos dicta lo que sea y Campo lo reparte.
// - Lo dicho se guarda siempre tal cual en «dictados» (privado: solo lo ve él).
// - Claude lo trocea: lo del campo se guarda aquí con origen 'atajo';
//   lo personal (o dudoso) se manda a su cuaderno personal si está conectado
//   (PERSONAL_APUNTAR_URL); lo de la confitería no se guarda aquí.
// - Lo del campo que no está claro va a la libreta de ideas con el tema
//   «revisar», para que nadie se invente la finca ni la fecha.
// Responde una frase corta que Siri lee en voz alta.

export const maxDuration = 40;

const ORIGEN = "atajo";

type Guardado = { tipo: TipoTrozo; revisar: boolean; finca: string | null; fecha: string | null };

function buscarFinca(fincas: Finca[], nombre: string | null) {
  if (!nombre) return null;
  const n = normalizar(nombre);
  return (
    fincas.find((f) => normalizar(f.nombre) === n || f.alias.some((a) => normalizar(a) === n)) ??
    fincas.find((f) => normalizar(f.nombre).includes(n) || n.includes(normalizar(f.nombre))) ??
    null
  );
}

function buscarZona(fincas: Finca[], finca: Finca | null, nombre: string | null) {
  if (!nombre) return null;
  const n = normalizar(nombre);
  const donde = finca ? [finca] : fincas;
  const zonas = donde.flatMap((f) =>
    f.zonas
      .filter((z) => normalizar(z.nombre) === n || z.alias.some((a) => normalizar(a) === n))
      .map((z) => ({ zona: z, finca: f })),
  );
  // si la zona existe en varias fincas y no dijo cuál, no se adivina
  return zonas.length === 1 ? zonas[0] : null;
}

/** Guarda un trozo del campo. Devuelve qué se guardó o el error. */
async function guardarCampo(u: UsuarioAtajo, fincas: Finca[], t: Trozo, hoy: string): Promise<Guardado | string> {
  const lugarZona = buscarZona(fincas, buscarFinca(fincas, t.finca), t.zona);
  const finca = lugarZona?.finca ?? buscarFinca(fincas, t.finca);
  const zona = lugarZona?.zona ?? null;
  const base = { origen: ORIGEN, created_by: u.userId };

  // Lo que no está claro, o le falta lo imprescindible, va a la libreta para revisar
  let tipo = t.tipo;
  if (tipo === "fecha_clave" && !t.fecha) tipo = "tarea";
  const revisar = !t.claro || (tipo === "incidencia" && !finca);

  if (revisar) {
    const { error } = await u.admin.from("ideas").insert({
      ...base,
      titulo: `Revisar: ${t.titulo}`.slice(0, 200),
      texto: t.texto,
      tipo: "duda",
      finca_id: finca?.id ?? null,
      temas: ["revisar", "atajo", `era_${t.tipo}`],
    });
    return error ? error.message : { tipo: t.tipo, revisar: true, finca: finca?.nombre ?? null, fecha: null };
  }

  let error: { message: string } | null = null;
  if (tipo === "tarea") {
    ({ error } = await u.admin.from("tareas").insert({
      ...base,
      titulo: t.titulo.charAt(0).toUpperCase() + t.titulo.slice(1),
      descripcion: t.texto,
      tipo: t.tipo_tarea,
      prioridad: "normal",
      estado: "prevista",
      fecha_prevista: t.fecha,
      finca_id: finca?.id ?? null,
      zona_id: zona?.id ?? null,
      ubicacion_texto: t.zona ?? t.finca ?? null,
    }));
  } else if (tipo === "fecha_clave") {
    ({ error } = await u.admin.from("hitos").insert({
      ...base,
      titulo: t.titulo,
      fecha: t.fecha,
      tipo: t.tipo_hito,
      finca_id: finca?.id ?? null,
      fecha_aproximada: t.fecha_aproximada,
      repetir: "no",
      texto: t.texto,
    }));
  } else if (tipo === "nota_diario") {
    ({ error } = await u.admin.from("diario").insert({
      ...base,
      texto: t.texto,
      finca_id: finca?.id ?? null,
      // el diario es de lo que ya ha pasado
      fecha: t.fecha && t.fecha <= hoy ? t.fecha : hoy,
    }));
  } else if (tipo === "incidencia") {
    ({ error } = await u.admin.from("incidencias").insert({
      ...base,
      finca_id: finca!.id,
      zona_id: zona?.id ?? null,
      titulo: t.titulo,
      tipo: t.tipo_incidencia,
      descripcion: t.texto,
      severidad: t.tipo_incidencia === "fuga_riego" || t.tipo_incidencia === "averia" ? "media" : "baja",
      estado: "abierta",
      fecha: hoy,
    }));
  } else {
    ({ error } = await u.admin.from("ideas").insert({
      ...base,
      titulo: t.titulo,
      texto: t.texto,
      tipo: t.tipo_idea,
      finca_id: finca?.id ?? null,
      temas: ["atajo"],
    }));
  }
  return error ? error.message : { tipo, revisar: false, finca: finca?.nombre ?? null, fecha: tipo === "nota_diario" ? null : t.fecha };
}

/** Manda lo personal a su cuaderno personal, si está conectado. */
async function mandarPersonal(trozos: Trozo[], u: UsuarioAtajo): Promise<"enviado" | "sin_conectar" | "fallo"> {
  const url = process.env.PERSONAL_APUNTAR_URL;
  const clave = process.env.PERSONAL_APUNTAR_CLAVE;
  if (!url || !clave) return "sin_conectar";
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${clave}`, "content-type": "application/json" },
      body: JSON.stringify({
        origen: "cuaderno-campo",
        quien: u.nombre,
        trozos: trozos.map(({ destino, tipo, titulo, texto, fecha, fecha_aproximada, claro }) => ({
          dudoso: destino === "dudoso",
          tipo,
          titulo,
          texto,
          fecha,
          fecha_aproximada,
          claro,
        })),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return r.ok ? "enviado" : "fallo";
  } catch {
    return "fallo";
  }
}

/** «una tarea en Corvera para el 12/11» */
function frase(g: Guardado, hoy: string) {
  if (g.revisar) return `una cosa que tienes que revisar${g.finca ? ` de ${g.finca}` : ""}`;
  return `${NOMBRE_TROZO[g.tipo][0]}${g.finca ? ` en ${g.finca}` : ""}${g.fecha ? ` para el ${fechaCorta(g.fecha, hoy)}` : ""}`;
}

function juntar(partes: string[]) {
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

function respuestaVoz(guardados: Guardado[], fallos: number, personal: number, envio: string, confiteria: number, hoy: string) {
  const frases: string[] = [];
  if (guardados.length) {
    const lista =
      guardados.length <= 3
        ? guardados.map((g) => frase(g, hoy))
        : [`${guardados.length} cosas`];
    frases.push(`Apuntado en Campo: ${juntar(lista)}.`);
  }
  if (fallos) frases.push(`${fallos === 1 ? "Una cosa no se ha" : `${fallos} cosas no se han`} podido guardar; lo tienes tal cual en tu cuaderno.`);
  if (personal) {
    const que = personal === 1 ? "Lo personal" : `Las ${personal} cosas personales`;
    if (envio === "enviado") frases.push(`${que}, a tu cuaderno personal.`);
    else frases.push(`${que} no lo he puesto en Campo: lo guardo aparte, solo para ti.`);
  }
  if (confiteria) frases.push("Lo de la confitería no lo apunto aquí.");
  return frases.join(" ") || "No he encontrado nada que apuntar.";
}

async function atender(request: Request) {
  const cuerpo = await leerCuerpo(request);
  const u = await usuarioDeAtajo(request, cuerpo);
  if (u instanceof Response) return u;
  if (!u.puedeEditar) return textoSiri("Tu usuario de Campo solo puede consultar: no puedo apuntar nada.");

  const dicho = String(cuerpo.texto ?? cuerpo.nota ?? "").trim().slice(0, 8000);
  if (dicho.length < 3) return textoSiri("No te he oído nada. Prueba otra vez.");

  // 1. Lo dicho, tal cual, antes de nada: así nunca se pierde
  const { data: dictado, error: errDictado } = await u.admin
    .from("dictados")
    .insert({ user_id: u.userId, texto: dicho, estado: "sin_repartir" })
    .select("id")
    .single<{ id: string }>();
  if (errDictado) console.error("[atajo cuaderno] dictado", errDictado.message);

  const cerrar = async (estado: "repartido" | "sin_repartir", reparto: unknown[], respuesta: string) => {
    if (dictado) await u.admin.from("dictados").update({ estado, reparto, respuesta }).eq("id", dictado.id);
    return textoSiri(respuesta);
  };

  // 2. Reparto con Claude
  const hoy = hoyISO();
  const { fincas } = await cargarFincas(u.admin);
  let trozos: Trozo[];
  try {
    trozos = await repartir(dicho, fincas, hoy);
  } catch (e) {
    console.error("[atajo cuaderno] reparto", e instanceof Error ? e.message : e);
    return cerrar("sin_repartir", [], "Lo he guardado tal cual en tu cuaderno, pero ahora no he podido ordenarlo. Lo ordenamos luego.");
  }

  // 3. Cada trozo a su sitio
  const reparto: Record<string, unknown>[] = [];
  const guardados: Guardado[] = [];
  let fallos = 0;
  for (const t of trozos.filter((x) => x.destino === "campo")) {
    const r = await guardarCampo(u, fincas, t, hoy);
    if (typeof r === "string") {
      fallos++;
      console.error("[atajo cuaderno] guardar", t.tipo, r);
      reparto.push({ ...t, guardado_en: null, error: r });
    } else {
      guardados.push(r);
      reparto.push({ ...t, guardado_en: r.revisar ? "ideas (revisar)" : r.tipo });
    }
  }

  const personales = trozos.filter((x) => x.destino === "personal" || x.destino === "dudoso");
  const envio = personales.length ? await mandarPersonal(personales, u) : "sin_conectar";
  for (const t of personales) reparto.push({ ...t, guardado_en: envio === "enviado" ? "personal" : "dictado" });

  const confiteria = trozos.filter((x) => x.destino === "confiteria");
  for (const t of confiteria) reparto.push({ ...t, guardado_en: null });

  return cerrar(
    "repartido",
    reparto,
    respuestaVoz(guardados, fallos, personales.length, envio, confiteria.length, hoy),
  );
}

export const POST = atender;
