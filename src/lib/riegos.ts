import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sumarDias } from "@/lib/texto";

/*
 * Riegos pedidos a la Comunidad de Regantes (talones de riego, migración 0013) y
 * cuentas del agua: lo gastado por campaña y por año fiscal, la comparación con el
 * año pasado a estas fechas y si el agua pedida ha llegado (contador de entrada).
 *
 * Campaña del limonero: de mayo a abril (como un curso escolar). Así la explica
 * Juan Carlos (idea del 4/11/2026): la campaña 2026/27 va del 1/5/2026 al 30/4/2027.
 * Año fiscal: de enero a diciembre (para Hacienda y los módulos).
 *
 * Cesiones: algunas arquetas no riegan Valladolises. La 22.31.2 enlaza con la
 * tubería de un vecino: es agua de nuestro cupo que se le cede y que paga él
 * (Antonio, 17/11/2026). Se ve en la lista y por arqueta, pero no cuenta como
 * agua ni gasto de la finca, ni en la comparación con el año pasado.
 */

/** Arquetas que no son agua de la finca, con su explicación. */
export const ARQUETAS_CESION: Record<string, string> = {
  "22.31.2": "Cesión al vecino: entra por su tubería y la paga él",
};

export function esCesion(arqueta: string | null | undefined) {
  return !!arqueta && arqueta in ARQUETAS_CESION;
}

export type Riego = {
  id: string;
  finca_id: string;
  fecha: string;
  talon: string;
  arqueta: string | null;
  precio_eur_m3: number | null;
  volumen_m3: number;
  coste_eur: number;
  proveedor: string | null;
  /** agua cedida a otro (no cuenta como agua ni gasto de la finca) */
  cesion: boolean;
};

export type PagoAgua = { id: string; finca_id: string; fecha: string; importe_eur: number };

export async function cargarRiegos(supabase: SupabaseClient) {
  const [r, p] = await Promise.all([
    supabase
      .from("suministros_agua")
      .select("id, finca_id, fecha, talon, arqueta, precio_eur_m3, volumen_m3, coste_eur, proveedor")
      .not("talon", "is", null)
      .eq("anulado", false)
      .order("fecha", { ascending: true })
      .limit(5000),
    supabase
      .from("pagos_agua")
      .select("id, finca_id, fecha, importe_eur")
      .eq("anulado", false)
      .order("fecha", { ascending: true })
      .limit(1000),
  ]);
  // sin la migración 0013, las columnas o la tabla no existen: se avisa
  const falta = !!r.error || !!p.error;
  const riegos: Riego[] = (r.data ?? []).map((x) => ({
    ...x,
    precio_eur_m3: x.precio_eur_m3 != null ? Number(x.precio_eur_m3) : null,
    volumen_m3: Number(x.volumen_m3 ?? 0),
    coste_eur: Number(x.coste_eur ?? 0),
    cesion: esCesion(x.arqueta),
  }));
  const pagos: PagoAgua[] = (p.data ?? []).map((x) => ({ ...x, importe_eur: Number(x.importe_eur) }));
  return { riegos, pagos, falta };
}

// ------------------------------------------------------------------
// Campañas
// ------------------------------------------------------------------

/** Año en que empieza la campaña de una fecha (mayo a abril). */
export function inicioCampana(fecha: string) {
  const y = Number(fecha.slice(0, 4));
  return Number(fecha.slice(5, 7)) >= 5 ? y : y - 1;
}

/** «2026/27» */
export function nombreCampana(inicio: number) {
  return `${inicio}/${String(inicio + 1).slice(2)}`;
}

/** La misma fecha un año antes (el 29 de febrero pasa a 28). */
function haceUnAnio(fecha: string) {
  const y = Number(fecha.slice(0, 4)) - 1;
  const md = fecha.slice(5) === "02-29" ? "02-28" : fecha.slice(5);
  return `${y}-${md}`;
}

