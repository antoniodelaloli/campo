import { COLOR_TIPO_HITO, NOMBRE_TIPO_HITO, cuentaAtras, mesCorto, type ElementoAgenda } from "@/lib/agenda";
import { diasEntre, fechaCorta, sumarDias } from "@/lib/texto";
import type { TipoHito } from "@/lib/datos";
import { DeslizarAHoy } from "@/components/DeslizarAHoy";

export type PuntoLinea = ElementoAgenda & { hecho: boolean };

/** Ancho de la línea completa (unos 115 px por mes): se ven ~8 meses y se desliza. */
const ANCHO = 1400;
/** Ancho máximo de una etiqueta (px) y su hueco en % de la línea, para no pisarse. */
const ETIQUETA_PX = 220;
const ANCHO_ETIQUETA = ((ETIQUETA_PX + 12) / ANCHO) * 100;
/**
 * Distancia del centro de la línea al borde de la etiqueta. Los tres carriles de
 * cada lado se reparten por todo el alto disponible (de ahí los %).
 * Debajo se empieza más lejos para dejar sitio a los nombres de los meses.
 */
function separacion(lado: "arriba" | "abajo", n: number) {
  const inicio = lado === "arriba" ? 26 : 42;
  // el último carril queda a 64 px del borde (lo que mide una etiqueta + margen)
  return `(${inicio}px + ${n} * (50% - ${inicio + 64}px) / 2)`;
}
/** Carriles para las etiquetas: tres encima de la línea y tres debajo. */
const CARRILES = [
  { lado: "arriba", n: 0 },
  { lado: "abajo", n: 0 },
  { lado: "arriba", n: 1 },
  { lado: "abajo", n: 1 },
  { lado: "arriba", n: 2 },
  { lado: "abajo", n: 2 },
] as const;

/**
 * Línea de la campaña (octubre → septiembre) que ocupa el 70 % de la pantalla:
 * cada fecha clave es un punto con su etiqueta, hoy va marcado, lo pasado queda
 * sombreado y las fechas aproximadas llevan un tramo difuminado.
 * Cada punto lleva a su ficha en la lista de abajo.
 */
