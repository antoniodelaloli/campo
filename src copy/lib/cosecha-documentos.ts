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