function sumar(riegos: Riego[], desde: string, hasta: string) {
  let m3 = 0;
  let eur = 0;
  let n = 0;
  for (const r of riegos) {
    if (r.cesion || r.fecha < desde || r.fecha > hasta) continue;
    m3 += r.volumen_m3;
    eur += r.coste_eur;
    n++;
  }
  return { m3, eur, n };
}

export type ResumenAgua = {
  campana: string;
  /** desde el 1 de mayo hasta hoy */
  actual: { m3: number; eur: number; n: number; desde: string; hasta: string };
  /** comparación con el año pasado a estas fechas (mismo tramo de días) */
  comparacion: {
    desde: string;
    hasta: string;
    esteAnio: { m3: number; eur: number };
    anioPasado: { m3: number; eur: number };
    /** el tramo es más corto que la campaña porque no hay datos más antiguos */
    recortada: boolean;
  } | null;
  /** campaña anterior entera (o lo que haya de ella) */
  anterior: { campana: string; m3: number; eur: number; desde: string; completa: boolean } | null;
  fiscal: { anio: number; m3: number; eur: number; desdeDatos: string | null };
  precioActual: number | null;
  primerDato: string | null;
  ultimoDato: string | null;
};

export function resumenAgua(riegos: Riego[], hoy: string): ResumenAgua {
  const ini = inicioCampana(hoy);
  const desde = `${ini}-05-01`;
  const actual = { ...sumar(riegos, desde, hoy), desde, hasta: hoy };
  const primerDato = riegos[0]?.fecha ?? null;
  const ultimoDato = riegos.at(-1)?.fecha ?? null;

  // Año pasado a estas fechas: del 1 de mayo del año pasado hasta hoy hace un año.
  // Si los datos empiezan más tarde, se recortan los dos tramos para comparar lo mismo.
  let comparacion: ResumenAgua["comparacion"] = null;
  const desdePasado = `${ini - 1}-05-01`;
  const hastaPasado = haceUnAnio(hoy);
  if (primerDato && primerDato <= hastaPasado) {
    const desdeP = primerDato > desdePasado ? primerDato : desdePasado;
    const desdeE = `${Number(desdeP.slice(0, 4)) + 1}-${desdeP.slice(5)}`;
    const e = sumar(riegos, desdeE, hoy);
    const p = sumar(riegos, desdeP, hastaPasado);
    comparacion = {
      desde: desdeE,
      hasta: hoy,
      esteAnio: { m3: e.m3, eur: e.eur },
      anioPasado: { m3: p.m3, eur: p.eur },
      recortada: desdeP > desdePasado,
    };
  }

  let anterior: ResumenAgua["anterior"] = null;
  const ant = sumar(riegos, desdePasado, `${ini}-04-30`);
  if (ant.n > 0) {
    anterior = {
      campana: nombreCampana(ini - 1),
      m3: ant.m3,
      eur: ant.eur,
      desde: primerDato && primerDato > desdePasado ? primerDato : desdePasado,
      completa: !!primerDato && primerDato <= desdePasado,
    };
  }

  const anio = Number(hoy.slice(0, 4));
  const f = sumar(riegos, `${anio}-01-01`, `${anio}-12-31`);
  const precios = riegos.filter((r) => r.precio_eur_m3 != null && !r.cesion);

  return {
    campana: nombreCampana(ini),
    actual,
    comparacion,
    anterior,
    fiscal: {
      anio,
      m3: f.m3,
      eur: f.eur,
      desdeDatos: primerDato && primerDato > `${anio}-01-01` ? primerDato : null,
    },
    precioActual: precios.at(-1)?.precio_eur_m3 ?? null,
    primerDato,
    ultimoDato,
  };
}

