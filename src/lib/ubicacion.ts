// Dónde cae un punto (latitud, longitud) en las fincas: finca y zona.
// Polígonos en grados (lon, lat), sacados de Google Earth:
// - Valladolises: «Fincas.kml» de Antonio (3/11/2026), bloques y zonas.
// - Corvera: límites del Catastro (parcelas 45, 122 y 143), como en la hoja impresa de la familia.
// - Lobosillo: límites del Catastro (Murcia, polígono 535, parcelas 63 y 64, y polígono 536, parcela 67).
// Los dibujos son aproximados: se acepta un margen alrededor de cada zona.
// Sin dependencias: sirve en servidor y en cliente (funciona sin cobertura).
import type { ClaveFinca } from "@/lib/geografia";

type Anillo = [number, number][];

type ZonaGeo = { nombre: string; anillo: Anillo };

type FincaGeo = {
  clave: ClaveFinca;
  nombre: string;
  /** trozos de la finca (uno o varios) */
  piezas: Anillo[];
  zonas: ZonaGeo[];
};

const VALLADOLISES: FincaGeo = {
  clave: "valladolises",
  nombre: "Valladolises",
  piezas: [
    [[-1.107992, 37.771431], [-1.107294, 37.770580], [-1.106570, 37.771011], [-1.106771, 37.771181], [-1.105454, 37.772470], [-1.105892, 37.772851], [-1.106605, 37.773342], [-1.106823, 37.773418], [-1.107348, 37.772985], [-1.108423, 37.771966]],
    [[-1.103556, 37.771232], [-1.102393, 37.773661], [-1.103723, 37.773796], [-1.104312, 37.773817], [-1.104767, 37.774006], [-1.105366, 37.774268], [-1.106631, 37.773540]],
    [[-1.100637, 37.773650], [-1.102313, 37.770451], [-1.099312, 37.768486], [-1.098505, 37.767872], [-1.097461, 37.768499], [-1.098745, 37.769196], [-1.096954, 37.772661], [-1.096610, 37.773266], [-1.097709, 37.773563], [-1.098236, 37.772970]],
  ],
  zonas: [
    { nombre: "La Casa", anillo: [[-1.107992, 37.771431], [-1.107294, 37.770580], [-1.106570, 37.771011], [-1.106771, 37.771181], [-1.105454, 37.772470], [-1.105892, 37.772851], [-1.106605, 37.773342], [-1.106823, 37.773418], [-1.107348, 37.772985], [-1.108423, 37.771966]] },
    { nombre: "Los Olivos", anillo: [[-1.103321, 37.773703], [-1.104380, 37.772341], [-1.103426, 37.771664], [-1.102476, 37.773626]] },
    { nombre: "Mandarinos", anillo: [[-1.106530, 37.773502], [-1.104752, 37.772212], [-1.104216, 37.771823], [-1.103894, 37.771598], [-1.103572, 37.771347], [-1.103394, 37.771578], [-1.103615, 37.771705], [-1.104340, 37.772194], [-1.105208, 37.772797], [-1.106072, 37.773769]] },
    { nombre: "Mandarinos viejos", anillo: [[-1.105945, 37.773664], [-1.105617, 37.773267], [-1.104971, 37.772712], [-1.104059, 37.773767], [-1.104704, 37.773937], [-1.105379, 37.774242], [-1.106023, 37.773817]] },
    { nombre: "Mandarinos 2", anillo: [[-1.103988, 37.773778], [-1.104940, 37.772665], [-1.104417, 37.772341], [-1.103370, 37.773715]] },
    { nombre: "Del Pozo", anillo: [[-1.100587, 37.773594], [-1.102238, 37.770515], [-1.101357, 37.769918], [-1.099721, 37.773327]] },
    { nombre: "Abajo", anillo: [[-1.098131, 37.772930], [-1.099641, 37.773303], [-1.101241, 37.769917], [-1.099294, 37.768559], [-1.098825, 37.769186], [-1.096961, 37.772781], [-1.097750, 37.773350]] },
    { nombre: "Triviño", anillo: [[-1.098803, 37.769157], [-1.099279, 37.768421], [-1.098537, 37.767923], [-1.097599, 37.768491]] },
    { nombre: "La Mari", anillo: [[-1.097583, 37.773631], [-1.097659, 37.773464], [-1.097356, 37.773173], [-1.096909, 37.772835], [-1.096699, 37.773222]] },
  ],
};

