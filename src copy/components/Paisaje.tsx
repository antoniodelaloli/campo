import { memo } from "react";
import { aMapa, FORMAS, GEO, metrosPorUnidad, type ClaveFinca } from "@/lib/geografia";

/*
 * Paisaje del Campo de Cartagena alrededor de las fincas.
 *
 * - SITIOS REALES (con las distancias acortadas igual que las fincas):
 *   aeropuerto de la Región de Murcia, pueblos de Corvera, Valladolises y Lobosillo
 *   y la Sierra de Carrascoy al norte.
 * - Lo demás (parcelas, caminos, balsas, casas, rambla, autovía) es ilustración
 *   generada con una semilla fija: siempre sale igual, pero no es cartografía.
 * - Colores apagados a propósito, para que las fincas destaquen.
 *
 * Coordenadas en metros del mapa (ver lib/geografia.ts).
 */

// ------------------------------------------------------------------
// Sitios reales (lat/lon de Wikipedia/IGN, pasados a coordenadas del mapa)
// ------------------------------------------------------------------
type Pt = { x: number; y: number };

const AEROPUERTO: Pt = { x: 4696, y: 4883 }; // 37.8026, -1.1254 · pista 05/23
const PUEBLOS: { id: string; nombre: string; c: Pt; casas: number }[] = [
  { id: "corvera", nombre: "Corvera (pueblo)", c: { x: 3770, y: 4049 }, casas: 46 },
  { id: "valladolises", nombre: "Valladolises (pueblo)", c: { x: 4700, y: 5590 }, casas: 30 },
  { id: "lobosillo", nombre: "Lobosillo (pueblo)", c: { x: 5671, y: 6903 }, casas: 34 },
];
// Cresta de la Sierra de Carrascoy (SO → NE)
const CRESTA: Pt[] = [
  { x: -2500, y: 6110 },
  { x: 619, y: 4200 },
  { x: 2251, y: 3199 },
  { x: 4749, y: 1624 },
  { x: 11000, y: -2310 },
];
const PIE_SIERRA = 700;

/** Cuánto se apaga el paisaje (0 = nada, 1 = todo gris). */
const VELO = 0.28; // metros (de mapa) desde la cresta hasta el llano

