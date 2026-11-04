import type { Finca, Incidencia, ZonaSector } from "@/lib/datos";
import { aDibujo, claveDeFinca, FORMAS, GEO, metrosPorUnidad, PLANOS, type ClaveFinca } from "@/lib/geografia";
import { formatoNumero, normalizar } from "@/lib/texto";
import { DibujoCorvera, DibujoLobosillo, DibujoValladolises, Patrones } from "@/components/DibujosFincas";

/*
 * Plano de una finca con su forma real: el mismo dibujo calcado de Google Earth que
 * el mapa de inicio, más encima las zonas (pulsables) o los sectores de riego.
 * Dónde cae cada zona y sector está en PLANOS (geografia.ts); lo que aún no está
 * situado sale debajo como «sin situar», para ir completándolo con la familia.
 */

export const COLOR_SECTOR = ["#2f7fb0", "#c98a2a", "#8e44ad", "#16a085"];

/** Color de la chincheta de cada tipo de incidencia. */
export const COLOR_INCIDENCIA: Record<Incidencia["tipo"], string> = {
  fuga_riego: "#1d6fd1",
  averia: "#c0392b",
  plaga: "#8e44ad",
  arbol: "#2f7a34",
  piscina: "#1d6fd1",
  otro: "#c98a2a",
};

/** Abre Google Maps justo en ese punto (para ir andando o en coche). */
export function enlaceComoLlegar(lat: number, lon: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;
}

