// Situación real de las fincas y forma de sus dibujos.
// Sirve en servidor y en cliente (sin dependencias).

/*
 * Coordenadas en UTM huso 30 (ETRS89), en metros.
 * - Corvera: centro de la finca marcado por la familia en Google Earth (31/10/2026).
 * - Valladolises: la casa, según Google Earth (37°46'21.50"N 1°06'25.70"W, familia 31/10/2026).
 * - Lobosillo: punto de Google Earth marcado por la familia (37°43'06.41"N 1°04'50.15"W, 31/10/2026);
 *   contorno del Catastro (Murcia, polígono 535, parcelas 63 y 64).
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
    fuente:
      "Google Earth (familia, 31/10/2026). Catastro: Murcia, polígono 535, parcelas 63 y 64 (1,66 ha). La escritura (2 ha 13 a 70 ca) cita la 536/67: por confirmar si también es de Lobosillo",
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
  corvera: 1.1,
  valladolises: 0.9,
  lobosillo: 2.6,
};

/**
 * Pequeño desplazamiento (metros del mapa; x = este, y = sur) solo para el mapa de
 * inicio, para que las fincas agrandadas no se solapen ni se peguen a la sierra.
 */
export const DESPLAZAMIENTO_MAPA: Record<ClaveFinca, { x: number; y: number }> = {
  corvera: { x: -350, y: 1850 },
  valladolises: { x: -500, y: -150 },
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
  /** si la finca son varios trozos separados, el contorno de cada uno (manda sobre «contorno») */
  piezas?: string[];
  /**
   * Metros por unidad medidos en la vista aérea. Si está, manda sobre la superficie
   * (se usa cuando el dibujo es solo un trozo de la finca).
   */
  metrosPorUnidadFijo?: number;
};

/*
 * Corvera con los límites del Catastro (Murcia, polígono 162), norte arriba,
 * 1 unidad ≈ 2,3 m (mismo encaje que el contorno de Google Earth, así casan el
 * pantano y los caminos calcados). Según la hoja impresa de la familia (3/11/2026):
 *   sectores 1 y 2 = parcelas 122 y 45 (5.102 árboles, Fino 95, 20,59 ha cultivadas)
 *   sector 3 = parcela 143, la «del panadero» (788 árboles, Fino 49, 2,87 ha)
 * La franja del norte (parcela 123, 10,27 ha) entraba en el dibujo de Google Earth
 * pero no en la hoja: queda fuera hasta confirmar si es de la familia.
 */
const CORVERA_122 = "30,282 26,276 213,149 306,87 334,66 349,74 346,74 344,78 356,117 258,185 110,294 64,326";
const CORVERA_45 = "95,367 64,326 110,294 258,185 356,117 358,127 358,131 356,136 348,148 305,220 292,241 286,242 282,244 255,264 216,296 199,309 191,313 159,338 147,346";
const CORVERA_PRINCIPAL = "26,276 30,282 58,318 95,367 147,346 159,338 191,313 199,309 255,264 282,244 286,242 292,241 305,220 358,131 358,127 344,79 346,74 349,74 334,66 306,87 213,149";
const CORVERA_PANADERO = "402,108 408,103 412,94 412,85 410,79 408,75 389,55 357,26 323,-1 317,2 283,29 334,66 349,74 397,106";
const CONTORNO_CORVERA =
  "26,276 30,282 58,318 95,367 147,346 159,338 191,313 199,309 255,264 282,244 286,242 292,241 305,220 358,131 358,127 344,79 346,74 349,74 397,106 402,108 408,103 412,94 412,85 410,79 408,75 389,55 357,26 323,-1 317,2 283,29 333,66 333,67 306,87 213,149";

/*
 * Valladolises: dibujada por Antonio en Google Earth (archivo «Fincas.kml», 3/11/2026),
 * norte arriba, a escala real: 1 unidad = 2,5 m. Son tres bloques separados (suman
 * unas 27,5 ha, como el catastro: 27,0 ha) y, dentro, sus zonas. Los dibujos son
 * aproximados (se pueden salir un poco de los caminos). Nombres de los bloques y de
 * los mandarinos provisionales: pendientes de confirmar con Juan Carlos.
 */
const VALL_LA_CASA = "23,134 48,172 73,153 66,145 112,88 97,71 72,49 64,46 46,65 8,110"; // 4,16 ha (casa, caseta y pantano)
const VALL_BLOQUE_OLIVOS = "179,143 220,35 173,29 153,28 137,20 116,8 71,40"; // 6,08 ha
const VALL_BLOQUE_ABAJO = "282,35 223,178 329,265 357,292 394,264 349,233 412,79 424,53 385,39 367,66"; // 17,27 ha
const VALL_OLIVOS = "188,33 150,94 184,124 217,37"; // «Limoneros los olivos» · 1,83 ha
const VALL_MANDARINOS = "75,42 137,99 156,117 167,127 179,138 185,128 177,122 152,100 121,73 91,30"; // 0,98 ha
const VALL_MANDARINOS_VIEJOS = "95,35 107,52 129,77 162,30 139,23 115,9 92,28"; // 1,49 ha
const VALL_MANDARINOS_2 = "164,30 131,79 149,94 186,33"; // 0,88 ha
const VALL_DEL_POZO = "284,38 226,175 257,201 314,50"; // «Nuevos Pozo» · 3,47 ha
const VALL_ABAJO = "370,67 317,51 261,201 329,262 346,234 411,74 384,49"; // «Viejos abajo» · 10,83 ha
const VALL_TRIVINO = "347,235 330,268 356,290 389,265"; // 1,02 ha
const VALL_LA_MARI = "390,36 387,44 398,57 413,72 421,55"; // 0,31 ha