const C45: Anillo = [[-1.148097, 37.808120], [-1.148138, 37.808167], [-1.146909, 37.808833], [-1.145788, 37.809485], [-1.143035, 37.811087], [-1.142567, 37.811346], [-1.141840, 37.811741], [-1.141145, 37.812130], [-1.140564, 37.812444], [-1.140468, 37.812496], [-1.140392, 37.812287], [-1.140468, 37.812105], [-1.140678, 37.811858], [-1.140903, 37.811535], [-1.141290, 37.811023], [-1.141796, 37.810354], [-1.142146, 37.809931], [-1.142406, 37.809867], [-1.143099, 37.809459], [-1.144141, 37.808799], [-1.144785, 37.808440], [-1.145640, 37.807913], [-1.145947, 37.807754], [-1.146948, 37.807437], [-1.147320, 37.807316], [-1.147500, 37.807522]];
const C122: Anillo = [[-1.149022, 37.809079], [-1.149120, 37.809211], [-1.148047, 37.809784], [-1.147191, 37.810253], [-1.145603, 37.811094], [-1.144216, 37.811835], [-1.143021, 37.812464], [-1.141782, 37.813112], [-1.141569, 37.813227], [-1.141503, 37.813266], [-1.141037, 37.813544], [-1.140630, 37.813385], [-1.140707, 37.813387], [-1.140761, 37.813294], [-1.140624, 37.812928], [-1.140468, 37.812496], [-1.140564, 37.812444], [-1.141145, 37.812130], [-1.141840, 37.811741], [-1.142567, 37.811346], [-1.143035, 37.811087], [-1.145788, 37.809485], [-1.146909, 37.808833], [-1.148138, 37.808167], [-1.148370, 37.808411]];
const C143: Anillo = [[-1.139153, 37.812735], [-1.139391, 37.812728], [-1.139755, 37.812916], [-1.140368, 37.813247], [-1.140630, 37.813385], [-1.141037, 37.813544], [-1.141610, 37.813884], [-1.142363, 37.814318], [-1.141841, 37.814651], [-1.141478, 37.814870], [-1.141317, 37.814940], [-1.140431, 37.814372], [-1.139591, 37.813781], [-1.139189, 37.813433], [-1.139027, 37.813288], [-1.138980, 37.813154], [-1.138996, 37.812968], [-1.139080, 37.812794]];

// Corvera: límites del Catastro (polígono 162, parcelas 45, 122 y 143), según la hoja de la familia
const CORVERA: FincaGeo = {
  clave: "corvera",
  nombre: "Corvera",
  piezas: [C45, C122, C143],
  zonas: [
    { nombre: "Rectángulo grande", anillo: C45 },
    { nombre: "Rectángulo grande", anillo: C122 },
    { nombre: "Parcela del panadero", anillo: C143 },
  ],
};

// Lobosillo: parcelas 63 y 64 del polígono 535 de Murcia, juntas (1,66 ha)
const L535: Anillo = [[-1.081588, 37.718974], [-1.080623, 37.719271], [-1.080283, 37.718790], [-1.079876, 37.718224], [-1.079864, 37.718207], [-1.079645, 37.717890], [-1.079703, 37.717820], [-1.079793, 37.717765], [-1.079962, 37.717712], [-1.080239, 37.717688], [-1.080478, 37.717695], [-1.080695, 37.717669], [-1.080935, 37.717959], [-1.081067, 37.718155], [-1.081142, 37.718235], [-1.081279, 37.718482]];

