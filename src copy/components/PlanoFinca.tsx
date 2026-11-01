import type { Finca, ZonaSector } from "@/lib/datos";
import { normalizar } from "@/lib/texto";
import { HUECOS_VALLADOLISES } from "@/lib/geografia";

/*
 * Plano ilustrado de una finca, con las zonas pulsables.
 * Solo existe para las fincas cuyo dibujo conocemos (Valladolises y Corvera);
 * para el resto, la página usa un mosaico de zonas.
 * Las formas son orientativas: el plano real se dibujará sobre la ortofoto del PNOA.
 */

const COLOR_SECTOR = ["#2f7fb0", "#c98a2a", "#8e44ad", "#16a085"];

function Defs() {
  return (
    <defs>
      <pattern id="pf-limonero" width="28" height="24" patternUnits="userSpaceOnUse">
        <rect width="28" height="24" fill="#b98c5a" />
        <rect x="5" y="4" width="18" height="14" fill="#2f7a34" />
        <rect x="8" y="5" width="12" height="9" fill="#46a047" />
        <rect x="10" y="7" width="2" height="2" fill="#f6d743" />
        <rect x="16" y="10" width="2" height="2" fill="#f6d743" />
        <rect x="13" y="13" width="2" height="2" fill="#f6d743" />
        <rect x="12" y="20" width="4" height="3" fill="#5e3b1c" />
      </pattern>
      <pattern id="pf-mandarino" width="28" height="24" patternUnits="userSpaceOnUse">
        <rect width="28" height="24" fill="#b98c5a" />
        <rect x="5" y="4" width="18" height="14" fill="#37803a" />
        <rect x="8" y="5" width="12" height="9" fill="#4fa54a" />
        <rect x="10" y="7" width="3" height="3" fill="#ef8a22" />
        <rect x="16" y="10" width="3" height="3" fill="#ef8a22" />
        <rect x="12" y="20" width="4" height="3" fill="#5e3b1c" />
      </pattern>
      <pattern id="pf-arbol" width="28" height="24" patternUnits="userSpaceOnUse">
        <rect width="28" height="24" fill="#b98c5a" />
        <rect x="5" y="4" width="18" height="14" fill="#3d7a3a" />
        <rect x="8" y="5" width="12" height="9" fill="#5a9a50" />
        <rect x="12" y="20" width="4" height="3" fill="#5e3b1c" />
      </pattern>
      <pattern id="pf-rayado" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="10" fill="#ffffff" opacity="0.45" />
      </pattern>
    </defs>
  );
}

function patron(especie: string | null) {
  const e = normalizar(especie ?? "");
  if (e.startsWith("mandarin")) return "url(#pf-mandarino)";
  if (e.startsWith("limon")) return "url(#pf-limonero)";
  return "url(#pf-arbol)";
}

function Etiqueta({ x, y, texto, activa }: { x: number; y: number; texto: string; activa: boolean }) {
  const ancho = Math.max(44, texto.length * 6.4 + 12);
  return (
    <g pointerEvents="none">
      <rect x={x - ancho / 2} y={y - 12} width={ancho} height={17} fill={activa ? "#f6d743" : "#f6e7c1"} stroke="#3b2a1a" strokeWidth={1.5} />
      <text x={x} y={y + 1} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#3b2a1a">
        {texto}
      </text>
    </g>
  );
}

export function tienePlano(finca: Finca) {
  const n = normalizar(finca.nombre);
  return n === "valladolises" || n === "corvera";
}