/** Los tres bloques de Valladolises (para el dibujo y el mapa). */
export const BLOQUES_VALLADOLISES = [
  { nombre: "La Casa", puntos: VALL_LA_CASA },
  { nombre: "Bloque de Los Olivos", puntos: VALL_BLOQUE_OLIVOS },
  { nombre: "Bloque de abajo", puntos: VALL_BLOQUE_ABAJO },
];

/** Zonas de mandarinos de Valladolises (se pintan con naranjas). */
export const MANDARINOS_VALLADOLISES = [VALL_MANDARINOS, VALL_MANDARINOS_VIEJOS, VALL_MANDARINOS_2];

/*
 * Detalles de la casa (casa, pista de tenis, piscina, pantano, caseta) calcados antes
 * de otra captura (unidades de 0,72 m, con la casa en 142,108). Se colocan sobre el
 * plano nuevo con este cambio de escala: la casa cae en su punto de Google Earth.
 */
export const DETALLES_CASA_VALLADOLISES = {
  transform: "translate(53.1 80.3) scale(0.288) translate(-142 -108)",
  casa: { x: 53, y: 80 },
  pantano: { x: 40, y: 137 },
};

/*
 * Lobosillo con los límites del Catastro (Murcia, polígono 535, parcelas 63 y 64,
 * 5.623 + 10.997 m² = 1,66 ha), norte arriba. Dentro, sacados de la ortofoto del
 * PNOA: árboles en filas, balsa con su caseta, explanada con la casa y pista de fútbol.
 * Escala fija: 1 unidad = 0,5866 m; el punto de Google Earth cae en (154, 172).
 * Por confirmar: la escritura cita la parcela 536/67 (2,02 ha, 400 m al norte),
 * que no se dibuja hasta saber si también es de Lobosillo.
 */
export const LOBOSILLO_MPU = 0.586563;
const CONTORNO_LOBOSILLO =
  "5,72 150,16 201,107 262,214 264,217 297,278 288,291 275,301 249,311 208,316 172,314 139,319 103,264 83,227 72,212 52,165";
/** detalles calcados de la ortofoto, en unidades del dibujo */
export const DETALLES_LOBOSILLO = {
  balsaTalud: "193,209 240,201 260,252 204,262",
  balsaAgua: "200,213 238,207 253,248 208,256",
  caseta: { x: 235, y: 203 },
  explanada: "133,284 210,269 218,312 139,319",
  pista: "210,269 282,257 292,297 218,312",
  casa: { x: 141, y: 301 },
};

export const FORMAS: Record<ClaveFinca, FormaDibujo> = {
  corvera: {
    caja: { x: 16, y: -12, w: 406, h: 390 },
    centro: { x: 205, y: 187 },
    arriba: 60,
    areaDibujada: 45000,
    tractor: { x: 150, y: 290 },
    persona: { x: 300, y: 150 },
    contorno: CONTORNO_CORVERA,
    piezas: [CORVERA_PRINCIPAL, CORVERA_PANADERO],
    metrosPorUnidadFijo: 2.3,
  },
  valladolises: {
    caja: { x: 0, y: -8, w: 432, h: 308 },
    centro: { x: 53, y: 80 }, // la casa
    arriba: 8,
    areaDibujada: 44034, // 27,5 ha / (2,5 m)²
    tractor: { x: 300, y: 150 },
    persona: { x: 165, y: 70 },
    contorno: VALL_BLOQUE_ABAJO,
    piezas: [VALL_LA_CASA, VALL_BLOQUE_OLIVOS, VALL_BLOQUE_ABAJO],
    metrosPorUnidadFijo: 2.5,
  },
  lobosillo: {
    caja: { x: -4, y: 6, w: 310, h: 322 },
    centro: { x: 154, y: 172 }, // el punto marcado en Google Earth
    arriba: 16,
    areaDibujada: 48315, // 1,66 ha / (0,5866 m)²
    tractor: { x: 110, y: 150 },
    persona: { x: 170, y: 120 },
    contorno: CONTORNO_LOBOSILLO,
    metrosPorUnidadFijo: LOBOSILLO_MPU,
  },
};

export function metrosPorUnidad(clave: ClaveFinca, areaHa: number) {
  const forma = FORMAS[clave];
  return forma.metrosPorUnidadFijo ?? Math.sqrt((areaHa * 10000) / forma.areaDibujada);
}