/** Nombres que se muestran sobre el mapa (HTML, tamaño fijo). */
export const LUGARES: { id: string; nombre: string; x: number; y: number; tipo: "pueblo" | "paraje" | "infra" }[] = [
  // el nombre va donde no lo tape el cartel de la finca vecina
  { id: "corvera", nombre: PUEBLOS[0].nombre, x: PUEBLOS[0].c.x - 40, y: PUEBLOS[0].c.y - 215, tipo: "pueblo" },
  { id: "valladolises", nombre: PUEBLOS[1].nombre, x: PUEBLOS[1].c.x - 60, y: PUEBLOS[1].c.y + 215, tipo: "pueblo" },
  { id: "lobosillo", nombre: PUEBLOS[2].nombre, x: PUEBLOS[2].c.x - 40, y: PUEBLOS[2].c.y - 215, tipo: "pueblo" },
  { id: "aeropuerto", nombre: "Aeropuerto Región de Murcia", x: AEROPUERTO.x + 260, y: AEROPUERTO.y + 120, tipo: "infra" },
  { id: "carrascoy", nombre: "Sierra de Carrascoy", x: 2350, y: 3050, tipo: "paraje" },
];

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------
function semilla(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cresta(x: number) {
  for (let i = 0; i < CRESTA.length - 1; i++) {
    const a = CRESTA[i];
    const b = CRESTA[i + 1];
    if (x >= a.x && x <= b.x) return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
  }
  return x < CRESTA[0].x ? CRESTA[0].y : CRESTA[CRESTA.length - 1].y;
}

function distSegmento(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distLinea(p: Pt, linea: Pt[]) {
  let d = Infinity;
  for (let i = 0; i < linea.length - 1; i++) d = Math.min(d, distSegmento(p, linea[i], linea[i + 1]));
  return d;
}

const ruta = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${Math.round(p.x)} ${Math.round(p.y)}`).join(" ");

// Cajas de las fincas (con su superficie por defecto) para no pintar encima
const CAJAS_FINCAS = (Object.keys(GEO) as ClaveFinca[]).map((c) => {
  const k = metrosPorUnidad(c, GEO[c].areaHaPorDefecto);
  const { x, y } = aMapa(GEO[c].e, GEO[c].n);
  const f = FORMAS[c];
  const tx = x - f.centro.x * k;
  const ty = y - f.centro.y * k;
  return {
    x0: tx + f.caja.x * k,
    y0: ty + f.caja.y * k,
    x1: tx + (f.caja.x + f.caja.w) * k,
    y1: ty + (f.caja.y + f.caja.h) * k,
  };
});

function dentroDeFinca(p: Pt, margen: number) {
  return CAJAS_FINCAS.some(
    (c) => p.x > c.x0 - margen && p.x < c.x1 + margen && p.y > c.y0 - margen && p.y < c.y1 + margen,
  );
}

// ------------------------------------------------------------------
// Carreteras, caminos y rambla
// ------------------------------------------------------------------
const AUTOVIA: Pt[] = [
  { x: 5100, y: 1500 },
  { x: 5541, y: 2718 },
  { x: 6473, y: 5196 },
  { x: 7406, y: 7674 },
  { x: 8300, y: 10100 },
];

const CARRETERAS: Pt[][] = [
  // Corvera → hacia el aeropuerto y Valladolises
  [PUEBLOS[0].c, { x: 3860, y: 5060 }, { x: 4600, y: 5190 }, PUEBLOS[1].c],
  // Valladolises → Lobosillo
  [PUEBLOS[1].c, { x: 4790, y: 6060 }, PUEBLOS[2].c],
  // Valladolises → autovía (por el norte de la finca)
  [PUEBLOS[1].c, { x: 4790, y: 5380 }, { x: 6343, y: 4850 }],
  // Lobosillo → autovía
  [PUEBLOS[2].c, { x: 7179, y: 7070 }],
  // Corvera → hacia el oeste
  [PUEBLOS[0].c, { x: 2600, y: 4500 }, { x: 900, y: 5000 }, { x: -1500, y: 5300 }],
  // Lobosillo → hacia el sur
  [PUEBLOS[2].c, { x: 5500, y: 8200 }, { x: 5300, y: 10500 }],
  // acceso al aeropuerto
  [{ x: 4200, y: 5130 }, { x: 4560, y: 4985 }],
];

const CAMINOS: Pt[][] = [
  // accesos a las fincas
  [{ x: 4060, y: 4945 }, { x: 3880, y: 5060 }],
  [{ x: 4880, y: 5660 }, { x: 4770, y: 5660 }],
  [{ x: 5745, y: 7110 }, { x: 5690, y: 6940 }],
  // pistas de monte
  [PUEBLOS[0].c, { x: 3400, y: 3300 }, { x: 3100, y: 2500 }],
  [{ x: 2600, y: 4500 }, { x: 2200, y: 3700 }],
];

const RAMBLA: Pt[] = [
  { x: 2500, y: 3650 },
  { x: 2900, y: 4250 },
  { x: 3300, y: 4750 },
  { x: 3650, y: 5250 },
  { x: 4100, y: 5800 },
  { x: 4500, y: 6300 },
  { x: 5300, y: 6560 },
  { x: 6400, y: 6720 },
  { x: 7600, y: 6650 },
  { x: 9000, y: 6900 },
  { x: 11000, y: 7100 },
];

// ------------------------------------------------------------------
// Parcelas (mosaico de cultivos) · generado una vez, siempre igual
// ------------------------------------------------------------------
type TipoParcela = "citricos" | "hortalizas" | "labrado" | "secano" | "invernadero" | "erial" | "balsa";

const PESOS: [TipoParcela, number][] = [
  ["citricos", 0.31],
  ["hortalizas", 0.13],
  ["labrado", 0.16],
  ["secano", 0.16],
  ["invernadero", 0.08],
  ["erial", 0.12],
  ["balsa", 0.04],
];

const ANGULO = -14; // grados: la cuadrícula de caminos está algo girada
const CENTRO_MALLA: Pt = { x: 5200, y: 6000 };
const CELDA = 200;
const CALLE = 14;

type Parcela = { u: number; v: number; w: number; h: number; tipo: TipoParcela; casa: boolean };

function generarParcelas(): Parcela[] {
  const azar = semilla(20261031);
  const cos = Math.cos((ANGULO * Math.PI) / 180);
  const sin = Math.sin((ANGULO * Math.PI) / 180);
  const aMundo = (u: number, v: number): Pt => ({
    x: CENTRO_MALLA.x + u * cos - v * sin,
    y: CENTRO_MALLA.y + u * sin + v * cos,
  });
  const libre = (p: Pt, r: number) => {
    if (p.x < -1500 || p.x > 11500 || p.y > 11500) return false;
    if (p.y < cresta(p.x) + PIE_SIERRA - r * 0.2) return false;
    if (dentroDeFinca(p, 40 + r * 0.6)) return false;
    if (PUEBLOS.some((pu) => Math.hypot(p.x - pu.c.x, p.y - pu.c.y) < 175 + r * 0.6)) return false;
    // recinto del aeropuerto (girado con la pista)
    const dx = p.x - AEROPUERTO.x;
    const dy = p.y - AEROPUERTO.y;
    const largo = dx * 0.766 - dy * 0.643;
    const ancho = dx * 0.643 + dy * 0.766;
    if (Math.abs(largo) < 420 + r * 0.6 && Math.abs(ancho) < 150 + r * 0.6) return false;
    if (distLinea(p, AUTOVIA) < 26 + r * 0.45) return false;
    if (distLinea(p, RAMBLA) < 38 + r * 0.45) return false;
    return true;
  };
  const elegir = (): TipoParcela => {
    let r = azar();
    for (const [t, peso] of PESOS) {
      if ((r -= peso) <= 0) return t;
    }
    return "erial";
  };

  const parcelas: Parcela[] = [];
  for (let u = -6600; u < 6600; u += CELDA) {
    for (let v = -5600; v < 5800; v += CELDA) {
      const r = azar();
      const trozos: { u: number; v: number; w: number; h: number }[] = [];
      if (r < 0.34) {
        const corte = CELDA * (0.35 + azar() * 0.3);
        trozos.push({ u, v, w: corte, h: CELDA }, { u: u + corte, v, w: CELDA - corte, h: CELDA });
      } else if (r < 0.56) {
        const corte = CELDA * (0.35 + azar() * 0.3);
        trozos.push({ u, v, w: CELDA, h: corte }, { u, v: v + corte, w: CELDA, h: CELDA - corte });
      } else {
        trozos.push({ u, v, w: CELDA, h: CELDA });
      }
      for (const t of trozos) {
        const w = t.w - CALLE;
        const h = t.h - CALLE;
        const centro = aMundo(t.u + t.w / 2, t.v + t.h / 2);
        const radio = Math.hypot(w, h) / 2;
        if (!libre(centro, radio)) continue;
        const tipo = elegir();
        parcelas.push({
          u: t.u + CALLE / 2,
          v: t.v + CALLE / 2,
          w,
          h,
          tipo,
          casa: tipo !== "balsa" && tipo !== "invernadero" && azar() < 0.07,
        });
      }
    }
  }
  return parcelas;
}

const PARCELAS = generarParcelas();

// Casas de los pueblos
type Casa = { x: number; y: number; w: number; h: number };
const CASAS: Record<string, Casa[]> = Object.fromEntries(
  PUEBLOS.map((p, i) => {
    const azar = semilla(900 + i);
    const casas: Casa[] = [];
    let intentos = 0;
    while (casas.length < p.casas && intentos < p.casas * 6) {
      intentos++;
      const ang = azar() * Math.PI * 2;
      const dist = Math.sqrt(azar()) * 165;
      const c = { x: p.c.x + Math.cos(ang) * dist, y: p.c.y + Math.sin(ang) * dist };
      if (dentroDeFinca(c, 25)) continue;
      if (Math.hypot(c.x - p.c.x, c.y - p.c.y) < 26) continue; // plaza e iglesia
      casas.push({ x: c.x, y: c.y, w: 13 + azar() * 13, h: 11 + azar() * 10 });
    }
    return [p.id, casas];
  }),
);

// Bordes dentados de la sierra
function bandaSierra(desde: number, hasta: number, sem: number) {
  const azar = semilla(sem);
  const arriba: Pt[] = [];
  const abajo: Pt[] = [];
  for (let x = -2600; x <= 11200; x += 140) {
    arriba.push({ x, y: cresta(x) + desde + (azar() - 0.5) * 70 });
    abajo.push({ x, y: cresta(x) + hasta + (azar() - 0.5) * 90 });
  }
  return [...arriba, ...abajo.reverse()].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
}

const SIERRA = {
  norte: bandaSierra(-3600, -380, 11),
  cresta: bandaSierra(-380, 140, 12),
  ladera: bandaSierra(140, 420, 13),
  pie: bandaSierra(420, PIE_SIERRA, 14),
};

// Roquedos y barrancos en la cresta
const ROCAS: Pt[] = (() => {
  const azar = semilla(77);
  const out: Pt[] = [];
  for (let x = -2000; x <= 10500; x += 260 + azar() * 260) out.push({ x, y: cresta(x) - 40 + azar() * 120 });
  return out;
})();

// Tarajes (árboles de rambla)
const TARAJES: Pt[] = (() => {
  const azar = semilla(55);
  const out: Pt[] = [];
  for (let i = 0; i < RAMBLA.length - 1; i++) {
    const a = RAMBLA[i];
    const b = RAMBLA[i + 1];
    const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 70);
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const lado = azar() < 0.5 ? -1 : 1;
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const l = Math.hypot(nx, ny);
      out.push({
        x: a.x + (b.x - a.x) * t + (nx / l) * lado * (34 + azar() * 10),
        y: a.y + (b.y - a.y) * t + (ny / l) * lado * (34 + azar() * 10),
      });
    }
  }
  return out;
})();

// ------------------------------------------------------------------
// Dibujo
// ------------------------------------------------------------------
const RELLENO: Record<TipoParcela, string> = {
  citricos: "url(#pz-citricos)",
  hortalizas: "url(#pz-hortalizas)",
  labrado: "url(#pz-labrado)",
  secano: "url(#pz-secano)",
  invernadero: "url(#pz-invernadero)",
  erial: "url(#pz-erial)",
  balsa: "#74a9c8",
};

function Patrones() {
  return (
    <defs>
      <pattern id="pz-suelo" width="90" height="90" patternUnits="userSpaceOnUse">
        <rect width="90" height="90" fill="#cbbb90" />
        <rect x="12" y="20" width="10" height="5" fill="#c2b085" />
        <rect x="60" y="64" width="12" height="5" fill="#c2b085" />
        <rect x="40" y="8" width="5" height="5" fill="#d3c49c" />
      </pattern>
      <pattern id="pz-citricos" width="18" height="15" patternUnits="userSpaceOnUse">
        <rect width="18" height="15" fill="#a5a174" />
        <rect x="3" y="2" width="11" height="9" fill="#6f8650" />
        <rect x="5" y="3" width="6" height="4" fill="#7f955b" />
      </pattern>
      <pattern id="pz-hortalizas" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#b3bb84" />
        <rect x="0" y="0" width="12" height="5" fill="#97a96b" />
      </pattern>
      <pattern id="pz-labrado" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#bb9d70" />
        <rect x="0" y="0" width="14" height="3" fill="#a98b60" />
      </pattern>
      <pattern id="pz-secano" width="30" height="30" patternUnits="userSpaceOnUse">
        <rect width="30" height="30" fill="#cfc195" />
        <rect x="4" y="5" width="7" height="6" fill="#949a64" />
        <rect x="19" y="20" width="7" height="6" fill="#949a64" />
      </pattern>
      <pattern id="pz-invernadero" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="#dedcd2" />
        <rect x="0" y="0" width="20" height="2" fill="#c6c4b8" />
        <rect x="0" y="8" width="20" height="4" fill="#e9e8e1" />
      </pattern>
      <pattern id="pz-erial" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#c3b88c" />
        <rect x="6" y="10" width="6" height="4" fill="#9f9c6d" />
        <rect x="26" y="28" width="6" height="4" fill="#9f9c6d" />
        <rect x="30" y="6" width="3" height="3" fill="#a99f75" />
      </pattern>
      <pattern id="pz-monte" width="36" height="36" patternUnits="userSpaceOnUse">
        <rect width="36" height="36" fill="#a6a275" />
        <rect x="5" y="6" width="7" height="5" fill="#86895c" />
        <rect x="22" y="22" width="7" height="5" fill="#86895c" />
      </pattern>
      <pattern id="pz-pinar" width="34" height="34" patternUnits="userSpaceOnUse">
        <rect width="34" height="34" fill="#87895f" />
        <rect x="4" y="4" width="10" height="9" fill="#5f7146" />
        <rect x="20" y="19" width="10" height="9" fill="#5f7146" />
        <rect x="7" y="6" width="4" height="3" fill="#6f8152" />
      </pattern>
      <pattern id="pz-cresta" width="34" height="34" patternUnits="userSpaceOnUse">
        <rect width="34" height="34" fill="#7a7f58" />
        <rect x="4" y="4" width="10" height="9" fill="#55663e" />
        <rect x="21" y="18" width="10" height="9" fill="#55663e" />
        <rect x="16" y="2" width="6" height="4" fill="#968e76" />
      </pattern>
    </defs>
  );
}

function Pueblo({ id, c }: { id: string; c: Pt }) {
  return (
    <g>
      {/* calles en cruz */}
      <rect x={c.x - 170} y={c.y - 5} width={340} height={10} fill="#d8ceb6" />
      <rect x={c.x - 5} y={c.y - 170} width={10} height={340} fill="#d8ceb6" />
      {CASAS[id].map((k, i) => (
        <g key={i}>
          <rect x={k.x - k.w / 2} y={k.y - k.h / 2} width={k.w} height={k.h} fill="#ebe3d0" stroke="#9c8f78" strokeWidth={1.5} />
          <rect x={k.x - k.w / 2} y={k.y - k.h / 2} width={k.w} height={k.h * 0.45} fill="#b9785e" />
        </g>
      ))}
      {/* iglesia en la plaza */}
      <rect x={c.x - 18} y={c.y - 12} width={36} height={26} fill="#efe7d4" stroke="#8d7f68" strokeWidth={2} />
      <rect x={c.x - 18} y={c.y - 12} width={36} height={10} fill="#a8694f" />
      <rect x={c.x + 10} y={c.y - 26} width={10} height={16} fill="#efe7d4" stroke="#8d7f68" strokeWidth={2} />
    </g>
  );
}

function Aeropuerto() {
  const { x, y } = AEROPUERTO;
  return (
    <g transform={`translate(${x} ${y}) rotate(-40)`}>
      {/* recinto de hierba segada */}
      <rect x={-430} y={-150} width={860} height={300} fill="#b3b386" stroke="#d6d2bf" strokeWidth={4} />
      {/* pista 05/23 */}
      <rect x={-330} y={-24} width={660} height={48} fill="#6f6f75" />
      <line x1={-300} y1={0} x2={300} y2={0} stroke="#f2f2ee" strokeWidth={3} strokeDasharray="26 22" />
      {[-318, 300].map((px) => (
        <g key={px} fill="#f2f2ee">
          <rect x={px} y={-18} width={18} height={4} />
          <rect x={px} y={-8} width={18} height={4} />
          <rect x={px} y={4} width={18} height={4} />
          <rect x={px} y={14} width={18} height={4} />
        </g>
      ))}
      {/* calle de rodaje, plataforma y terminal */}
      <rect x={-300} y={60} width={600} height={16} fill="#85858a" />
      <rect x={-40} y={30} width={14} height={36} fill="#85858a" />
      <rect x={-120} y={76} width={240} height={70} fill="#9a9a9e" />
      <rect x={-90} y={112} width={180} height={34} fill="#e2ddd0" stroke="#8f8878" strokeWidth={3} />
      <rect x={-90} y={112} width={180} height={10} fill="#a9b8c4" />
    </g>
  );
}

function Caserio({ p }: { p: Parcela }) {
  const x = p.u + p.w - 30;
  const y = p.v + 8;
  return (
    <g>
      <rect x={x} y={y} width={20} height={14} fill="#ebe3d0" stroke="#9c8f78" strokeWidth={1.5} />
      <rect x={x} y={y} width={20} height={6} fill="#b9785e" />
      <rect x={x - 12} y={y + 16} width={8} height={8} fill="#6f8650" />
      <rect x={x + 22} y={y + 4} width={8} height={8} fill="#6f8650" />
    </g>
  );
}

function PaisajeBase() {
  return (
    <g>
      <Patrones />
      {/* suelo general */}
      <rect x={-20000} y={-20000} width={52000} height={52000} fill="url(#pz-suelo)" />

      {/* mosaico de parcelas (girado como la red de caminos) */}
      <g transform={`translate(${CENTRO_MALLA.x} ${CENTRO_MALLA.y}) rotate(${ANGULO})`}>
        {PARCELAS.map((p, i) =>
          p.tipo === "balsa" ? (
            <g key={i}>
              <rect x={p.u} y={p.v} width={p.w} height={p.h} fill="url(#pz-erial)" />
              <rect
                x={p.u + p.w * 0.18}
                y={p.v + p.h * 0.18}
                width={p.w * 0.64}
                height={p.h * 0.64}
                fill="#74a9c8"
                stroke="#a08d68"
                strokeWidth={7}
              />
            </g>
          ) : (
            <rect key={i} x={p.u} y={p.v} width={p.w} height={p.h} fill={RELLENO[p.tipo]} />
          ),
        )}
        {PARCELAS.filter((p) => p.casa).map((p, i) => (
          <Caserio key={`c-${i}`} p={p} />
        ))}
      </g>

      {/* Sierra de Carrascoy */}
      <polygon points={SIERRA.pie} fill="url(#pz-monte)" />
      <polygon points={SIERRA.ladera} fill="url(#pz-pinar)" />
      <polygon points={SIERRA.cresta} fill="url(#pz-cresta)" />
      <polygon points={SIERRA.norte} fill="url(#pz-pinar)" />
      {ROCAS.map((r, i) => (
        <g key={i}>
          <rect x={r.x - 40} y={r.y - 14} width={80} height={28} fill="#9d9580" />
          <rect x={r.x - 20} y={r.y - 26} width={44} height={16} fill="#b0a892" />
        </g>
      ))}

      {/* rambla seca con tarajes */}
      <path d={ruta(RAMBLA)} fill="none" stroke="#c4b288" strokeWidth={72} strokeLinejoin="round" />
      <path d={ruta(RAMBLA)} fill="none" stroke="#e3d5ad" strokeWidth={54} strokeLinejoin="round" />
      <path d={ruta(RAMBLA)} fill="none" stroke="#efe4c3" strokeWidth={6} strokeDasharray="30 40" />
      {TARAJES.map((t, i) => (
        <rect key={i} x={t.x - 7} y={t.y - 6} width={14} height={12} fill="#879565" />
      ))}

      {/* caminos de tierra */}
      {CAMINOS.map((c, i) => (
        <path key={i} d={ruta(c)} fill="none" stroke="#c9ad7c" strokeWidth={9} strokeLinecap="square" />
      ))}

      {/* carreteras */}
      {CARRETERAS.map((c, i) => (
        <g key={i} fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path d={ruta(c)} stroke="#968f82" strokeWidth={15} />
          <path d={ruta(c)} stroke="#b7b0a1" strokeWidth={10} />
        </g>
      ))}

      {/* autovía */}
      <g fill="none" strokeLinejoin="round">
        <path d={ruta(AUTOVIA)} stroke="#6b6b70" strokeWidth={40} />
        <path d={ruta(AUTOVIA)} stroke="#8d8d92" strokeWidth={34} />
        <path d={ruta(AUTOVIA)} stroke="#b9b9a8" strokeWidth={4} />
        <path d={ruta(AUTOVIA)} stroke="#e4e4dc" strokeWidth={1.5} strokeDasharray="14 18" transform="translate(9 0)" />
        <path d={ruta(AUTOVIA)} stroke="#e4e4dc" strokeWidth={1.5} strokeDasharray="14 18" transform="translate(-9 0)" />
      </g>

      <Aeropuerto />
      {PUEBLOS.map((p) => (
        <Pueblo key={p.id} id={p.id} c={p.c} />
      ))}

      {/* velo gris claro (~28 %): apaga el entorno para que destaquen las fincas.
          Es un rectángulo semitransparente, más ligero que un filtro al mover el mapa. */}
      <rect x={-20000} y={-20000} width={52000} height={52000} fill="#c9c5b8" opacity={VELO} pointerEvents="none" />
    </g>
  );
}

/** Capa de paisaje: no depende de nada, así que React no la vuelve a pintar al mover el mapa. */
export const Paisaje = memo(PaisajeBase);
