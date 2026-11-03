import { leerCuerpo, numero, texto, usuarioDeAtajo } from "@/lib/atajos";
import { textoDistancia, ubicar } from "@/lib/ubicacion";
import { hoyISO, normalizar } from "@/lib/texto";

// Atajo de Siri «Incidencia»: el iPhone manda su posición, qué es y una nota.
// Se guarda como incidencia con su sitio exacto (finca y zona puestas solas).
// Responde una frase corta que Siri lee en voz alta.

export const maxDuration = 15;

type Tipo = "fuga_riego" | "averia" | "plaga" | "arbol" | "otro";

const NOMBRE_TIPO: Record<Tipo, string> = {
  fuga_riego: "Fuga de agua",
  averia: "Avería",
  plaga: "Plaga",
  arbol: "Árbol a revisar",
  otro: "Incidencia",
};

function tipoDe(v: unknown): Tipo {
  const t = normalizar(String(v ?? ""));
  if (/fuga|gotero|agua|tuberia|riego/.test(t)) return "fuga_riego";
  if (/arbol|seco|replant|arrancar/.test(t)) return "arbol";
  if (/plaga|arana|cotonet|piojo|bicho|mosca/.test(t)) return "plaga";
  if (/averia|roto|motor|bomba|programador|valvula/.test(t)) return "averia";
  return "otro";
}

/** «no», «nada», «listo»… no son nota. */
function notaDe(v: unknown) {
  const s = String(v ?? "").trim();
  return !s || /^(no|nada|ninguna|listo|ya|vale|nada mas|no gracias)\.?$/i.test(normalizar(s)) ? null : s.slice(0, 1000);
}

async function atender(request: Request) {
  const cuerpo = await leerCuerpo(request);
  const u = await usuarioDeAtajo(request, cuerpo);
  if (u instanceof Response) return u;
  if (!u.puedeEditar) return texto("Tu usuario de Campo solo puede consultar: no puedo apuntar la incidencia.");

  const lat = numero(cuerpo.lat ?? cuerpo.latitud);
  const lon = numero(cuerpo.lon ?? cuerpo.lng ?? cuerpo.longitud);
  if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return texto("No me ha llegado tu ubicación. Revisa que el atajo tenga permiso para usarla.");
  }
  const precision = numero(cuerpo.precision);
  const tipo = tipoDe(cuerpo.tipo);
  const nota = notaDe(cuerpo.nota);

  const donde = ubicar(lat, lon);
  if (!donde.enFinca) {
    return texto(
      `No estás en ninguna finca: la más cercana es ${donde.finca}, ${textoDistancia(donde.distanciaFincaM)}. No he apuntado nada.`,
    );
  }

  const { data: finca } = await u.admin
    .from("fincas")
    .select("id, nombre, zonas(id, nombre)")
    .eq("nombre", donde.finca)
    .maybeSingle<{ id: string; nombre: string; zonas: { id: string; nombre: string }[] }>();
  if (!finca) return texto(`No encuentro la finca ${donde.finca} en Campo.`);
  const zona = donde.zona ? finca.zonas.find((z) => normalizar(z.nombre) === normalizar(donde.zona!)) : undefined;

  const titulo = `${NOMBRE_TIPO[tipo]}${zona ? ` · ${zona.nombre}` : ""}`;
  const { error } = await u.admin.from("incidencias").insert({
    finca_id: finca.id,
    zona_id: zona?.id ?? null,
    tipo,
    titulo,
    descripcion: nota,
    severidad: tipo === "fuga_riego" || tipo === "averia" ? "media" : "baja",
    estado: "abierta",
    fecha: hoyISO(),
    lat,
    lon,
    precision_m: precision != null && precision >= 0 ? Math.round(precision * 10) / 10 : null,
    geom: `SRID=4326;POINT(${lon} ${lat})`,
    origen: "atajo",
    created_by: u.userId,
  });
  if (error) {
    console.error("[atajo incidencia]", error.message);
    return texto("No he podido guardar la incidencia en Campo. Prueba otra vez en un rato.");
  }

  const sitio = zona ? `${finca.nombre}, zona ${zona.nombre}` : finca.nombre;
  return texto(`${NOMBRE_TIPO[tipo]} apuntada en ${sitio}.${nota ? " Con tu nota." : ""}`);
}

export const POST = atender;
export const GET = atender;
