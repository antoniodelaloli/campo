import "server-only";
import type { Finca } from "@/lib/datos";
import { TIPOS_HITO } from "@/lib/agenda";
import { esFechaISO, fechaLarga } from "@/lib/texto";

/*
 * Repartidor del atajo «Cuaderno».
 * Juan Carlos dicta lo que sea, mezclando cosas. Claude (API de Anthropic)
 * trocea lo dicho y dice, de cada trozo, a dónde va y qué es:
 *   - campo      → se guarda en Campo (tarea, fecha clave, diario, idea, incidencia)
 *   - personal   → su cuaderno personal (fuera de Campo)
 *   - confiteria → la confitería y cafeterías: también a su cuaderno personal,
 *                  marcado como confitería, para revisarlo de vez en cuando
 *   - dudoso     → no está claro si es del campo o personal: va a lo personal,
 *                  que es suyo, para que nada privado acabe a la vista de la familia
 * Si el iPhone manda su ubicación y está en una finca, «aquí» es esa finca.
 * Las instrucciones son fijas: siempre ordena igual.
 */

export const MODELO_REPARTIDOR = process.env.ANTHROPIC_MODEL_REPARTIDOR || "claude-haiku-5-5";

export type Destino = "campo" | "personal" | "confiteria" | "dudoso";
export type TipoTrozo = "tarea" | "fecha_clave" | "nota_diario" | "idea" | "incidencia";

export type Trozo = {
  destino: Destino;
  tipo: TipoTrozo;
  /** resumen de una línea */
  titulo: string;
  /** lo que dijo de esto, completo y con sus palabras */
  texto: string;
  /** nombre exacto de la finca de la lista, o null */
  finca: string | null;
  /** nombre exacto de la zona de la lista, o null */
  zona: string | null;
  /** AAAA-MM-DD o null */
  fecha: string | null;
  /** la fecha es «más o menos» */
  fecha_aproximada: boolean;
  tipo_tarea: "riego" | "tratamiento" | "poda" | "revision" | "mantenimiento" | "cosecha" | "administrativa" | "otro";
  tipo_hito: string;
  tipo_incidencia: "fuga_riego" | "averia" | "plaga" | "arbol" | "piscina" | "otro";
  tipo_idea: "idea" | "reflexion" | "duda" | "plan" | "aprendizaje";
  /** false si no está claro qué es, de qué finca o para cuándo */
  claro: boolean;
};

const HERRAMIENTA = {
  name: "repartir",
  description: "Devuelve lo dictado troceado: un elemento por cada cosa distinta que haya dicho.",
  input_schema: {
    type: "object",
    properties: {
      trozos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            destino: { type: "string", enum: ["campo", "personal", "confiteria", "dudoso"] },
            tipo: { type: "string", enum: ["tarea", "fecha_clave", "nota_diario", "idea", "incidencia"] },
            titulo: { type: "string", description: "Resumen de una línea, en español" },
            texto: { type: "string", description: "Lo que dijo sobre esto, completo y con sus palabras" },
            finca: { type: ["string", "null"], description: "Nombre EXACTO de la lista de fincas, o null" },
            zona: { type: ["string", "null"], description: "Nombre EXACTO de la lista de zonas, o null" },
            fecha: { type: ["string", "null"], description: "AAAA-MM-DD, o null si no dijo fecha" },
            fecha_aproximada: { type: "boolean" },
            tipo_tarea: {
              type: "string",
              enum: ["riego", "tratamiento", "poda", "revision", "mantenimiento", "cosecha", "administrativa", "otro"],
            },
            tipo_hito: { type: "string", enum: TIPOS_HITO },
            tipo_incidencia: { type: "string", enum: ["fuga_riego", "averia", "plaga", "arbol", "piscina", "otro"] },
            tipo_idea: { type: "string", enum: ["idea", "reflexion", "duda", "plan", "aprendizaje"] },
            claro: { type: "boolean", description: "false si dudas de qué es, de qué finca o para cuándo" },
          },
          required: [
            "destino",
            "tipo",
            "titulo",
            "texto",
            "finca",
            "zona",
            "fecha",
            "fecha_aproximada",
            "tipo_tarea",
            "tipo_hito",
            "tipo_incidencia",
            "tipo_idea",
            "claro",
          ],
        },
      },
    },
    required: ["trozos"],
  },
} as const;

