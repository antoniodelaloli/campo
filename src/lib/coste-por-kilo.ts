// Coste por kilo de limón vendido en una campaña = precio mínimo para no perder.
// Función pura: recibe las facturas de la campaña, los riegos de la Comunidad y
// los kilos y el precio de referencia (de la liquidación o de la estimación).
//
//   coste por kilo = gastos de la campaña / kilos vendidos
//   margen por kilo = precio de venta − coste por kilo
//
// Gastos: las facturas de gasto apuntadas en Cuentas + el agua de la Comunidad de
// Regantes (talones). Las facturas de gasto de tipo «agua» de la Comunidad no se
// suman otra vez (sería contar el agua dos veces).
// Gastos sin finca:
//   - los tratamientos (categoría «productos») van SIEMPRE al 50 % entre
//     Valladolises y Corvera (así lo imputa la familia, 5/11/2026);
//   - el resto se reparte entre las fincas según sus kilos.
// Kilos: los de las facturas de venta de la campaña cuando ya cubren al menos los
// de referencia; mientras falten facturas, los de referencia (liquidación o
// previstos), para no calcular el coste con media cosecha.
import { CATEGORIAS_GASTO, type Factura } from "@/lib/cuentas-calculo";

export type RiegoCoste = { finca_id: string; fecha: string; coste_eur: number };

export type FilaCoste = {
  finca: string;
  gastos: number;
  kilos: number;
  /** kilos de las facturas (true) o de referencia (false) */
  kilosReales: boolean;
  costeKg: number | null;
  precioKg: number | null;
  margenKg: number | null;
};

export type CostePorKilo = {
  campana: string;
  total: FilaCoste;
  fincas: FilaCoste[];
  /** gastos sin finca (todos: los de reparto fijo y los de reparto por kilos) */
  gastosComunes: number;
  /** gastos sin finca repartidos al 50 % (tratamientos) */
  gastosMitad: number;
  /** gastos sin finca repartidos por kilos */
  gastosPorKilos: number;
  porCategoria: { categoria: string; eur: number }[];
  /** tipos de gasto sin nada apuntado todavía */
  faltan: string[];
};

/** Reparto fijo de los gastos sin finca, por categoría. */
export const REPARTO_FIJO: Record<string, Record<string, number>> = {
  productos: { Valladolises: 0.5, Corvera: 0.5 },
};

const esAguaComunidad = (f: Factura) =>
  f.categoria === "agua" && /comunidad|regantes/i.test(`${f.contraparte ?? ""} ${f.concepto ?? ""}`);

