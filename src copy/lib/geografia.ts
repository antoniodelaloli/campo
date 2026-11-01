// Situación real de las fincas y forma de sus dibujos.
// Sirve en servidor y en cliente (sin dependencias).

/*
 * Coordenadas en UTM huso 30 (ETRS89), en metros.
 * - Corvera y Valladolises: centro aproximado de sus parcelas según los certificados catastrales.
 * - Lobosillo: punto de Google Maps compartido por la familia (37.718050, -1.079767).
 * El mapa usa metros: x = este, y = sur (crece hacia abajo, como la pantalla).
 */
export const ORIGEN_UTM = { e: 662000, n: 4188000 };

export type ClaveFinca = "corvera" | "valladolises" | "lobosillo";

export type GeoFinca = {
  e: number;
  n: number;
  /** superficie que se usa si la base de datos no la tiene */
  areaHaPorDefecto: number;
  fuente: string;
  /** latitud y longitud (para el tiempo) */
  lat: number;
  lon: number;
};

export const GEO: Record<ClaveFinca, GeoFinca> = {
  corvera: {
    e: 663250,
    n: 4186500,
    areaHaPorDefecto: 22,
    fuente: "Catastro: Murcia, polígono 162, parcelas 45, 122 y 123",
    lat: 37.8109,
    lon: -1.1454,
  },
  valladolises: {
    e: 667250,
    n: 4182300,
    areaHaPorDefecto: 22,
    fuente: "Catastro: Fuente Álamo, polígonos 503, 504 y 505",
    lat: 37.7728,
    lon: -1.101,
  },
  lobosillo: {
    e: 669243,
    n: 4176268,
    areaHaPorDefecto: 2.137,
    fuente: "Ubicación de Google Maps; superficie de la escritura (2 ha 13 a 70 ca)",
    lat: 37.71805,
    lon: -1.079767,
  },
};

/** Pasa UTM a coordenadas reales del mapa (metros desde el origen). */
export function aMapaReal(e: number, n: number) {
  return { x: e - ORIGEN_UTM.e, y: ORIGEN_UTM.n - n };
}

/*
 * Distancias acortadas: las fincas están a 5-11 km entre sí y, a escala real,
 * en la pantalla de inicio se verían diminutas. Se acercan hacia Valladolises
 * multiplicando las distancias por COMPRESION. Se respetan la dirección
 * (quién queda al norte, al este…) y el TAMAÑO real de cada finca.
 */
export const COMPRESION = 0.25;
export const REFERENCIA = aMapaReal(667250, 4182300); // Valladolises

/** Coordenadas del mapa con las distancias acortadas. */
export function aMapa(e: number, n: number) {
  const r = aMapaReal(e, n);
  return {
    x: REFERENCIA.x + (r.x - REFERENCIA.x) * COMPRESION,
    y: REFERENCIA.y + (r.y - REFERENCIA.y) * COMPRESION,
  };
}

/** Transformación SVG que aplica el mismo acortamiento al paisaje dibujado en metros reales. */
export const TRANSFORM_PAISAJE = `translate(${REFERENCIA.x} ${REFERENCIA.y}) scale(${COMPRESION}) translate(${-REFERENCIA.x} ${-REFERENCIA.y})`;

/*
 * Cada finca tiene un dibujo en "unidades de dibujo". Para colocarlo a escala real,
 * se calcula cuántos metros mide una unidad a partir de la superficie:
 *   metros por unidad = √(superficie m² / superficie dibujada en unidades²)
 */
export type FormaDibujo = {
  /** caja del dibujo (incluye pantano, pozo…) */
  caja: { x: number; y: number; w: number; h: number };
  /** punto del dibujo que cae en las coordenadas reales */
  centro: { x: number; y: number };
  /** borde superior de la parcela (para colgar el cartel) */
  arriba: number;
  /** unidades² que representan la superficie cultivada */
  areaDibujada: number;
  /** dónde se pintan el tractor y la persona */
  tractor: { x: number; y: number };
  persona: { x: number; y: number };
};

export const FORMAS: Record<ClaveFinca, FormaDibujo> = {
  corvera: {
    caja: { x: -10, y: -10, w: 330, h: 300 },
    centro: { x: 150, y: 120 },
    arriba: -4,
    areaDibujada: 228 * 240 + 64 * 90,
    tractor: { x: 60, y: 98 },
    persona: { x: 150, y: 170 },
  },
  valladolises: {
    caja: { x: -10, y: -10, w: 380, h: 250 },
    centro: { x: 130, y: 115 },
    arriba: -4,
    areaDibujada: 260 * 230,
    tractor: { x: 170, y: 150 },
    persona: { x: 40, y: 150 },
  },
  lobosillo: {
    caja: { x: -10, y: -10, w: 160, h: 150 },
    centro: { x: 68, y: 65 },
    arriba: -4,
    areaDibujada: 136 * 130,
    tractor: { x: 40, y: 90 },
    persona: { x: 90, y: 100 },
  },
};

export function metrosPorUnidad(clave: ClaveFinca, areaHa: number) {
  return Math.sqrt((areaHa * 10000) / FORMAS[clave].areaDibujada);
}

// Huecos de las zonas de Valladolises dentro de su dibujo (x, y, ancho, alto, etiqueta)
export const HUECOS_VALLADOLISES: Record<
  string,
  { x: number; y: number; w: number; h: number; ex: number; ey: number; bancales?: boolean }
> = {
  "la casa": { x: 0, y: 0, w: 115, h: 135, ex: 45, ey: 109 },
  "los olivos": { x: 120, y: 0, w: 140, h: 95, ex: 190, ey: 50 },
  "del pozo": { x: 120, y: 100, w: 140, h: 75, ex: 190, ey: 146, bancales: true },
  abajo: { x: 0, y: 142, w: 115, h: 88, ex: 57, ey: 197 },
  trivino: { x: 120, y: 182, w: 80, h: 48, ex: 160, ey: 211 },
  "la mari": { x: 206, y: 182, w: 54, h: 48, ex: 233, ey: 211 },
};

// Insignias de sector de Corvera según su número
export const SECTORES_CORVERA: Record<number, { x: number; y: number }> = {
  1: { x: 38, y: 14 },
  2: { x: 158, y: 14 },
  3: { x: 250, y: 190 },
};
