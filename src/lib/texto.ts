// Utilidades puras (sirven en servidor y en cliente).

export const ZONA_HORARIA = "Europe/Madrid";

/** minúsculas, sin tildes, sin espacios dobles */
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fecha de hoy en Madrid como "YYYY-MM-DD". */
export function hoyISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

/** true si "YYYY-MM-DD" es una fecha que existe (no 31 de febrero). */
export function esFechaISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Días entre dos fechas ISO (b − a). */
export function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/** Día de la semana (0 = domingo) de una fecha ISO. */
function diaSemana(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "sábado 31 de octubre" */
export function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "31/10" o "31/10/2025" si no es de este año */
export function fechaCorta(iso: string | null, hoy?: string): string {
  if (!iso) return "Sin fecha";
  const [y, m, d] = iso.slice(0, 10).split("-");
  const mismoAnio = hoy ? hoy.slice(0, 4) === y : false;
  return mismoAnio ? `${Number(d)}/${Number(m)}` : `${Number(d)}/${Number(m)}/${y}`;
}

/** Etiqueta amable: Hoy, Mañana, Ayer, o fecha corta */
export function cuandoAmable(iso: string | null, hoy: string): string {
  if (!iso) return "Sin fecha";
  if (iso === hoy) return "Hoy";
  if (iso === sumarDias(hoy, 1)) return "Mañana";
  if (iso === sumarDias(hoy, -1)) return "Ayer";
  return fechaCorta(iso, hoy);
}

/** Momento del día en Madrid, para la luz del mapa. */
export function momentoDelDia(ahora: Date = new Date()): "dia" | "atardecer" | "noche" {
  const hora = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONA_HORARIA,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(ahora),
  );
  if (hora >= 8 && hora < 18) return "dia";
  if (hora >= 18 && hora < 20) return "atardecer";
  if (hora >= 7 && hora < 8) return "atardecer";
  return "noche";
}

export function formatoNumero(n: number, decimales = 0): string {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: "always",
  }).format(n);
}

// ------------------------------------------------------------------
// Interpretar una tarea escrita a mano: "regar finca 4 mañana"
// ------------------------------------------------------------------

export type TipoTarea =
  | "riego"
  | "tratamiento"
  | "poda"
  | "revision"
  | "mantenimiento"
  | "cosecha"
  | "administrativa"
  | "otro";

export const NOMBRE_TIPO: Record<TipoTarea, string> = {
  riego: "Riego",
  tratamiento: "Tratamiento",
  poda: "Poda",
  revision: "Revisión",
  mantenimiento: "Mantenimiento",
  cosecha: "Cosecha",
  administrativa: "Papeles",
  otro: "Tarea",
};

const REGLAS_TIPO: [RegExp, TipoTarea][] = [
  [/\b(regar|riego|riega|agua|pantano|contador)/, "riego"],
  [/\b(fumig|tratar|tratamiento|sulfat|atomiz|herbicid|abonar|abono)/, "tratamiento"],
  [/\b(podar|poda|desbrot|chupon)/, "poda"],
  [/\b(revisar|revision|mirar|comprobar|ver si)/, "revision"],
  [/\b(arreglar|reparar|limpiar|limpieza|cambiar|mantenimiento|averia)/, "mantenimiento"],
  [/\b(cortar|corte|cosech|recolect|coger)/, "cosecha"],
  [/\b(llamar|pagar|factura|papeles|chs|seguro|pedir)/, "administrativa"],
];

const DIAS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export type Lugar = {
  tipo: "finca" | "zona" | "sector";
  id: string;
  finca_id: string;
  nombre: string;
  /** nombre de la finca (para mostrar "Del Pozo · Valladolises") */
  finca: string;
  /** textos que lo identifican, ya normalizados */
  claves: string[];
};