export function costePorKilo({
  campana,
  facturas,
  riegos,
  referencia,
  nombreFinca,
}: {
  campana: string;
  facturas: Factura[];
  riegos: RiegoCoste[];
  /** kilos y precio de referencia por finca (liquidación o estimación) */
  referencia: { finca: string; kg: number; precioKg: number }[];
  nombreFinca: Map<string, string>;
}): CostePorKilo {
  const ini = Number(campana.slice(0, 4));
  const desde = `${ini}-05-01`;
  const hasta = `${ini + 1}-04-30`;
  const gastos = facturas.filter((f) => f.tipo === "gasto" && !esAguaComunidad(f));
  const ventas = facturas.filter((f) => f.tipo === "venta" && f.estado === "emitida");
  const aguaCampana = riegos.filter((r) => r.fecha >= desde && r.fecha <= hasta);

  const nombres = [...new Set(referencia.map((r) => r.finca))];
  const gastosDe = (finca: string) =>
    gastos.filter((g) => g.finca_id && nombreFinca.get(g.finca_id) === finca).reduce((s, g) => s + g.base_eur, 0) +
    aguaCampana.filter((r) => nombreFinca.get(r.finca_id) === finca).reduce((s, r) => s + r.coste_eur, 0);

  const filaDe = (finca: string, gastosFinca: number): FilaCoste => {
    const v = ventas.filter((f) => f.finca_id && nombreFinca.get(f.finca_id) === finca && (f.kg ?? 0) > 0);
    const kgReal = v.reduce((s, f) => s + (f.kg ?? 0), 0);
    const ref = referencia.find((r) => r.finca === finca);
    const usarReal = kgReal > 0 && (!ref || kgReal >= ref.kg);
    const kilos = usarReal ? kgReal : (ref?.kg ?? 0);
    const precioKg = usarReal ? v.reduce((s, f) => s + f.base_eur, 0) / kgReal : (ref?.precioKg ?? null);
    // sin ningún gasto apuntado no hay coste que calcular (no es «0 €/kg»)
    const costeKg = kilos > 0 && gastosFinca > 0 ? gastosFinca / kilos : null;
    return {
      finca,
      gastos: gastosFinca,
      kilos,
      kilosReales: usarReal,
      costeKg,
      precioKg,
      margenKg: costeKg != null && precioKg != null ? precioKg - costeKg : null,
    };
  };

  // Gastos sin finca: reparto fijo (tratamientos al 50 %) o por kilos
  const sinFinca = gastos.filter((g) => !g.finca_id);
  const parteFija = new Map<string, number>();
  let gastosMitad = 0;
  let gastosPorKilos = 0;
  for (const g of sinFinca) {
    const reparto = REPARTO_FIJO[g.categoria ?? ""];
    // solo entre las fincas que están en el cálculo; si no hay ninguna, va por kilos
    const presentes = reparto ? Object.entries(reparto).filter(([f]) => nombres.includes(f)) : [];
    const suma = presentes.reduce((s, [, p]) => s + p, 0);
    if (presentes.length && suma > 0) {
      gastosMitad += g.base_eur;
      for (const [f, p] of presentes) parteFija.set(f, (parteFija.get(f) ?? 0) + (g.base_eur * p) / suma);
    } else {
      gastosPorKilos += g.base_eur;
    }
  }
  const gastosComunes = gastosMitad + gastosPorKilos;

  const kgTotalRef = nombres.reduce((s, n) => s + (filaDe(n, 0).kilos || 0), 0);
  const fincas = nombres.map((n) => {
    const base = filaDe(n, 0);
    const parteKilos = kgTotalRef > 0 ? (gastosPorKilos * base.kilos) / kgTotalRef : 0;
    return filaDe(n, gastosDe(n) + (parteFija.get(n) ?? 0) + parteKilos);
  });

  const gTotal = fincas.reduce((s, f) => s + f.gastos, 0) + (kgTotalRef > 0 ? 0 : gastosPorKilos);
  const kTotal = fincas.reduce((s, f) => s + f.kilos, 0);
  const ingresos = fincas.reduce((s, f) => s + (f.precioKg ?? 0) * f.kilos, 0);
  const costeKg = kTotal > 0 && gTotal > 0 ? gTotal / kTotal : null;
  const precioKg = kTotal > 0 ? ingresos / kTotal : null;

  const cat = new Map<string, number>();
  for (const g of gastos) {
    const k = g.categoria ?? "otros";
    cat.set(k, (cat.get(k) ?? 0) + g.base_eur);
  }
  const agua = aguaCampana.reduce((s, r) => s + r.coste_eur, 0);
  if (agua > 0) cat.set("agua", (cat.get("agua") ?? 0) + agua);

  return {
    campana,
    total: {
      finca: "Todas",
      gastos: gTotal,
      kilos: kTotal,
      kilosReales: fincas.every((f) => f.kilosReales),
      costeKg,
      precioKg,
      margenKg: costeKg != null && precioKg != null ? precioKg - costeKg : null,
    },
    fincas,
    gastosComunes,
    gastosMitad,
    gastosPorKilos,
    porCategoria: [...cat.entries()]
      .map(([k, eur]) => ({ categoria: CATEGORIAS_GASTO[k] ?? k, eur }))
      .sort((a, b) => b.eur - a.eur),
    faltan: Object.entries(CATEGORIAS_GASTO)
      .filter(([k]) => !cat.has(k) && !["alquiler", "gestoria", "seguros", "otros"].includes(k))
      .map(([, v]) => v),
  };
}
