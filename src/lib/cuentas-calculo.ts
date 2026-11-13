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
  /** false = no tiene límite de módulos: Chelo (solo socia), los comuneros de Mis Partos y la propia comunidad de bienes (migraciones 0023 y 0025) */
  en_modulos: boolean;
  /** false = no factura a su nombre (Chelo, Blanca, Alejandro): no sale en los desplegables de «Se factura a» */
  factura: boolean;
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
  categoria: string | null;
  archivo_url: string | null;
  notas: string | null;
};

export type EstadoLimite = "bien" | "aviso" | "tope" | "pasado";

/** Socio de una sociedad titular (migración 0021): JHSYO = Maite, Chelo y Carlos, 1/3 cada uno. */
export type Socio = { sociedad_id: string; socio_id: string; participacion: number };

export type SituacionTitular = Titular & {
  /** ventas emitidas que cuentan para el límite (base, sin impuestos): las suyas + las de sus sociedades */
  facturado: number;
  /** ventas previstas (cortes que faltan), también con las de sus sociedades */
  previsto: number;
  /** solo lo facturado a su nombre */
  facturadoPropio: number;
  previstoPropio: number;
  /** sociedades de las que es socio: sus ventas cuentan enteras para su límite */
  sociedades: { id: string; nombre: string; participacion: number; facturado: number; previsto: number }[];
  /** ids de las sociedades (incluida ella misma si es una) a las que afecta una factura a su nombre */
  socios: string[];
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

/**
 * Sin la migración 0023 no existen «en_modulos» ni «factura»: Chelo es la única
 * que ni factura ni está en módulos (Antonio, 7/11/2026: «no factura ella sola,
 * solo aparece en la SL»).
 */
export function enModulosPorDefecto(t: { nombre: string; tipo: string }) {
  return !(t.tipo === "persona" && t.nombre.trim().toLowerCase() === "chelo");
}
export const facturaPorDefecto = enModulosPorDefecto;

/**
 * Cómo va cada titular frente al límite. A cada socio se le suman las ventas
 * enteras de las sociedades de las que es socio (Antonio, 5/11/2026: «suma la
 * sociedad + el personal»). Los que no están en módulos (Chelo) no salen: no
 * tienen límite, aunque sigan siendo socios para el reparto. Las sociedades que
 * no están en módulos (Mis Partos, C.B., Antonio 13/11/2026) no suman a sus socios.
 */
export function situacion(titulares: Titular[], facturas: Factura[], socios: Socio[] = []): SituacionTitular[] {
  const enModulos = new Set(titulares.filter((t) => t.en_modulos).map((t) => t.id));
  const propio = (id: string) => {
    const ventas = facturas.filter((f) => f.titular_id === id && f.tipo === "venta" && f.cuenta_limite);
    return {
      facturado: ventas.filter((f) => f.estado === "emitida").reduce((s, f) => s + f.base_eur, 0),
      previsto: ventas.filter((f) => f.estado === "prevista").reduce((s, f) => s + f.base_eur, 0),
    };
  };
  return titulares.filter((t) => t.en_modulos).map((t) => {
    const mio = propio(t.id);
    const sociedades = socios
      .filter((x) => x.socio_id === t.id && enModulos.has(x.sociedad_id))
      .map((x) => {
        const soc = titulares.find((y) => y.id === x.sociedad_id);
        return { id: x.sociedad_id, nombre: soc?.nombre ?? "—", participacion: x.participacion, ...propio(x.sociedad_id) };
      });
    const facturado = mio.facturado + sociedades.reduce((s, x) => s + x.facturado, 0);
    const previsto = mio.previsto + sociedades.reduce((s, x) => s + x.previsto, 0);
    return {
      ...t,
      facturado,
      previsto,
      facturadoPropio: mio.facturado,
      previstoPropio: mio.previsto,
      sociedades,
      // una factura a nombre de una sociedad sube también a todos sus socios
      // (solo los que están en módulos)
      socios: socios.filter((x) => x.sociedad_id === t.id && enModulos.has(x.socio_id)).map((x) => x.socio_id),
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

/** Tipos de gasto (migración 0015). */
export const CATEGORIAS_GASTO: Record<string, string> = {
  agua: "Agua",
  abonos: "Abonos",
  productos: "Productos (tratamientos)",
  mano_obra: "Mano de obra",
  luz: "Luz",
  gasoil: "Gasoil",
  maquinaria: "Maquinaria y reparaciones",
  alquiler: "Alquiler",
  seguros: "Seguros",
  gestoria: "Gestoría",
  otros: "Otros",
};