/** m³ y € por mes (AAAA-MM), de los últimos `meses` meses hasta hoy. */
export function porMes(riegos: Riego[], hoy: string, meses = 15) {
  const lista: { mes: string; m3: number; eur: number; n: number }[] = [];
  let y = Number(hoy.slice(0, 4));
  let m = Number(hoy.slice(5, 7));
  for (let i = 0; i < meses; i++) {
    lista.unshift({ mes: `${y}-${String(m).padStart(2, "0")}`, m3: 0, eur: 0, n: 0 });
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  const idx = new Map(lista.map((x, i) => [x.mes, i]));
  for (const r of riegos) {
    if (r.cesion) continue;
    const i = idx.get(r.fecha.slice(0, 7));
    if (i == null) continue;
    lista[i].m3 += r.volumen_m3;
    lista[i].eur += r.coste_eur;
    lista[i].n++;
  }
  return lista;
}

/** m³ por arqueta (toma), para ver por dónde entra el agua. */
export function porArqueta(riegos: Riego[]) {
  const m = new Map<string, { m3: number; eur: number; n: number; desde: string; hasta: string }>();
  for (const r of riegos) {
    const k = r.arqueta ?? "sin arqueta";
    const a = m.get(k) ?? { m3: 0, eur: 0, n: 0, desde: r.fecha, hasta: r.fecha };
    a.m3 += r.volumen_m3;
    a.eur += r.coste_eur;
    a.n++;
    if (r.fecha < a.desde) a.desde = r.fecha;
    if (r.fecha > a.hasta) a.hasta = r.fecha;
    m.set(k, a);
  }
  return [...m.entries()].map(([arqueta, v]) => ({ arqueta, ...v })).sort((a, b) => b.m3 - a.m3);
}

// ------------------------------------------------------------------
// Resumen de una campaña entera (o de lo que va de ella)
// ------------------------------------------------------------------

/** Un pedido de este tamaño o más suele ser para llenar el embalse. */
export const M3_EMBALSE = 2500;
/** Un pedido tan pequeño es raro (¿turno que no llegó a regar?). */
export const M3_RARO = 200;

type Suma = { m3: number; eur: number; n: number };

export type ResumenCampana = {
  campana: string;
  inicio: number;
  desde: string;
  /** 30 de abril, o hoy si la campaña sigue abierta */
  hasta: string;
  cerrada: boolean;
  /** hay datos desde el 1 de mayo */
  completa: boolean;
  /** agua de la finca (sin cesiones) */
  propios: Suma;
  cesion: Suma;
  precioMedio: number | null;
  /** precios distintos en orden: [0.34, 0.32] */
  precios: { precio: number; desde: string }[];
  /** de mayo a abril (hasta hoy si sigue abierta) */
  meses: { mes: string; m3: number; eur: number; n: number }[];
  /** los dos meses con más agua y qué parte de la campaña suponen */
  fuertes: { meses: string[]; m3: number; parte: number } | null;
  /** meses ya pasados en los que no se pidió agua */
  sinPedir: string[];
  embalse: number;
  raros: Riego[];
  ingresos: { n: number; eur: number };
  /** € ahorrados (+) o de más (−) por el precio frente a la campaña anterior */
  ahorroPrecio: number | null;
};

function precioMedio(l: Riego[]) {
  const v = l.reduce((s, x) => s + x.volumen_m3, 0);
  return v ? l.reduce((s, x) => s + x.coste_eur, 0) / v : null;
}

export function resumenCampana(riegos: Riego[], pagos: PagoAgua[], inicio: number, hoy: string): ResumenCampana {
  const desde = `${inicio}-05-01`;
  const fin = `${inicio + 1}-04-30`;
  const cerrada = hoy > fin;
  const hasta = cerrada ? fin : hoy;
  const deEsta = riegos.filter((r) => r.fecha >= desde && r.fecha <= fin);
  const propios = deEsta.filter((r) => !r.cesion);
  const cesiones = deEsta.filter((r) => r.cesion);
  const suma = (l: Riego[]): Suma => ({
    m3: l.reduce((s, x) => s + x.volumen_m3, 0),
    eur: l.reduce((s, x) => s + x.coste_eur, 0),
    n: l.length,
  });

  const precios: ResumenCampana["precios"] = [];
  for (const r of propios) {
    if (r.precio_eur_m3 == null) continue;
    if (precios.at(-1)?.precio !== r.precio_eur_m3) precios.push({ precio: r.precio_eur_m3, desde: r.fecha });
  }

  // meses de mayo a abril, hasta el mes de hoy si la campaña sigue abierta
  const meses: ResumenCampana["meses"] = [];
  for (let i = 0; i < 12; i++) {
    const y = inicio + (i >= 8 ? 1 : 0);
    const m = ((4 + i) % 12) + 1;
    const mes = `${y}-${String(m).padStart(2, "0")}`;
    if (mes > hasta.slice(0, 7)) break;
    meses.push({ mes, m3: 0, eur: 0, n: 0 });
  }
  const idx = new Map(meses.map((x, i) => [x.mes, i]));
  for (const r of propios) {
    const i = idx.get(r.fecha.slice(0, 7));
    if (i == null) continue;
    meses[i].m3 += r.volumen_m3;
    meses[i].eur += r.coste_eur;
    meses[i].n++;
  }

  const total = propios.reduce((s, x) => s + x.volumen_m3, 0);
  const top = [...meses].sort((a, b) => b.m3 - a.m3).slice(0, 2).filter((x) => x.m3 > 0);
  const fuertes = top.length && total
    ? {
        meses: top.map((x) => x.mes).sort(),
        m3: top.reduce((s, x) => s + x.m3, 0),
        parte: top.reduce((s, x) => s + x.m3, 0) / total,
      }
    : null;
  const mesHoy = hoy.slice(0, 7);
  const primerDato = riegos[0]?.fecha.slice(0, 7) ?? mesHoy;
  const sinPedir = meses.filter((x) => x.n === 0 && x.mes < mesHoy && x.mes >= primerDato).map((x) => x.mes);

  const pag = pagos.filter((p) => p.fecha >= desde && p.fecha <= fin);
  const anterior = riegos.filter((r) => !r.cesion && r.fecha >= `${inicio - 1}-05-01` && r.fecha < desde);
  const pa = precioMedio(anterior);
  const pe = precioMedio(propios);

  return {
    campana: nombreCampana(inicio),
    inicio,
    desde,
    hasta,
    cerrada,
    completa: !!riegos[0] && riegos[0].fecha <= desde,
    propios: suma(propios),
    cesion: suma(cesiones),
    precioMedio: pe,
    precios,
    meses,
    fuertes,
    sinPedir,
    embalse: propios.filter((r) => r.volumen_m3 >= M3_EMBALSE).length,
    raros: propios.filter((r) => r.volumen_m3 < M3_RARO),
    ingresos: { n: pag.length, eur: pag.reduce((s, p) => s + p.importe_eur, 0) },
    ahorroPrecio: pa != null && pe != null && Math.abs(pa - pe) >= 0.005 ? (pa - pe) * total : null,
  };
}

// ------------------------------------------------------------------
// ¿Llegó toda el agua pedida?
// ------------------------------------------------------------------

export type Lectura = { fecha: string; lectura_m3: number };

export type TramoConciliado = {
  desde: string;
  hasta: string;
  pedidoM3: number;
  medidoM3: number;
  diferenciaM3: number;
  talones: number;
};

/**
 * Compara, entre cada dos lecturas del contador de entrada, los m³ pedidos
 * (talones con fecha posterior a la primera lectura y hasta la segunda) con
 * lo que marca el contador. Si llega menos, puede que alguien se la lleve.
 */
export function conciliar(riegos: Riego[], lecturas: Lectura[]): TramoConciliado[] {
  const ls = [...lecturas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const tramos: TramoConciliado[] = [];
  for (let i = 1; i < ls.length; i++) {
    const a = ls[i - 1];
    const b = ls[i];
    const medido = b.lectura_m3 - a.lectura_m3;
    if (medido < 0) continue; // contador cambiado o lectura mal apuntada
    const s = sumar(riegos, sumarDias(a.fecha, 1), b.fecha);
    if (s.n === 0) continue;
    tramos.push({
      desde: a.fecha,
      hasta: b.fecha,
      pedidoM3: s.m3,
      medidoM3: medido,
      diferenciaM3: medido - s.m3,
      talones: s.n,
    });
  }
  return tramos.reverse();
}