export function PlanoFinca({
  finca,
  zonaSel,
  vista,
  zonaSector,
  base,
}: {
  finca: Finca;
  zonaSel: string | null;
  vista: "zonas" | "sectores";
  zonaSector: ZonaSector[];
  base: string;
}) {
  const nombre = normalizar(finca.nombre);
  const sectores = [...finca.sectores_riego].sort((a, b) => a.numero - b.numero);
  const colorDe = (sectorId: string) => {
    const i = sectores.findIndex((s) => s.id === sectorId);
    return COLOR_SECTOR[i % COLOR_SECTOR.length];
  };
  const sectoresDeZona = (zid: string) => zonaSector.filter((zs) => zs.zona_id === zid).map((zs) => zs.sector_id);

  if (nombre === "valladolises") {
    return (
      <svg viewBox="-8 -8 276 246" className="pixel mx-auto block max-h-[62vh] w-full" role="img" aria-label={`Plano de ${finca.nombre}`} style={{ fontFamily: "var(--font-pixel)" }}>
        <Defs />
        <rect x={-8} y={-8} width={276} height={246} fill="#86bd5b" />
        <rect x={-4} y={-4} width={268} height={238} fill="#7a5230" />
        <rect x={0} y={0} width={260} height={230} fill="#a9b86a" />
        {finca.zonas.map((z) => {
          const h = HUECOS_VALLADOLISES[normalizar(z.nombre)];
          if (!h) return null;
          const activa = vista === "zonas" && zonaSel === z.id;
          const sz = sectoresDeZona(z.id);
          return (
            <a key={z.id} href={`${base}?zona=${z.id}`} aria-label={`Zona ${z.nombre}`}>
              <rect x={h.x} y={h.y} width={h.w} height={h.h} fill={patron(z.especie)} />
              {h.bancales && (
                <g fill="#8d6238" pointerEvents="none">
                  <rect x={h.x} y={h.y + 18} width={h.w} height={3} />
                  <rect x={h.x} y={h.y + 44} width={h.w} height={3} />
                  <rect x={h.x} y={h.y + 70} width={h.w} height={3} />
                </g>
              )}
              {vista === "sectores" &&
                (sz.length ? (
                  sz.map((sid, i) => (
                    <rect key={sid} x={h.x + (h.w / sz.length) * i} y={h.y} width={h.w / sz.length} height={h.h} fill={colorDe(sid)} opacity={0.4} />
                  ))
                ) : (
                  <rect x={h.x} y={h.y} width={h.w} height={h.h} fill="url(#pf-rayado)" />
                ))}
              {activa && <rect x={h.x + 1.5} y={h.y + 1.5} width={h.w - 3} height={h.h - 3} fill="none" stroke="#f6d743" strokeWidth={3} />}
            </a>
          );
        })}
        {/* casa y piscina */}
        <g pointerEvents="none">
          <rect x={14} y={12} width={46} height={34} fill="#f3e6c8" stroke="#3b2a1a" strokeWidth={2} />
          <polygon points="10,14 37,0 64,14" fill="#c0563a" stroke="#3b2a1a" strokeWidth={2} />
          <rect x={32} y={28} width={10} height={18} fill="#6b4423" />
          <rect x={64} y={56} width={44} height={30} fill="#f3f3f3" stroke="#3b2a1a" strokeWidth={2} />
          <rect x={68} y={60} width={36} height={22} fill="#4ac0e8" />
        </g>
        {finca.zonas.map((z) => {
          const h = HUECOS_VALLADOLISES[normalizar(z.nombre)];
          if (!h) return null;
          return <Etiqueta key={`e-${z.id}`} x={h.ex} y={h.ey} texto={z.nombre} activa={vista === "zonas" && zonaSel === z.id} />;
        })}
      </svg>
    );
  }

  if (nombre === "corvera") {
    // Formas: rectángulo grande (2 bandas = sectores 1 y 2) y parcela del panadero (sector 3)
    const formas: Record<string, { x: number; y: number; w: number; h: number; ex: number; ey: number }> = {
      "rectangulo grande": { x: 0, y: 0, w: 228, h: 240, ex: 114, ey: 200 },
      "parcela del panadero": { x: 236, y: 150, w: 64, h: 90, ex: 268, ey: 230 },
    };
    const sectorPorNumero = new Map(sectores.map((s) => [s.numero, s]));
    const bandas = [
      { n: 1, x: 0, y: 0, w: 108, h: 240 },
      { n: 2, x: 120, y: 0, w: 108, h: 240 },
      { n: 3, x: 236, y: 150, w: 64, h: 90 },
    ];
    return (
      <svg viewBox="-8 -8 320 260" className="pixel mx-auto block max-h-[62vh] w-full" role="img" aria-label={`Plano de ${finca.nombre}`} style={{ fontFamily: "var(--font-pixel)" }}>
        <Defs />
        <rect x={-8} y={-8} width={320} height={260} fill="#86bd5b" />
        <rect x={-4} y={-4} width={236} height={248} fill="#7a5230" />
        <rect x={232} y={146} width={72} height={98} fill="#7a5230" />
        {finca.zonas.map((z) => {
          const f = formas[normalizar(z.nombre)];
          if (!f) return null;
          const activa = vista === "zonas" && zonaSel === z.id;
          return (
            <a key={z.id} href={`${base}?zona=${z.id}`} aria-label={`Zona ${z.nombre}`}>
              <rect x={f.x} y={f.y} width={f.w} height={f.h} fill={patron(z.especie)} />
              {activa && <rect x={f.x + 1.5} y={f.y + 1.5} width={f.w - 3} height={f.h - 3} fill="none" stroke="#f6d743" strokeWidth={3} />}
            </a>
          );
        })}
        {/* caminos en cruz */}
        <rect x={108} y={0} width={12} height={240} fill="#e0bd80" pointerEvents="none" />
        <rect x={0} y={114} width={232} height={12} fill="#e0bd80" pointerEvents="none" />
        {/* pantano */}
        <rect x={236} y={4} width={62} height={104} rx={10} fill="#8b6b3d" />
        <rect x={240} y={8} width={54} height={96} rx={8} fill="#4aa3d9" />
        {vista === "sectores" &&
          bandas.map((b) => {
            const s = sectorPorNumero.get(b.n);
            if (!s) return null;
            return (
              <g key={b.n} pointerEvents="none">
                <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={colorDe(s.id)} opacity={0.38} />
                <rect x={b.x + b.w / 2 - 15} y={b.y + 10} width={30} height={18} fill="#ffffff" stroke="#3b2a1a" strokeWidth={1.5} />
                <text x={b.x + b.w / 2} y={b.y + 23} textAnchor="middle" fontSize={11} fontWeight={700} fill="#3b2a1a">
                  S{b.n}
                </text>
              </g>
            );
          })}
        {finca.zonas.map((z) => {
          const f = formas[normalizar(z.nombre)];
          if (!f) return null;
          // nombres largos: se usa el alias corto ("panadero") para que quepa
          const corto =
            z.nombre.length > 14 && z.alias[0]
              ? z.alias[0].charAt(0).toUpperCase() + z.alias[0].slice(1)
              : z.nombre;
          return <Etiqueta key={`e-${z.id}`} x={f.ex} y={f.ey} texto={corto} activa={vista === "zonas" && zonaSel === z.id} />;
        })}
      </svg>
    );
  }

  return null;
}