/** Chincheta pixel art de una incidencia con sitio exacto (pulsable: «Cómo llegar»). */
function Chincheta({ x, y, color, titulo, href }: { x: number; y: number; color: string; titulo: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${titulo}: cómo llegar`}>
      <title>{`${titulo} · pulsa para ver cómo llegar`}</title>
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx={0} cy={0} rx={5} ry={2} fill="#3b2a1a" opacity={0.35} />
        <rect x={-1} y={-12} width={2} height={12} fill="#3b2a1a" />
        <rect x={-7} y={-24} width={14} height={13} rx={2} fill={color} stroke="#ffffff" strokeWidth={2} />
        <rect x={-1.5} y={-21} width={3} height={5} fill="#ffffff" />
        <rect x={-1.5} y={-15} width={3} height={2.5} fill="#ffffff" />
      </g>
    </a>
  );
}

const MARGEN = 24;

function Cartel({ x, y, texto, activa }: { x: number; y: number; texto: string; activa?: boolean }) {
  const ancho = Math.max(50, texto.length * 8 + 16);
  return (
    <g>
      <rect
        x={x - ancho / 2}
        y={y - 16}
        width={ancho}
        height={22}
        rx={3}
        fill={activa ? "#f6d743" : "#f6e7c1"}
        stroke="#3b2a1a"
        strokeWidth={2}
      />
      <text x={x} y={y} textAnchor="middle" fontSize={13} fontWeight={700} fill="#3b2a1a">
        {texto}
      </text>
    </g>
  );
}

/** Barra de escala con una medida redonda (10, 20, 50, 100… m). */
function Escala({ x, y, mpu }: { x: number; y: number; mpu: number }) {
  const objetivo = 90 * mpu; // ~90 unidades de dibujo
  const metros = [10, 20, 25, 50, 100, 200, 250, 500].reduce((m, c) => (c <= objetivo ? c : m), 10);
  const largo = metros / mpu;
  return (
    <g pointerEvents="none">
      <rect x={x - 4} y={y - 18} width={largo + 8} height={28} rx={3} fill="#f6e7c1" stroke="#3b2a1a" strokeWidth={1.5} opacity={0.92} />
      <rect x={x} y={y} width={largo} height={5} fill="#3b2a1a" />
      <rect x={x} y={y} width={largo / 2} height={5} fill="#f6e7c1" stroke="#3b2a1a" strokeWidth={1} />
      <text x={x + largo / 2} y={y - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#3b2a1a">
        {metros} m
      </text>
    </g>
  );
}

function Norte({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      <circle r={15} fill="#f6e7c1" stroke="#3b2a1a" strokeWidth={1.5} opacity={0.92} />
      <polygon points="0,-11 5,3 0,0 -5,3" fill="#c0392b" />
      <text y={12} textAnchor="middle" fontSize={9} fontWeight={700} fill="#3b2a1a">
        N
      </text>
    </g>
  );
}

export function tienePlano(finca: Finca) {
  return claveDeFinca(finca.nombre) !== null;
}

/** Zonas de la finca que todavía no están situadas en el plano. */
export function zonasSinSituar(finca: Finca) {
  const clave = claveDeFinca(finca.nombre);
  if (!clave) return finca.zonas;
  return finca.zonas.filter((z) => !PLANOS[clave].zonas[normalizar(z.nombre)]);
}

export function notaPlano(finca: Finca) {
  const clave = claveDeFinca(finca.nombre);
  return clave ? PLANOS[clave].nota : null;
}

function Dibujo({ clave, pantano, piscina }: { clave: ClaveFinca; pantano: string | null; piscina: boolean }) {
  if (clave === "corvera") return <DibujoCorvera pantano={pantano} detalle />;
  if (clave === "valladolises") return <DibujoValladolises pantano={pantano} piscina={piscina} detalle />;
  return <DibujoLobosillo detalle completa />;
}

export function PlanoFinca({
  finca,
  zonaSel,
  vista,
  zonaSector,
  base,
  piscina = false,
  zonaSobre = null,
  incidencias = [],
  onElegir,
  onSobre,
}: {
  finca: Finca;
  zonaSel: string | null;
  vista: "zonas" | "sectores";
  zonaSector: ZonaSector[];
  base: string;
  piscina?: boolean;
  /** zona bajo el ratón (se resalta sin elegirla) */
  zonaSobre?: string | null;
  /** incidencias abiertas de la finca: las que tienen sitio exacto salen como chinchetas */
  incidencias?: Incidencia[];
  /** si se pasa, pulsar una zona la elige sin recargar la página */
  onElegir?: (zonaId: string) => void;
  onSobre?: (zonaId: string | null) => void;
}) {
  const clave = claveDeFinca(finca.nombre);
  if (!clave) return null;

  const forma = FORMAS[clave];
  const plano = PLANOS[clave];
  const { x, y, w, h } = forma.cajaFicha ?? forma.caja;
  // sitio extra abajo para el cartel del pantano, la escala y el norte
  const vb = { x: x - MARGEN, y: y - MARGEN, w: w + MARGEN * 2, h: h + MARGEN * 2 + 40 };

  const areaHa = finca.superficie_ha != null ? Number(finca.superficie_ha) : GEO[clave].areaHaPorDefecto;
  const mpu = metrosPorUnidad(clave, areaHa);
  const pantano = finca.pantanos[0]?.capacidad_m3 != null ? formatoNumero(Number(finca.pantanos[0].capacidad_m3)) : null;

  const sectores = [...finca.sectores_riego].sort((a, b) => a.numero - b.numero);
  const colorSector = (numero: number) => {
    const i = sectores.findIndex((s) => s.numero === numero);
    return COLOR_SECTOR[(i < 0 ? numero - 1 : i) % COLOR_SECTOR.length];
  };
  const sectoresDeZona = (zid: string) =>
    zonaSector
      .filter((zs) => zs.zona_id === zid)
      .map((zs) => sectores.find((s) => s.id === zs.sector_id)?.numero)
      .filter((n): n is number => n != null);

  const zonasSituadas = finca.zonas
    .map((z) => ({ z, trozo: plano.zonas[normalizar(z.nombre)] }))
    .filter((t) => t.trozo);

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className="pixel mx-auto block max-h-[68vh] w-full"
      role="img"
      aria-label={`Plano de ${finca.nombre}`}
      style={{ fontFamily: "var(--font-pixel)" }}
    >
      <Patrones />
      <defs>
        <pattern id="pf-rayado" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="10" fill="#ffffff" opacity="0.5" />
        </pattern>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#86bd5b" />

      <Dibujo clave={clave} pantano={pantano} piscina={piscina} />

      {/* Zonas: trozos pulsables */}
      {vista === "zonas" &&
        zonasSituadas.map(({ z, trozo }) => {
          const activa = zonaSel === z.id;
          const encima = zonaSobre === z.id && !activa;
          return (
            <a
              key={z.id}
              href={`${base}?zona=${z.id}`}
              aria-label={`Zona ${z.nombre}`}
              aria-current={activa ? "true" : undefined}
              className="cursor-pointer outline-none"
              onClick={(e) => {
                if (!onElegir) return;
                e.preventDefault();
                onElegir(z.id);
              }}
              onMouseEnter={() => onSobre?.(z.id)}
              onMouseLeave={() => onSobre?.(null)}
              onFocus={() => onSobre?.(z.id)}
              onBlur={() => onSobre?.(null)}
            >
              {trozo!.poligono && (
                <polygon
                  points={trozo!.poligono}
                  fill={activa ? "#f6d743" : "#ffffff"}
                  fillOpacity={activa ? 0.28 : encima ? 0.16 : 0.001}
                  stroke={activa || encima ? "#f6d743" : "#fff4d6"}
                  strokeOpacity={activa || encima ? 1 : 0.7}
                  strokeWidth={activa ? 4 : encima ? 3 : 2}
                  strokeDasharray={activa ? undefined : "6 5"}
                  strokeLinejoin="round"
                />
              )}
              <Cartel x={trozo!.etiqueta.x} y={trozo!.etiqueta.y} texto={z.nombre} activa={activa || encima} />
            </a>
          );
        })}

      {/* Sectores de riego: colores por sector */}
      {vista === "sectores" &&
        sectores.map((s) => {
          const trozo = plano.sectores[s.numero];
          if (!trozo) return null;
          return (
            <g key={s.id} pointerEvents="none">
              {(trozo.poligonos ?? (trozo.poligono ? [trozo.poligono] : [])).map((pz) => (
                <polygon
                  key={pz}
                  points={pz}
                  fill={colorSector(s.numero)}
                  fillOpacity={0.42}
                  stroke={colorSector(s.numero)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ))}
              <rect x={trozo.etiqueta.x - 17} y={trozo.etiqueta.y - 15} width={34} height={22} rx={4} fill="#ffffff" stroke="#3b2a1a" strokeWidth={2} />
              <text x={trozo.etiqueta.x} y={trozo.etiqueta.y + 1} textAnchor="middle" fontSize={14} fontWeight={700} fill="#3b2a1a">
                S{s.numero}
              </text>
            </g>
          );
        })}

      {/* Sectores sin situar: la finca entera rayada */}
      {vista === "sectores" && sectores.length > 0 && sectores.every((s) => !plano.sectores[s.numero]) && forma.contorno && (
        <g pointerEvents="none">
          {(forma.piezas ?? [forma.contorno]).map((pz) => (
            <polygon key={pz} points={pz} fill="url(#pf-rayado)" />
          ))}
        </g>
      )}

      {/* zona seleccionada con sus sectores, como pista en la vista de zonas */}
      {vista === "zonas" &&
        zonasSituadas
          .filter(({ z }) => z.id === zonaSel && sectoresDeZona(z.id).length > 0)
          .map(({ z, trozo }) => (
            <text
              key={`s-${z.id}`}
              x={trozo!.etiqueta.x}
              y={trozo!.etiqueta.y + 20}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="#fff4d6"
              stroke="#3b2a1a"
              strokeWidth={3}
              paintOrder="stroke"
              pointerEvents="none"
            >
              Riega: {sectoresDeZona(z.id).map((n) => `S${n}`).join(", ")}
            </text>
          ))}

      {/* Incidencias con su sitio exacto (atajo «Incidencia» de Siri) */}
      {incidencias
        .filter((i) => i.lat != null && i.lon != null)
        .map((i) => {
          const p = aDibujo(clave, i.lat!, i.lon!);
          return (
            <Chincheta
              key={i.id}
              x={p.x}
              y={p.y}
              color={COLOR_INCIDENCIA[i.tipo]}
              titulo={i.titulo}
              href={enlaceComoLlegar(i.lat!, i.lon!)}
            />
          );
        })}

      <Escala x={vb.x + 16} y={vb.y + vb.h - 16} mpu={mpu} />
      <Norte x={vb.x + 26} y={vb.y + 26} />
    </svg>
  );
}