// Insignias de sector de Corvera según su número
// (orientativo: falta confirmar qué riega cada sector)
export const SECTORES_CORVERA: Record<number, { x: number; y: number }> = {
  1: { x: 160, y: 196 },
  2: { x: 118, y: 312 },
  3: { x: 344, y: 44 },
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

export const PLANOS: Record<ClaveFinca, PlanoDeFinca> = {
  corvera: {
    zonas: {
      "rectangulo grande": { poligono: CORVERA_PRINCIPAL, etiqueta: { x: 170, y: 262 } },
      "parcela del panadero": { poligono: CORVERA_PANADERO, etiqueta: { x: 340, y: -16 } },
    },
    sectores: {
      // 1 y 2 = parcelas 122 y 45 (por confirmar cuál es cuál); 3 = parcela del panadero
      1: { poligono: CORVERA_122, etiqueta: { x: 190, y: 200 } },
      2: { poligono: CORVERA_45, etiqueta: { x: 150, y: 320 } },
      3: { poligono: CORVERA_PANADERO, etiqueta: { x: 360, y: 60 } },
    },
    nota:
      "Límites del Catastro (polígono 162: parcelas 45, 122 y 143) y hoja impresa de la familia: sectores 1 y 2 = 5.102 árboles Fino 95 (20,59 ha), sector 3 = parcela del panadero, 788 árboles Fino 49 (2,87 ha). Por confirmar: cuál de las dos franjas es el sector 1 y si la franja del norte (parcela 123) es de la familia.",
  },
  valladolises: {
    zonas: {
      "la casa": { poligono: VALL_LA_CASA, etiqueta: { x: 50, y: 118 } },
      "los olivos": { poligono: VALL_OLIVOS, etiqueta: { x: 200, y: 70 } },
      mandarinos: { poligono: VALL_MANDARINOS, etiqueta: { x: 135, y: 104 } },
      "mandarinos viejos": { poligono: VALL_MANDARINOS_VIEJOS, etiqueta: { x: 95, y: 18 } },
      "mandarinos 2": { poligono: VALL_MANDARINOS_2, etiqueta: { x: 172, y: -4 } },
      "del pozo": { poligono: VALL_DEL_POZO, etiqueta: { x: 271, y: 118 } },
      abajo: { poligono: VALL_ABAJO, etiqueta: { x: 340, y: 150 } },
      trivino: { poligono: VALL_TRIVINO, etiqueta: { x: 360, y: 272 } },
      "la mari": { poligono: VALL_LA_MARI, etiqueta: { x: 402, y: 24 } },
    },
    sectores: {},
    nota:
      "Zonas dibujadas por Antonio en Google Earth (3/11/2026), aproximadas. Provisional, por confirmar con Juan Carlos: los nombres de los bloques, que «Nuevos Pozo» sea Del Pozo / Los Nuevos y los tres trozos de mandarinos (en la ficha, Los Olivos figura como mandarinos y en el dibujo como limoneros).",
  },
  lobosillo: {
    zonas: {},
    sectores: {},
    nota:
      "Contorno del Catastro (polígono 535, parcelas 63 y 64: 1,66 ha); balsa, casa y pista de fútbol de la ortofoto. La escritura cita también la parcela 536/67 (2,02 ha, 400 m al norte): por confirmar si es de Lobosillo. Faltan sus zonas y sectores de riego.",
  },
};

/*
 * De latitud y longitud a unidades de dibujo de cada finca (para poner chinchetas
 * en el plano: incidencias con su sitio exacto).
 * - Valladolises: exacto (mismo cálculo con el que se pasó el KML a unidades de 2,5 m).
 * - Corvera: ajustado al contorno del KML (1 unidad ≈ 2,3 m).
 * - Lobosillo: desde su punto de Google Earth, con la escala fija del Catastro (0,5866 m).
 */
const M_LAT_GRADO = 111132;
const mLonGrado = (lat: number) => Math.cos((lat * Math.PI) / 180) * 111320;

export function aDibujo(clave: ClaveFinca, lat: number, lon: number): { x: number; y: number } {
  if (clave === "valladolises") {
    return {
      x: ((lon - -1.108422607595773) * mLonGrado(37.7715)) / 2.5 + 8,
      y: ((37.77426798397903 - lat) * M_LAT_GRADO) / 2.5 + 8,
    };
  }
  if (clave === "corvera") {
    return {
      x: ((lon - -1.149806946177662) * mLonGrado(37.811)) / 2.31,
      y: ((37.81491677329856 - lat) * M_LAT_GRADO) / 2.3,
    };
  }
  const g = GEO.lobosillo;
  const mpu = LOBOSILLO_MPU;
  return {
    x: FORMAS.lobosillo.centro.x + ((lon - g.lon) * mLonGrado(g.lat)) / mpu,
    y: FORMAS.lobosillo.centro.y - ((lat - g.lat) * M_LAT_GRADO) / mpu,
  };
}
