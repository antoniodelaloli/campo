// Situación real de las fincas y forma de sus dibujos.
// Sirve en servidor y en cliente (sin dependencias).

/*
 * Coordenadas en UTM huso 30 (ETRS89), en metros.
 * - Corvera: centro de la finca marcado por la familia en Google Earth (31/10/2026).
 * - Valladolises: la casa, según Google Earth (37°46'21.50"N 1°06'25.70"W, familia 31/10/2026).
 * - Lobosillo: punto de Google Earth marcado por la familia (37°43'06.41"N 1°04'50.15"W, 31/10/2026).
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

// La casa de Valladolises (punto de referencia de todo el mapa)
const E_VALLADOLISES = 666708;
const N_VALLADOLISES = 4182276;

export const GEO: Record<ClaveFinca, GeoFinca> = {
  corvera: {
    e: 663452,
    n: 4186549,
    areaHaPorDefecto: 22,
    fuente: "Google Earth (familia, 31/10/2026). Catastro: Murcia, polígono 162, parcelas 45, 122 y 123",
    lat: 37.811717,
    lon: -1.143122,
  },
  valladolises: {
    e: E_VALLADOLISES,
    n: N_VALLADOLISES,
    areaHaPorDefecto: 22,
    fuente: "Casa en Google Earth (familia, 31/10/2026). Catastro: Fuente Álamo, polígonos 503, 504 y 505",
    lat: 37.772639,
    lon: -1.107139,
  },
  lobosillo: {
    e: 669169,
    n: 4176311,
    areaHaPorDefecto: 2.137,
    fuente: "Google Earth (familia, 31/10/2026); superficie de la escritura (2 ha 13 a 70 ca)",
    lat: 37.718447,
    lon: -1.080597,
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
export const COMPRESION = 0.22;

/*
 * En el mapa de inicio las fincas se dibujan AGRANDADAS para que se vean bien al
 * entrar (no están a escala entre sí). Lobosillo, que es muy pequeña, se agranda más.
 * El plano de cada finca (/fincas/[id]) sí va a su tamaño real, con escala en metros.
 */
export const AUMENTO_MAPA: Record<ClaveFinca, number> = {
  corvera: 1.8,
  valladolises: 2.4,
  lobosillo: 3.5,
};

/**
 * Pequeño desplazamiento (metros del mapa; x = este, y = sur) solo para el mapa de
 * inicio, para que las fincas agrandadas no se solapen ni se peguen a la sierra.
 */
export const DESPLAZAMIENTO_MAPA: Record<ClaveFinca, { x: number; y: number }> = {
  corvera: { x: -350, y: 1850 },
  valladolises: { x: 0, y: 0 },
  lobosillo: { x: -300, y: -150 },
};
// Punto fijo hacia el que se acercan las distancias (zona de Valladolises).
// No se mueve aunque se afinen las fincas: el paisaje está dibujado respecto a él.
export const REFERENCIA = aMapaReal(667250, 4182300);

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
  /** contorno real de la finca (puntos SVG), si se ha calcado de una vista aérea */
  contorno?: string;
  /**
   * Metros por unidad medidos en la vista aérea. Si está, manda sobre la superficie
   * (se usa cuando el dibujo es solo un trozo de la finca).
   */
  metrosPorUnidadFijo?: number;
};

/*
 * Corvera calcada de la vista aérea de Google Earth (31/10/2026), norte arriba.
 * 1 unidad ≈ 2,3 m en la captura (el contorno medía 35,2 ha; pendiente de confirmar
 * qué parte es de la familia: el dibujo se escala a la superficie de la base de datos).
 */
const CONTORNO_CORVERA =
  "320,0 337,10 351,19 385,44 414,76 416,91 404,105 347,73 359,132 298,241 275,249 152,347 96,366 0,234";

/*
 * Valladolises: solo el trozo de la casa, la caseta y el pantano (el resto de la finca
 * va en su módulo). Calcado de Google Earth (31/10/2026), norte arriba.
 * Escala sacada de la pista de tenis (~36 × 18 m con su valla): 1 unidad ≈ 0,875 m.
 * El trozo mide unas 4,9 ha.
 */
const CONTORNO_VALLADOLISES =
  "180,2 206,6 234,20 250,44 270,64 302,92 322,118 308,144 292,172 270,204 246,230 218,248 198,268 182,296 178,312 188,324 186,344 174,354 142,362 126,364 106,358 86,340 74,316 62,284 50,264 34,244 14,220 4,196 2,184 18,164 38,144 58,120 90,84 118,56 142,32 166,8";

/*
 * Lobosillo calcada de Google Earth (31/10/2026), norte arriba: árboles en filas,
 * balsa, caseta, casa y pista de fútbol. Se escala con la superficie de la escritura
 * (2,137 ha), que cuadra con lo que mide el contorno (pista de ~46 m de largo).
 */
