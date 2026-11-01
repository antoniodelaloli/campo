/*
 * Cifras de cosecha COPIADAS DE DOCUMENTOS (todavía no hay tabla de cosecha en la base de datos;
 * llegará con la migración 0002). No se corrige ninguna cifra: si dos fuentes no cuadran,
 * se enseñan las dos con su origen.
 */

export type FilaCosecha = {
  finca: string;
  kgTotal: number;
  kgLiquidables: number;
  kgComercial: number;
  kgCitrica: number;
  kgRodrejos: number;
  importeEur: number;
  nota?: string;
};

export const LIQUIDACION_2526 = {
  campana: "2025/26",
  fuente: "Liquidación de la campaña 25/26 (carpeta de Drive «Campaña 25/26 conjunta»)",
  precioEurKg: 0.582,
  filas: [
    {
      finca: "Corvera",
      kgTotal: 1_012_231,
      kgLiquidables: 1_008_771,
      kgComercial: 769_343,
      kgCitrica: 239_328,
      kgRodrejos: 3_460,
      importeEur: 587_104.72,
      nota: "Las categorías suman 100 kg menos que el total.",
    },
    {
      finca: "Valladolises",
      kgTotal: 842_025,
      kgLiquidables: 837_368,
      kgComercial: 784_761,
      kgCitrica: 52_607,
      kgRodrejos: 4_657,
      importeEur: 487_347.18,
      nota: "Liquidada en tres periodos de recolección.",
    },
  ] satisfies FilaCosecha[],
};

export const CUENTAS_TIO_2526 = {
  fuente: "Documento de la familia (cifras cerradas el 10/08/2026)",
  filas: [
    { finca: "Corvera", kgTotal: 1_270_517, kgBuenos: 814_486, kgDestrio: 456_031 },
    { finca: "Valladolises", kgTotal: 761_525, kgBuenos: 652_582, kgDestrio: 108_003 },
  ],
  nota: "Usa «buenos / destrío», que no tiene por qué equivaler a «comercial / cítrica» de la liquidación.",
};

export const CONTRATO_MANDARINAS_2024 = {
  finca: "Valladolises",
  precioEurKg: 0.35,
  descuentoDaniada: 3,
  corte: "10/01/2024 – 05/02/2024",
  nota: "Borrador con el comprador sin rellenar.",
};

/*
 * ESTIMACIÓN de la campaña 2026/27. No son datos: es una cuenta con supuestos,
 * que se irá afinando con los cortes y albaranes reales.
 */
export const DESCUENTOS_CONTRATO_2627 = {
  destrioGlobal: 0.03,
  comisionCorredor: 0.03,
};

export const ESTIMACION_2627 = (() => {
  const base = LIQUIDACION_2526;
  const precioReferencia = base.precioEurKg; // supuesto: la referencia de la Consejería repite la de 25/26
  const precioEurKg =
    precioReferencia * (1 - DESCUENTOS_CONTRATO_2627.destrioGlobal) * (1 - DESCUENTOS_CONTRATO_2627.comisionCorredor);
  return {
    campana: "2026/27",
    precioReferencia,
    precioEurKg,
    margen: 0.15, // horquilla de ±15 % en los kilos
    filas: base.filas.map((f) => ({
      ...f,
      importeEur: f.kgLiquidables * precioEurKg,
      nota: undefined,
    })) satisfies FilaCosecha[],
    supuestos: [
      "Los árboles dan los mismos kilos que en 25/26 (horquilla de ±15 %).",
      "La misma parte de fruta de primera que en 25/26.",
      `Precio de referencia de la Consejería igual que en 25/26 (${base.precioEurKg.toLocaleString("es-ES")} €/kg), menos el 3 % de destrío global y el 3 % de comisión del corredor del contrato 2026/27.`,
      "Mismos árboles y hectáreas que hay apuntados ahora.",
    ],
    cambiaria: [
      "La analítica de residuos y la fecha real del primer corte de Valladolises.",
      "El precio medio que publique la Consejería («un corte» y luego «todo limón»).",
      "Los kilos de cada corte cuando lleguen los albaranes de báscula.",
    ],
  };
})();