export type Interpretacion = {
  tipo: TipoTarea;
  fecha: string | null;
  /** frase de ubicación encontrada en el texto, tal cual (normalizada) */
  frase: string | null;
  /** lugares que encajan con la frase (0 = no se sabe, 1 = claro, 2+ = ambiguo) */
  candidatos: Lugar[];
};

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export function interpretarFecha(t: string, hoy: string): string | null {
  if (/\bpasado manana\b/.test(t)) return sumarDias(hoy, 2);
  if (/\bmanana\b/.test(t)) return sumarDias(hoy, 1);
  if (/\bhoy\b|\besta tarde\b|\besta manana\b/.test(t)) return hoy;
  // "15 de diciembre", "el 3 de enero de 2027"
  const dn = t.match(
    /\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?: (?:de |del )?(\d{4}))?\b/,
  );
  if (dn) {
    const d = Number(dn[1]);
    const m = MESES[dn[2]];
    const y = dn[3] ? Number(dn[3]) : Number(hoy.slice(0, 4));
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (esFechaISO(iso)) {
      if (!dn[3] && iso < hoy) return `${y + 1}${iso.slice(4)}`;
      return iso;
    }
  }
  const dm = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    let y = dm[3] ? Number(dm[3]) : Number(hoy.slice(0, 4));
    if (y < 100) y += 2000;
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (esFechaISO(iso)) {
      // sin año y ya pasada → el año que viene
      if (!dm[3] && iso < hoy) return `${y + 1}${iso.slice(4)}`;
      return iso;
    }
  }
  for (const [nombre, n] of Object.entries(DIAS)) {
    if (new RegExp(`\\b(el )?${nombre}\\b`).test(t)) {
      const hoyN = diaSemana(hoy);
      let diff = (n - hoyN + 7) % 7;
      if (diff === 0) diff = 7;
      return sumarDias(hoy, diff);
    }
  }
  return null;
}

export function interpretarTarea(
  texto: string,
  lugares: Lugar[],
  hoy: string,
): Interpretacion | null {
  const t = normalizar(texto);
  if (!t) return null;

  const tipo = REGLAS_TIPO.find(([re]) => re.test(t))?.[1] ?? "otro";
  const fecha = interpretarFecha(t, hoy);

  // Busca la frase de lugar más larga que aparezca en el texto.
  let mejor: { frase: string; lugares: Lugar[] } | null = null;
  for (const lugar of lugares) {
    for (const clave of lugar.claves) {
      if (!clave) continue;
      const re = new RegExp(`(^|\\s)${clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
      if (!re.test(t)) continue;
      if (!mejor || clave.length > mejor.frase.length) {
        mejor = { frase: clave, lugares: [lugar] };
      } else if (clave === mejor.frase && !mejor.lugares.includes(lugar)) {
        mejor.lugares.push(lugar);
      }
    }
  }

  if (mejor) {
    let candidatos = mejor.lugares;
    // "sector 2" existe en varias fincas: si el texto nombra la finca, se filtra.
    if (candidatos.length > 1) {
      const fincasNombradas = lugares.filter(
        (l) =>
          l.tipo === "finca" &&
          l.claves.some((c) => c && new RegExp(`(^|\\s)${c}(\\s|$)`).test(t)),
      );
      const filtrados = candidatos.filter((c) =>
        fincasNombradas.some((f) => f.finca_id === c.finca_id),
      );
      if (filtrados.length > 0) candidatos = filtrados;
    }
    return { tipo, fecha, frase: mejor.frase, candidatos };
  }

  // "finca 4", "parcela 3"… que todavía no son nombres conocidos
  const desconocida = t.match(/\b(finca|parcela|bancal|trozo)\s+\S+/);
  return { tipo, fecha, frase: desconocida ? desconocida[0] : null, candidatos: [] };
}

/** Título limpio a partir del texto (primera letra en mayúscula). */
export function tituloDeTexto(texto: string): string {
  const s = texto.trim().replace(/\s+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