// Lobosillo: parcela 67 del polígono 536 de Murcia (2,02 ha), la de la escritura
const L536: Anillo = [[-1.076998, 37.721281], [-1.076993, 37.721237], [-1.076999, 37.721165], [-1.077015, 37.721171], [-1.078293, 37.721660], [-1.078481, 37.721818], [-1.079036, 37.722854], [-1.079044, 37.722869], [-1.079015, 37.722883], [-1.078808, 37.722898], [-1.078574, 37.722899], [-1.078226, 37.722835], [-1.078030, 37.722812], [-1.077756, 37.722818], [-1.077428, 37.722869], [-1.077399, 37.722876], [-1.077343, 37.722678], [-1.077249, 37.722299], [-1.077091, 37.721677], [-1.077005, 37.721359]];

const LOBOSILLO: FincaGeo = {
  clave: "lobosillo",
  nombre: "Lobosillo",
  piezas: [L535, L536],
  zonas: [
    { nombre: "Trozo de la casa", anillo: L535 },
    { nombre: "Parcela de arriba", anillo: L536 },
  ],
};

const FINCAS_GEO: FincaGeo[] = [VALLADOLISES, CORVERA, LOBOSILLO];
/** Margen alrededor de las zonas (los dibujos son aproximados). */
const MARGEN_ZONA_M = 35;
/** Margen alrededor de la finca para darla por buena. */
const MARGEN_FINCA_M = 120;

// Metros por grado alrededor de las fincas (latitud ~37,8°)
const M_LAT = 111132;
const M_LON = Math.cos((37.79 * Math.PI) / 180) * 111320;

function aMetros([lon, lat]: [number, number], ref: [number, number]) {
  return [(lon - ref[0]) * M_LON, (lat - ref[1]) * M_LAT] as const;
}

function dentro(p: [number, number], anillo: Anillo) {
  let si = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) si = !si;
  }
  return si;
}

/** Distancia en metros del punto al borde del anillo (0 si está dentro). */
function distancia(p: [number, number], anillo: Anillo) {
  if (dentro(p, anillo)) return 0;
  let min = Infinity;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [ax, ay] = aMetros(anillo[j], p);
    const [bx, by] = aMetros(anillo[i], p);
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}

export type Ubicacion = {
  /** finca en la que está (o la más cercana, si está fuera) */
  clave: ClaveFinca;
  finca: string;
  /** dentro de la finca (o a menos de MARGEN_FINCA_M) */
  enFinca: boolean;
  /** zona en la que cae, si la hay */
  zona: string | null;
  /** metros al borde de la finca (0 = dentro) */
  distanciaFincaM: number;
};

/** Finca y zona de un punto. Siempre devuelve la finca más cercana. */
export function ubicar(lat: number, lon: number): Ubicacion {
  const p: [number, number] = [lon, lat];
  const candidatos: Ubicacion[] = FINCAS_GEO.map((f) => {
    const d = Math.min(...f.piezas.map((a) => distancia(p, a)));
    let zona: string | null = null;
    if (d <= MARGEN_FINCA_M) {
      const porZona = f.zonas
        .map((z) => ({ nombre: z.nombre, d: distancia(p, z.anillo) }))
        .sort((a, b) => a.d - b.d)[0];
      if (porZona && porZona.d <= MARGEN_ZONA_M) zona = porZona.nombre;
    }
    return { clave: f.clave, finca: f.nombre, enFinca: d <= MARGEN_FINCA_M, zona, distanciaFincaM: Math.round(d) };
  });
  return candidatos.sort((a, b) => a.distanciaFincaM - b.distanciaFincaM)[0];
}

/** «a 350 m» / «a 2,4 km» */
export function textoDistancia(m: number) {
  return m < 1000 ? `a ${Math.round(m / 10) * 10} m` : `a ${(m / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} km`;
}