export type Aqui = { finca: string; zona: string | null } | null;

function instrucciones(fincas: Finca[], hoy: string, aqui: Aqui) {
  const lista = fincas
    .map((f) => {
      const zonas = f.zonas
        .map((z) => (z.alias?.length ? `${z.nombre} (también «${z.alias.join("», «")}»)` : z.nombre))
        .join("; ");
      const alias = f.alias?.length ? ` (también «${f.alias.join("», «")}»)` : "";
      return `- ${f.nombre}${alias}. Zonas: ${zonas || "sin zonas"}.`;
    })
    .join("\n");

  return `Eres el repartidor del cuaderno de Juan Carlos («Carlos»), agricultor de Murcia. Te llega lo que ha dictado a Siri, sin puntuación y a veces divagando. Trocéalo y llama a «repartir» con un trozo por cada cosa distinta.

Hoy es ${fechaLarga(hoy)}, ${hoy}. Convierte «mañana», «el jueves», «el 15» a AAAA-MM-DD (siempre hacia delante).
${aqui ? `Ahora mismo está en la finca ${aqui.finca}${aqui.zona ? `, zona ${aqui.zona}` : ""}. Si dice «aquí» o habla del campo sin decir qué finca, es esa${aqui.zona ? " y esa zona" : ""}.` : "No se sabe dónde está: si no dice la finca, finca = null."}

DESTINO de cada trozo:
- campo: las fincas de limoneros de la familia y su trabajo (riego, pantanos, contadores, fumigar, podar, cortes y cosecha, Citrisol y otros compradores, trabajadores como Pencho o Salah, el técnico Diego Vélez, la Comunidad de Regantes, CHS, SIGPAC, PAC, papeles y facturas de las fincas, nóminas del campo).
- personal: su vida y su dinero propio (cuentas, inversiones, pisos y bienes que no son las fincas, médicos, familia, compras, viajes).
- confiteria: la confitería y cafeterías Maite y 1968 (tiendas, obrador, ventas de los locales).
- dudoso: si no puedes saber si es del campo o personal. Ojo: «Maite» puede ser la confitería o su hermana, socia de una finca.

TIPO (solo importa si el destino es campo, pero rellénalo siempre):
- tarea: algo que hay que hacer, con o sin fecha.
- fecha_clave: una fecha importante de la campaña (un corte, un plazo de papeles, una revisión) que conviene que avise antes.
- nota_diario: algo que ya ha pasado o que ha visto hoy. Los niveles de pantano y lecturas de contador también van aquí, con sus cifras.
- incidencia: una fuga, una avería, una plaga, un árbol a revisar.
- idea: una idea, reflexión, duda, plan o algo aprendido, sin fecha ni trabajo concreto.

FINCAS Y ZONAS (usa SOLO estos nombres exactos; si no dice cuál, null):
${lista}

SIRI ESCRIBE MAL ALGUNOS NOMBRES: «Valladolid» o «Valladolides» es Valladolises; «Los Bolsillos», «Lo Bosillo» o «Lobosillos» es Lobosillo; «Corbera» es Corvera.

REGLAS:
- No inventes nada que no haya dicho. Si no dice fecha, fecha = null.
- «texto» lleva sus palabras sobre esa cosa, sin resumir ni corregir.
- Si en la misma frase cuenta algo que ha pasado y algo que hay que hacer, son DOS trozos: una nota_diario con lo que pasó y una tarea con lo que hay que hacer (por ejemplo: «hay caracol, hemos encargado sacos para repetir mañana» = nota_diario + tarea para mañana).
- claro = true casi siempre. Que no diga fecha NO es dudar (fecha = null y claro = true). Que no diga finca en una gestión, una llamada o un papel tampoco.
- claro = false SOLO si de verdad no se entiende qué quiere, o si es algo de una finca concreta (una avería, un riego, una plaga) y no se sabe de cuál.
- Ignora muletillas, saludos y frases sin contenido («bueno», «a ver», «eso es todo»).
- Si no hay nada que guardar, devuelve trozos vacío.`;
}

