// Dónde cae un punto (latitud, longitud) en las fincas: finca y zona.
// Polígonos en grados (lon, lat), sacados de Google Earth:
// - Valladolises: «Fincas.kml» de Antonio (3/11/2026), bloques y zonas.
// - Corvera: su contorno del mismo KML; sus dos zonas, pasadas del plano calcado.
// - Lobosillo: aún sin contorno: un círculo alrededor del punto marcado.
// Los dibujos son aproximados: se acepta un margen alrededor de cada zona.
// Sin dependencias: sirve en servidor y en cliente (funciona sin cobertura).
import { GEO, type ClaveFinca } from "@/lib/geografia";

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

const CORVERA: FincaGeo = {
  clave: "corvera",
  nombre: "Corvera",
  piezas: [[[-1.141422, 37.814917], [-1.149807, 37.810071], [-1.147261, 37.807327], [-1.145817, 37.807746], [-1.144696, 37.808464], [-1.143417, 37.809275], [-1.142630, 37.809755], [-1.142020, 37.809919], [-1.141313, 37.810930], [-1.140379, 37.812216], [-1.140758, 37.813440], [-1.139863, 37.813044], [-1.139191, 37.812729], [-1.138896, 37.813036], [-1.138983, 37.813334], [-1.139729, 37.813995]]],
  zonas: [
    { nombre: "Rectángulo grande", anillo: [[-1.141402, 37.814917], [-1.140693, 37.813406], [-1.140378, 37.812185], [-1.141980, 37.809929], [-1.142584, 37.809763], [-1.145815, 37.807735], [-1.147285, 37.807342], [-1.149807, 37.810074]] },
    { nombre: "Parcela del panadero", anillo: [[-1.141402, 37.814917], [-1.140955, 37.814710], [-1.140588, 37.814524], [-1.139695, 37.814006], [-1.138933, 37.813344], [-1.138880, 37.813033], [-1.139196, 37.812744], [-1.140693, 37.813406]] },
  ],
};

const FINCAS_GEO: FincaGeo[] = [VALLADOLISES, CORVERA];

/** Lobosillo (2,14 ha) aún no tiene contorno: se toma un círculo de este radio. */
const RADIO_LOBOSILLO_M = 110;
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
  const lob = GEO.lobosillo;
  const [dx, dy] = aMetros([lon, lat], [lob.lon, lob.lat]);
  const dLob = Math.max(0, Math.hypot(dx, dy) - RADIO_LOBOSILLO_M);
  candidatos.push({
    clave: "lobosillo",
    finca: "Lobosillo",
    enFinca: dLob <= MARGEN_FINCA_M,
    zona: null,
    distanciaFincaM: Math.round(dLob),
  });
  return candidatos.sort((a, b) => a.distanciaFincaM - b.distanciaFincaM)[0];
}

/** «a 350 m» / «a 2,4 km» */
export function textoDistancia(m: number) {
  return m < 1000 ? `a ${Math.round(m / 10) * 10} m` : `a ${(m / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} km`;
}