export function LineaCampana({
  puntos,
  campana,
  hoy,
}: {
  puntos: PuntoLinea[];
  campana: { nombre: string; desde: string; hasta: string };
  hoy: string;
}) {
  const total = diasEntre(campana.desde, campana.hasta) + 1;
  const pct = (iso: string) => Math.min(100, Math.max(0, (diasEntre(campana.desde, iso) / total) * 100));

  // meses de la campaña
  const meses: { iso: string; ancho: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const y = Number(campana.desde.slice(0, 4)) + (i >= 3 ? 1 : 0);
    const m = ((9 + i) % 12) + 1;
    const iso = `${y}-${String(m).padStart(2, "0")}-01`;
    const siguiente =
      i === 11 ? sumarDias(campana.hasta, 1) : `${m === 12 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, "0")}-01`;
    meses.push({ iso, ancho: (diasEntre(iso, siguiente) / total) * 100 });
  }

  // reparte las etiquetas en carriles para que no se pisen
  const ordenados = puntos
    .filter((p) => p.fecha && p.fecha >= campana.desde && p.fecha <= campana.hasta)
    .sort((a, b) => a.fecha!.localeCompare(b.fecha!));
  const finCarril = CARRILES.map(() => -Infinity);
  const colocados = ordenados.map((p) => {
    const x = pct(p.fecha!);
    let carril = finCarril.findIndex((fin) => x - ANCHO_ETIQUETA / 2 >= fin);
    if (carril === -1) carril = finCarril.indexOf(Math.min(...finCarril));
    finCarril[carril] = x + ANCHO_ETIQUETA / 2;
    return { p, x, carril: CARRILES[carril] };
  });

  const xHoy = hoy >= campana.desde && hoy <= campana.hasta ? pct(hoy) : null;
  const tipos = [...new Set(ordenados.map((p) => p.tipo))] as TipoHito[];
  const porDelante = ordenados.filter((p) => !p.hecho && p.fecha! >= hoy).length;

  return (
    <section
      className="panel flex h-[60vh] min-h-[420px] sm:h-[70vh] sm:min-h-[460px] flex-col gap-2 p-3.5 sm:p-4"
      aria-labelledby="titulo-linea"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="titulo-linea" className="titulo-pixel text-[24px]">
          Campaña {campana.nombre}
        </h2>
        <span className="text-sm font-bold text-tinta-suave">
          {porDelante} fecha{porDelante === 1 ? "" : "s"} clave por delante · de octubre a septiembre
        </span>
      </div>

      <DeslizarAHoy xHoy={xHoy}>
        <div className="relative h-full" style={{ width: ANCHO }}>
          {/* lo que ya ha pasado de la campaña, sombreado en todo el alto */}
          {xHoy !== null && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-[#5a3a1a]/[0.06]"
              style={{ width: `${xHoy}%` }}
              aria-hidden="true"
            />
          )}

          {/* separadores de mes en todo el alto */}
          {meses.slice(1).map((m) => (
            <div
              key={`sep-${m.iso}`}
              className="pointer-events-none absolute inset-y-0 w-px border-l-2 border-dotted border-borde-papel"
              style={{ left: `${pct(m.iso)}%` }}
              aria-hidden="true"
            />
          ))}

          {/* la línea, con los meses debajo */}
          <div
            className="absolute inset-x-0 top-1/2 flex h-5 -translate-y-1/2 border-[3px] border-madera-oscura"
            aria-hidden="true"
          >
            {meses.map((m, i) => (
              <div key={m.iso} className={i % 2 ? "bg-[#e6d5a8]" : "bg-[#f7edd2]"} style={{ width: `${m.ancho}%` }} />
            ))}
          </div>
          {xHoy !== null && (
            <div
              className="pointer-events-none absolute top-1/2 left-0 h-[14px] -translate-y-1/2 bg-[#5a3a1a]/30"
              style={{ width: `${xHoy}%` }}
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-x-0 flex" style={{ top: "calc(50% + 14px)" }} aria-hidden="true">
            {meses.map((m) => {
              const actual = hoy.slice(0, 7) === m.iso.slice(0, 7);
              return (
                <div
                  key={m.iso}
                  className={`text-center font-pixel text-[13px] uppercase ${actual ? "text-tinta" : "text-tinta-suave"}`}
                  style={{ width: `${m.ancho}%` }}
                >
                  {mesCorto(m.iso)}
                  {m.iso.slice(5, 7) === "01" || m.iso.slice(5, 7) === "10" ? ` ${m.iso.slice(2, 4)}` : ""}
                </div>
              );
            })}
          </div>

          {/* tramo difuminado de las fechas aproximadas (±7 días) */}
          {colocados
            .filter(({ p }) => p.aproximada)
            .map(({ p, x }) => (
              <div
                key={`aprox-${p.clave}`}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 h-5 -translate-x-1/2 -translate-y-1/2 opacity-60"
                style={{
                  left: `${x}%`,
                  width: `${(14 / total) * 100}%`,
                  background: `linear-gradient(90deg, transparent, ${p.hecho ? "#9a9488" : COLOR_TIPO_HITO[p.tipo]}, transparent)`,
                }}
              />
            ))}

          {/* hoy: raya en todo el alto, con su cartel arriba */}
          {xHoy !== null && (
            <div className="pointer-events-none absolute inset-y-0 z-10 w-0" style={{ left: `${xHoy}%` }} aria-hidden="true">
              <div className="absolute inset-y-0 -left-[1.5px] w-[3px] bg-[#a8321f]/70" />
              <span className="absolute top-0 -translate-x-1/2 bg-[#a8321f] px-2 py-0.5 font-pixel text-[13px] whitespace-nowrap text-white">
                Hoy
              </span>
            </div>
          )}

          {/* fechas clave */}
          {colocados.map(({ p, x, carril }) => {
            const color = p.hecho ? "#9a9488" : COLOR_TIPO_HITO[p.tipo];
            const atrasado = !p.hecho && p.fecha! < hoy;
            const arriba = carril.lado === "arriba";
            const sep = separacion(carril.lado, carril.n);
            const desplazar = x < 7 ? "translate-x-[-14px]" : x > 93 ? "translate-x-[calc(-100%+14px)]" : "-translate-x-1/2";
            const cuenta = p.hecho ? "hecha" : cuentaAtras(p.fecha!, hoy, p.aproximada).texto.toLowerCase();
            return (
              <a
                key={p.clave}
                href={`#${p.clave}`}
                className="group absolute inset-y-0 z-20 w-0 focus-visible:outline-none"
                style={{ left: `${x}%` }}
                aria-label={`${p.titulo}, ${fechaCorta(p.fecha, hoy)}${p.aproximada ? " aproximadamente" : ""}, ${cuenta}`}
              >
                {/* palito de la etiqueta a la línea */}
                <span
                  aria-hidden="true"
                  className="absolute -left-px w-0.5 bg-madera-oscura/60"
                  style={
                    arriba
                      ? { bottom: "calc(50% + 10px)", height: `calc(${sep} - 10px)` }
                      : { top: "calc(50% + 10px)", height: `calc(${sep} - 10px)` }
                  }
                />
                {/* el punto */}
                <span
                  aria-hidden="true"
                  className={`absolute top-1/2 -left-[11px] h-[22px] w-[22px] -translate-y-1/2 border-[3px] ${
                    atrasado ? "border-[#7d1a10]" : "border-tinta"
                  } shadow-[0_2px_0_rgba(59,36,18,.5)] transition-transform group-hover:scale-125 group-focus-visible:scale-125`}
                  style={{ background: color }}
                />
                {/* etiqueta */}
                <span
                  aria-hidden="true"
                  className={`absolute ${desplazar} border-[3px] px-2 py-1 text-left leading-tight group-hover:bg-sol group-focus-visible:bg-sol ${
                    p.hecho
                      ? "border-[#bdb6a6] bg-[#f3eee2] text-tinta-suave"
                      : atrasado
                        ? "border-[#7d1a10] bg-[#fbe3de] text-[#7d1a10]"
                        : "border-madera-oscura bg-papel text-tinta shadow-[0_3px_0_rgba(59,36,18,.35)]"
                  }`}
                  style={{
                    ...(arriba ? { bottom: `calc(50% + ${sep})` } : { top: `calc(50% + ${sep})` }),
                    width: "max-content",
                    maxWidth: ETIQUETA_PX,
                  }}
                >
                  <span
                    className={`block overflow-hidden text-[13px] font-bold text-ellipsis whitespace-nowrap ${p.hecho ? "line-through" : ""}`}
                  >
                    {p.titulo}
                  </span>
                  <span className="block text-xs font-semibold whitespace-nowrap opacity-80">
                    {p.aproximada ? "≈ " : ""}
                    {fechaCorta(p.fecha, hoy)} · {cuenta}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </DeslizarAHoy>

      {tipos.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-tinta-suave" aria-label="Leyenda">
          {tipos.map((t) => (
            <li key={t} className="flex items-center gap-1">
              <span className="h-3 w-3 border-2 border-tinta" style={{ background: COLOR_TIPO_HITO[t] }} aria-hidden="true" />
              {NOMBRE_TIPO_HITO[t]}
            </li>
          ))}
          <li className="flex items-center gap-1">
            <span className="h-3 w-3 border-2 border-tinta bg-[#9a9488]" aria-hidden="true" />
            Hecha
          </li>
          <li className="flex items-center gap-1">
            <span
              className="h-3 w-6 opacity-60"
              style={{ background: "linear-gradient(90deg, transparent, #5a3a1a, transparent)" }}
              aria-hidden="true"
            />
            Fecha aproximada
          </li>
        </ul>
      )}
    </section>
  );
}