type RespuestaApi = {
  content?: { type: string; name?: string; input?: { trozos?: unknown } }[];
  error?: { message?: string };
};

/** Pide a Claude el reparto. Lanza un error si la API falla o no hay clave. */
export async function repartir(texto: string, fincas: Finca[], hoy: string, aqui: Aqui = null): Promise<Trozo[]> {
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) throw new Error("Falta ANTHROPIC_API_KEY");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": clave,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO_REPARTIDOR,
      max_tokens: 4000,
      system: instrucciones(fincas, hoy, aqui),
      tools: [HERRAMIENTA],
      tool_choice: { type: "tool", name: "repartir" },
      messages: [{ role: "user", content: texto }],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const datos = (await r.json().catch(() => ({}))) as RespuestaApi;
  if (!r.ok) throw new Error(`API de Claude ${r.status}: ${datos.error?.message ?? "sin detalle"}`);

  const llamada = datos.content?.find((b) => b.type === "tool_use" && b.name === "repartir");
  const trozos = llamada?.input?.trozos;
  if (!Array.isArray(trozos)) throw new Error("Claude no devolvió el reparto");
  return trozos.map(limpiar).filter((t): t is Trozo => t !== null);
}

const DESTINOS: Destino[] = ["campo", "personal", "confiteria", "dudoso"];
const TIPOS: TipoTrozo[] = ["tarea", "fecha_clave", "nota_diario", "idea", "incidencia"];

/** Revisa lo que llega de la IA: nada de valores fuera de lo previsto. */
function limpiar(v: unknown): Trozo | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  const titulo = s(o.titulo);
  const texto = s(o.texto) ?? titulo;
  if (!titulo || !texto) return null;
  const fecha = s(o.fecha);
  const en = <T extends string>(x: unknown, valores: readonly T[], porDefecto: T): T =>
    valores.includes(x as T) ? (x as T) : porDefecto;
  return {
    destino: en(o.destino, DESTINOS, "dudoso"),
    tipo: en(o.tipo, TIPOS, "idea"),
    titulo: titulo.slice(0, 200),
    texto: texto.slice(0, 2000),
    finca: s(o.finca),
    zona: s(o.zona),
    fecha: fecha && esFechaISO(fecha) ? fecha : null,
    fecha_aproximada: o.fecha_aproximada === true,
    tipo_tarea: en(
      o.tipo_tarea,
      ["riego", "tratamiento", "poda", "revision", "mantenimiento", "cosecha", "administrativa", "otro"] as const,
      "otro",
    ),
    tipo_hito: en(o.tipo_hito, TIPOS_HITO as string[], "otro"),
    tipo_incidencia: en(o.tipo_incidencia, ["fuga_riego", "averia", "plaga", "arbol", "piscina", "otro"] as const, "otro"),
    tipo_idea: en(o.tipo_idea, ["idea", "reflexion", "duda", "plan", "aprendizaje"] as const, "idea"),
    claro: o.claro !== false,
  };
}

export const NOMBRE_TROZO: Record<TipoTrozo, [string, string]> = {
  tarea: ["una tarea", "tareas"],
  fecha_clave: ["una fecha clave", "fechas clave"],
  nota_diario: ["una nota en el diario", "notas en el diario"],
  idea: ["una idea", "ideas"],
  incidencia: ["una incidencia", "incidencias"],
};

