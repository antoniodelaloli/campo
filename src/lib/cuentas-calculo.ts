// Cálculos de cuentas sin dependencias (sirven en servidor y en el navegador).

export type Titular = {
  id: string;
  nombre: string;
  nombre_completo: string | null;
  tipo: "persona" | "sociedad";
  limite_eur: number;
  tope_seguridad_eur: number;
  aviso_pct: number;
  notas: string | null;
};

export type Factura = {
  id: string;
  tipo: "venta" | "gasto";
  estado: "emitida" | "prevista";
  titular_id: string;
  finca_id: string | null;
  campana: string | null;
  fecha: string;
  numero: string | null;
  contraparte: string | null;
  concepto: string | null;
  kg: number | null;
  base_eur: number;
  impuesto_eur: number;
  total_eur: number;
  cuenta_limite: boolean;
  notas: string | null;
};

export type EstadoLimite = "bien" | "aviso" | "tope" | "pasado";

export type SituacionTitular = Titular & {
  /** ventas emitidas que cuentan para el límite (base, sin impuestos) */
  facturado: number;
  /** ventas previstas (cortes que faltan) */
  previsto: number;
  /** lo que queda hasta el tope de seguridad */
  margenTope: number;
  estado: EstadoLimite;
  estadoConPrevistas: EstadoLimite;
};

export function estadoDe(t: Titular, importe: number): EstadoLimite {
  if (importe > t.limite_eur) return "pasado";
  if (importe > t.tope_seguridad_eur) return "tope";
  if (importe >= (t.aviso_pct / 100) * t.limite_eur) return "aviso";
  return "bien";
}

export function situacion(titulares: Titular[], facturas: Factura[]): SituacionTitular[] {
  return titulares.map((t) => {
    const ventas = facturas.filter((f) => f.titular_id === t.id && f.tipo === "venta" && f.cuenta_limite);
    const facturado = ventas.filter((f) => f.estado === "emitida").reduce((s, f) => s + f.base_eur, 0);
    const previsto = ventas.filter((f) => f.estado === "prevista").reduce((s, f) => s + f.base_eur, 0);
    return {
      ...t,
      facturado,
      previsto,
      margenTope: t.tope_seguridad_eur - facturado - previsto,
      estado: estadoDe(t, facturado),
      estadoConPrevistas: estadoDe(t, facturado + previsto),
    };
  });
}

/** Campaña de una fecha (mayo a abril): «2026/27». */
export function campanaDeFecha(fecha: string) {
  const y = Number(fecha.slice(0, 4));
  const ini = Number(fecha.slice(5, 7)) >= 5 ? y : y - 1;
  return `${ini}/${String(ini + 1).slice(2)}`;
}

/** Colores y nombres de cada estado del límite. */
export const COLOR_ESTADO: Record<EstadoLimite, { fondo: string; texto: string; etiqueta: string }> = {
  bien: { fondo: "#5a9a2e", texto: "#2f5a12", etiqueta: "Bien" },
  aviso: { fondo: "#d4a20a", texto: "#7a5a00", etiqueta: "Cerca" },
  tope: { fondo: "#d9731f", texto: "#7a3a00", etiqueta: "Pasa el tope de seguridad" },
  pasado: { fondo: "#c8473a", texto: "#7d1a10", etiqueta: "Pasa el límite" },
};