const CONTORNO_LOBOSILLO =
  "2,55 36,34 76,17 116,9 144,6 154,3 168,34 184,62 200,86 220,106 242,130 244,146 252,170 272,206 290,246 302,270 304,310 288,318 256,332 224,338 184,342 152,342 136,332 126,318 116,294 104,274 88,254 72,238 56,222 44,206 40,174 32,138 20,110 12,86";

export const FORMAS: Record<ClaveFinca, FormaDibujo> = {
  corvera: {
    caja: { x: -8, y: -8, w: 432, h: 384 },
    centro: { x: 205, y: 187 },
    arriba: 80,
    areaDibujada: 66742,
    tractor: { x: 110, y: 228 },
    persona: { x: 300, y: 150 },
    contorno: CONTORNO_CORVERA,
  },
  valladolises: {
    caja: { x: -8, y: -8, w: 340, h: 384 },
    centro: { x: 141, y: 104 }, // la casa
    arriba: 30,
    areaDibujada: 64424,
    tractor: { x: 214, y: 196 },
    persona: { x: 70, y: 196 },
    contorno: CONTORNO_VALLADOLISES,
    metrosPorUnidadFijo: 0.875,
  },
  lobosillo: {
    caja: { x: -8, y: -6, w: 322, h: 356 },
    centro: { x: 154, y: 172 }, // el punto marcado en Google Earth
    arriba: 4,
    areaDibujada: 62112,
    tractor: { x: 110, y: 150 },
    persona: { x: 170, y: 120 },
    contorno: CONTORNO_LOBOSILLO,
  },
};

export function metrosPorUnidad(clave: ClaveFinca, areaHa: number) {
  const forma = FORMAS[clave];
  return forma.metrosPorUnidadFijo ?? Math.sqrt((areaHa * 10000) / forma.areaDibujada);
}

// Insignias de sector de Corvera según su número
// (orientativo: falta confirmar qué riega cada sector)
export const SECTORES_CORVERA: Record<number, { x: number; y: number }> = {
  1: { x: 153, y: 128 },
  2: { x: 113, y: 300 },
  3: { x: 366, y: 62 },
};

/** Clave de dibujo a partir del nombre de la finca en la base de datos. */
export function claveDeFinca(nombre: string): ClaveFinca | null {
  const n = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return n === "corvera" || n === "valladolises" || n === "lobosillo" ? n : null;
}

/*
 * Plano de cada finca (página /fincas/[id]): dónde cae cada zona y cada sector de riego
 * dentro del dibujo calcado (mismas unidades que FORMAS). Es la base para ir mapeando
 * zonas y sectores con la familia: lo que no está aquí sale como «sin situar».
 * Las claves de zona son el nombre normalizado (minúsculas, sin tildes).
 */
export type TrozoPlano = {
  /** polígono en unidades de dibujo; sin él, solo se pone el cartel */
  poligono?: string;
  /** dónde va el cartel */
  etiqueta: { x: number; y: number };
};

export type PlanoDeFinca = {
  zonas: Record<string, TrozoPlano>;
  sectores: Record<number, TrozoPlano>;
  /** qué es seguro y qué falta, para el pie del plano */
  nota: string;
};

// Corvera: el saliente del noreste (calcado) se separa del cuerpo principal en 347,73 → 320,0.
const CORVERA_PANADERO = "320,0 337,10 351,19 385,44 414,76 416,91 404,105 347,73";
const CORVERA_PRINCIPAL = "320,0 347,73 359,132 298,241 275,249 152,347 96,366 0,234";

export const PLANOS: Record<ClaveFinca, PlanoDeFinca> = {
  corvera: {
    zonas: {
      "rectangulo grande": { poligono: CORVERA_PRINCIPAL, etiqueta: { x: 130, y: 232 } },
      "parcela del panadero": { poligono: CORVERA_PANADERO, etiqueta: { x: 330, y: -12 } },
    },
    sectores: {
      // Sectores 1 y 2 separados por el camino diagonal largo; 3 = parcela del panadero
      1: { poligono: "320,0 0,234 29,273 346,69", etiqueta: { x: 165, y: 152 } },
      2: { poligono: "96,366 152,347 275,249 298,241 359,132 347,73 346,69 29,273", etiqueta: { x: 130, y: 300 } },
      3: { poligono: CORVERA_PANADERO, etiqueta: { x: 376, y: 66 } },
    },
    nota:
      "Contorno, caminos y pantano calcados de Google Earth. Por confirmar: que la parcela del panadero sea el saliente del noreste y que el camino diagonal separe los sectores 1 y 2.",
  },
  valladolises: {
    zonas: {
      "la casa": { poligono: "118,88 150,74 220,122 206,152 160,170 136,160 112,124", etiqueta: { x: 146, y: 64 } },
    },
    sectores: {},
    nota:
      "De momento solo está dibujado el trozo de la casa, la pista de tenis y el pantano (unas 4,9 ha de las ~22). El resto de trozos se dibujará con una vista aérea que los marque.",
  },
  lobosillo: {
    zonas: {},
    sectores: {},
    nota: "Contorno, balsa, casa y pista de fútbol calcados de Google Earth. Faltan sus zonas y sectores de riego.",
  },
};
