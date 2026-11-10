import { leerCuerpo, numero, texto as textoSiri, usuarioDeAtajo, type UsuarioAtajo } from "@/lib/atajos";
import { cargarFincas, type Finca } from "@/lib/datos";
import { NOMBRE_TROZO, repartir, type Aqui, type TipoTrozo, type Trozo } from "@/lib/repartidor";
import { fechaCorta, hoyISO, normalizar } from "@/lib/texto";
import { ubicar } from "@/lib/ubicacion";

// Atajo de Siri «Cuaderno»: el único atajo. Juan Carlos dicta lo que sea y
// Campo lo reparte.
// - Lo dicho se guarda siempre tal cual en «dictados» (privado: solo lo ve él).
// - Si el iPhone manda su ubicación y está en una finca, «aquí» es esa finca,
//   y las incidencias quedan con su punto exacto en el plano.
// - Claude lo trocea: lo del campo se guarda aquí con origen 'atajo'; lo
//   personal, lo dudoso y lo de la confitería se mandan a su cuaderno personal
//   si está conectado (PERSONAL_APUNTAR_URL). Nada de eso entra en Campo.
// - Lo del campo que no está claro va a la libreta de ideas con el tema
//   «revisar», para que nadie se invente la finca ni la fecha.
// Responde una frase corta que Siri lee en voz alta.

export const maxDuration = 40;

const ORIGEN = "atajo";

type Guardado = { tipo: TipoTrozo; revisar: boolean; finca: string | null; fecha: string | null; conSitio: boolean };
type Punto = { lat: number; lon: number; precision: number | null; finca: string };

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
async function guardarCampo(
  u: UsuarioAtajo,
  fincas: Finca[],
  t: Trozo,
  hoy: string,
  punto: Punto | null,
): Promise<Guardado | string> {
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
    return error
      ? error.message
      : { tipo: t.tipo, revisar: true, finca: finca?.nombre ?? null, fecha: null, conSitio: false };
  }

  let error: { message: string } | null = null;
  let conSitio = false;
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
    // el punto exacto solo si está en la misma finca de la que habla
    const sitio = punto && finca && normalizar(punto.finca) === normalizar(finca.nombre) ? punto : null;
    conSitio = sitio !== null;
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
      ...(sitio
        ? {
            lat: sitio.lat,
            lon: sitio.lon,
            precision_m: sitio.precision != null && sitio.precision >= 0 ? Math.round(sitio.precision * 10) / 10 : null,
            geom: `SRID=4326;POINT(${sitio.lon} ${sitio.lat})`,
          }
        : {}),
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
  return error
    ? error.message
    : { tipo, revisar: false, finca: finca?.nombre ?? null, fecha: tipo === "nota_diario" ? null : t.fecha, conSitio };
}

/** Manda lo personal y lo de la confitería a su cuaderno personal, si está conectado. */
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
          // personal | confiteria | dudoso (no se sabe si era del campo)
          tema: destino,
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

/** «una incidencia en Corvera con su sitio exacto» */
function frase(g: Guardado, hoy: string) {
  if (g.revisar) return `una cosa que tienes que revisar${g.finca ? ` de ${g.finca}` : ""}`;
  return `${NOMBRE_TROZO[g.tipo][0]}${g.finca ? ` en ${g.finca}` : ""}${g.fecha ? ` para el ${fechaCorta(g.fecha, hoy)}` : ""}${g.conSitio ? " con su sitio exacto" : ""}`;
}

function juntar(partes: string[]) {
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

function respuestaVoz(guardados: Guardado[], fallos: number, aparte: number, envio: string, hoy: string) {
  const frases: string[] = [];
  if (guardados.length) {
    const lista = guardados.length <= 3 ? guardados.map((g) => frase(g, hoy)) : [`${guardados.length} cosas`];
    frases.push(`Apuntado en Campo: ${juntar(lista)}.`);
  }
  if (fallos) {
    frases.push(`${fallos === 1 ? "Una cosa no se ha" : `${fallos} cosas no se han`} podido guardar; lo tienes tal cual en tu cuaderno.`);
  }
  if (aparte) {
    const que = aparte === 1 ? "Lo que no es del campo" : `Las ${aparte} cosas que no son del campo`;
    frases.push(envio === "enviado" ? `${que}, a tu cuaderno personal.` : `${que} no lo pongo en Campo: lo guardo aparte, solo para ti.`);
  }
  return frases.join(" ") || "No he encontrado nada que apuntar.";
}

async function atender(request: Request) {
  const cuerpo = await leerCuerpo(request);
  const u = await usuarioDeAtajo(request, cuerpo);
  if (u instanceof Response) return u;
  if (!u.puedeEditar) return textoSiri("Tu usuario de Campo solo puede consultar: no puedo apuntar nada.");

  const dicho = String(cuerpo.texto ?? cuerpo.nota ?? "").trim().slice(0, 8000);
  if (dicho.length < 3) return textoSiri("No te he oído nada. Prueba otra vez.");

  // Dónde está (opcional): solo cuenta si está dentro de una finca
  const lat = numero(cuerpo.lat ?? cuerpo.latitud);
  const lon = numero(cuerpo.lon ?? cuerpo.lng ?? cuerpo.longitud);
  let punto: Punto | null = null;
  let aqui: Aqui = null;
  if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    const donde = ubicar(lat, lon);
    if (donde.enFinca) {
      punto = { lat, lon, precision: numero(cuerpo.precision), finca: donde.finca };
      aqui = { finca: donde.finca, zona: donde.zona };
    }
  }

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
    trozos = await repartir(dicho, fincas, hoy, aqui);
  } catch (e) {
    console.error("[atajo cuaderno] reparto", e instanceof Error ? e.message : e);
    return cerrar(
      "sin_repartir",
      [],
      "Lo he guardado tal cual en tu cuaderno, pero ahora no he podido ordenarlo. Lo ordenamos luego.",
    );
  }

  // 3. Lo del campo, a Campo
  const reparto: Record<string, unknown>[] = [];
  const guardados: Guardado[] = [];
  let fallos = 0;
  for (const t of trozos.filter((x) => x.destino === "campo")) {
    const r = await guardarCampo(u, fincas, t, hoy, punto);
    if (typeof r === "string") {
      fallos++;
      console.error("[atajo cuaderno] guardar", t.tipo, r);
      reparto.push({ ...t, guardado_en: null, error: r });
    } else {
      guardados.push(r);
      reparto.push({ ...t, guardado_en: r.revisar ? "ideas (revisar)" : r.tipo });
    }
  }

  // 4. Lo personal, lo dudoso y lo de la confitería, a su cuaderno personal
  const aparte = trozos.filter((x) => x.destino !== "campo");
  const envio = aparte.length ? await mandarPersonal(aparte, u) : "sin_conectar";
  for (const t of aparte) reparto.push({ ...t, guardado_en: envio === "enviado" ? "personal" : "dictado" });

  return cerrar("repartido", reparto, respuestaVoz(guardados, fallos, aparte.length, envio, hoy));
}

export const POST = atender;
