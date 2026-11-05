import Link from "next/link";
import { Panel } from "@/components/ui";
import { fechaCorta, formatoNumero } from "@/lib/texto";
import { mesCorto, nombreMes } from "@/lib/agenda";
import {
  conciliar,
  inicioCampana,
  porArqueta,
  porMes,
  resumenAgua,
  type Lectura,
  type ResumenAgua,
  type Riego,
} from "@/lib/riegos";

/*
 * Riegos pedidos a la Comunidad de Regantes (talones de riego): lo gastado en la
 * campaña, la comparación con el año pasado, el gasto por meses, por dónde entra
 * el agua (arqueta) y si ha llegado toda la que se pidió (contador de entrada).
 */

const AZUL = "#2f7fb0"; // campaña en curso
const AZUL_CLARO = "#9cc4de"; // campañas anteriores

const m3 = (n: number) => `${formatoNumero(Math.round(n))} m³`;
const eur = (n: number) => `${formatoNumero(Math.round(n))} €`;

/** «+12 %» / «−30 %» */
export function variacion(actual: number, antes: number) {
  if (!antes) return null;
  const p = ((actual - antes) / antes) * 100;
  return `${p >= 0 ? "+" : "−"}${formatoNumero(Math.abs(Math.round(p)))} %`;
}

function Tarjeta({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="panel flex flex-col gap-1 px-4 py-3.5">
      <span className="text-[13px] font-bold text-tinta-suave">{k}</span>
      <span className="titulo-pixel text-[26px] sm:text-[28px]">{v}</span>
      {s && <span className="text-[13px] leading-snug text-tinta-suave">{s}</span>}
    </div>
  );
}

/** Las tarjetas de gasto de agua (también se usan en Cosecha). */
export function TarjetasAgua({ r, hoy }: { r: ResumenAgua; hoy: string }) {
  const c = r.comparacion;
  const var_ = c ? variacion(c.esteAnio.eur, c.anioPasado.eur) : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tarjeta
        k={`Agua de la campaña ${r.campana}`}
        v={eur(r.actual.eur)}
        s={`${m3(r.actual.m3)} en ${r.actual.n} riegos, del ${fechaCorta(r.actual.desde, hoy)} a hoy`}
      />
      <Tarjeta
        k="Comparado con el año pasado"
        v={var_ ?? "—"}
        s={
          c
            ? `${eur(c.esteAnio.eur)} este año frente a ${eur(c.anioPasado.eur)} el año pasado, del ${fechaCorta(c.desde)} al ${fechaCorta(c.hasta)}${c.recortada ? " (no hay datos más antiguos)" : ""}`
            : "Aún no hay datos del año pasado para comparar."
        }
      />
      <Tarjeta
        k={`Año fiscal ${r.fiscal.anio}`}
        v={eur(r.fiscal.eur)}
        s={`${m3(r.fiscal.m3)} de enero a hoy (Hacienda va por años, no por campañas)`}
      />
      <Tarjeta
        k="Precio del agua"
        v={r.precioActual != null ? `${formatoNumero(r.precioActual, 2)} €/m³` : "—"}
        s={
          r.anterior
            ? `Campaña ${r.anterior.campana}: ${eur(r.anterior.eur)} y ${m3(r.anterior.m3)}${r.anterior.completa ? "" : ` (desde el ${fechaCorta(r.anterior.desde)})`}`
            : undefined
        }
      />
    </div>
  );
}

/** Barras de m³ por mes. Color: campaña en curso / anteriores. */
function GraficoMeses({ riegos, hoy }: { riegos: Riego[]; hoy: string }) {
  // desde el primer mes con datos (máximo 24 meses)
  const primero = riegos[0]?.fecha ?? hoy;
  const n =
    (Number(hoy.slice(0, 4)) - Number(primero.slice(0, 4))) * 12 + Number(hoy.slice(5, 7)) - Number(primero.slice(5, 7)) + 1;
  const meses = porMes(riegos, hoy, Math.max(6, Math.min(24, n)));
  const max = Math.max(1, ...meses.map((x) => x.m3));
  const W = 600;
  const H = 170;
  const alto = H - 34;
  const paso = W / meses.length;
  const ancho = Math.min(28, paso - 8);
  const iniActual = inicioCampana(hoy);
  const enCurso = (mes: string) => inicioCampana(`${mes}-01`) === iniActual;
  // línea de referencia (recesiva) a un valor redondo
  const ref = [1000, 2000, 5000, 10000, 20000, 50000].find((v) => v >= max / 2) ?? 50000;

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4 text-[13px] font-bold">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-[3px]" style={{ background: AZUL }} />
          Campaña en curso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-[3px]" style={{ background: AZUL_CLARO }} />
          Antes
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Metros cúbicos de agua pedidos cada mes">
        {ref <= max && (
          <g>
            <line x1={0} x2={W} y1={alto - (ref / max) * (alto - 14)} y2={alto - (ref / max) * (alto - 14)} stroke="#d9c9a0" strokeDasharray="3 4" />
            <text x={W - 2} y={alto - (ref / max) * (alto - 14) - 4} textAnchor="end" fontSize={11} fill="#7a6a4a">
              {formatoNumero(ref)} m³
            </text>
          </g>
        )}
        <line x1={0} x2={W} y1={alto} y2={alto} stroke="#b9a57a" strokeWidth={1.5} />
        {meses.map((x, i) => {
          const h = (x.m3 / max) * (alto - 14);
          const cx = i * paso + paso / 2;
          return (
            <g key={x.mes}>
              {/* zona de toque más grande que la barra */}
              <rect x={i * paso} y={0} width={paso} height={H} fill="transparent">
                <title>{`${nombreMes(`${x.mes}-01`)}: ${m3(x.m3)} · ${eur(x.eur)} · ${x.n} riegos`}</title>
              </rect>
              {h > 0 && (
                <path
                  d={`M${cx - ancho / 2},${alto} V${alto - h + 4} q0,-4 4,-4 H${cx + ancho / 2 - 4} q4,0 4,4 V${alto} Z`}
                  fill={enCurso(x.mes) ? AZUL : AZUL_CLARO}
                  pointerEvents="none"
                />
              )}
              <text x={cx} y={H - 16} textAnchor="middle" fontSize={11} fill="#5e4127">
                {mesCorto(`${x.mes}-01`)}
              </text>
              {(x.mes.endsWith("-01") || i === 0) && (
                <text x={cx} y={H - 3} textAnchor="middle" fontSize={10} fill="#7a6a4a">
                  {x.mes.slice(0, 4)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-tinta-suave">
        Metros cúbicos pedidos cada mes (pasa el dedo o el ratón por una barra para ver el detalle).
      </figcaption>
    </figure>
  );
}

export function RiegosPedidos({
  riegos,
  lecturasEntrada,
  hoy,
  falta,
}: {
  riegos: Riego[];
  /** lecturas del contador de entrada del trasvase, por contador */
  lecturasEntrada: { contador: string; lecturas: Lectura[] }[];
  hoy: string;
  falta: boolean;
}) {
  if (falta) {
    return (
      <Panel titulo="Riegos pedidos a la Comunidad de Regantes">
        <p role="alert" className="ficha-pendiente p-3 text-sm">
          Falta preparar la base de datos: ejecuta <code>supabase/migrations/0013_riegos_regantes.sql</code> en Supabase.
        </p>
      </Panel>
    );
  }
  if (riegos.length === 0) {
    return (
      <Panel titulo="Riegos pedidos a la Comunidad de Regantes">
        <p className="ficha-pendiente p-3 text-sm text-tinta-suave">Aún no hay riegos pedidos apuntados.</p>
      </Panel>
    );
  }

  const r = resumenAgua(riegos, hoy);
  const arquetas = porArqueta(riegos);
  const ultimos = [...riegos].reverse().slice(0, 12);
  const conciliados = lecturasEntrada.map((c) => ({ contador: c.contador, tramos: conciliar(riegos, c.lecturas) }));
  const hayConciliacion = conciliados.some((c) => c.tramos.length > 0);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="riegos-pedidos">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="riegos-pedidos" className="titulo-pixel text-2xl">
          Riegos pedidos · Valladolises
        </h2>
        <span className="text-xs text-tinta-suave">
          Comunidad de Regantes del Campo de Cartagena · datos del {fechaCorta(r.primerDato)} al {fechaCorta(r.ultimoDato)}
        </span>
      </div>

      <TarjetasAgua r={r} hoy={hoy} />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Panel titulo="Agua pedida por meses">
          <GraficoMeses riegos={riegos} hoy={hoy} />
        </Panel>

        <Panel titulo="¿Ha llegado toda el agua?">
          {hayConciliacion ? (
            conciliados.map((c) =>
              c.tramos.length === 0 ? null : (
                <div key={c.contador} className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold">{c.contador}</span>
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-tinta-suave">
                        <th className="py-1 font-semibold">Entre</th>
                        <th className="py-1 text-right font-semibold">Pedido</th>
                        <th className="py-1 text-right font-semibold">Llegó</th>
                        <th className="py-1 text-right font-semibold">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.tramos.slice(0, 8).map((t) => {
                        const falta = t.diferenciaM3 < -0.03 * t.pedidoM3;
                        return (
                          <tr key={t.desde} className="border-t border-dotted border-borde-papel">
                            <td className="py-1">
                              {fechaCorta(t.desde)} – {fechaCorta(t.hasta)}
                            </td>
                            <td className="py-1 text-right">{formatoNumero(Math.round(t.pedidoM3))}</td>
                            <td className="py-1 text-right">{formatoNumero(Math.round(t.medidoM3))}</td>
                            <td className={`py-1 text-right font-bold ${falta ? "text-aviso" : ""}`}>
                              {falta ? "⚠ " : ""}
                              {t.diferenciaM3 >= 0 ? "+" : "−"}
                              {formatoNumero(Math.abs(Math.round(t.diferenciaM3)))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ),
            )
          ) : (
            <div className="flex flex-col gap-2 text-sm leading-snug">
              <p>
                Para saberlo hay que comparar lo pedido con lo que marca el <b>contador de entrada</b>. Basta con apuntar su
                lectura antes de que empiece un riego y otra cuando termine (o una vez por semana).
              </p>
              <p className="text-tinta-suave">
                Con dos lecturas, Campo suma los talones de ese tramo y avisa si ha llegado menos de lo pedido (por ejemplo,
                si un vecino se deja la llave abierta). Aún no hay dos lecturas válidas seguidas del contador de entrada.
              </p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr] lg:items-start">
        <Panel titulo="Por dónde entra (arqueta)">
          <ul className="flex flex-col gap-1.5 text-sm">
            {arquetas.map((a) => (
              <li key={a.arqueta} className="flex flex-col border-b-2 border-dotted border-borde-papel pb-1">
                <span className="flex justify-between gap-2">
                  <b>{a.arqueta}</b>
                  <span>
                    {m3(a.m3)} · {eur(a.eur)}
                  </span>
                </span>
                <span className="text-xs text-tinta-suave">
                  {a.n} riegos, del {fechaCorta(a.desde)} al {fechaCorta(a.hasta)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel titulo="Últimos riegos pedidos">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-tinta-suave">
                <th className="py-1 font-semibold">Fecha</th>
                <th className="py-1 font-semibold">Talón</th>
                <th className="py-1 font-semibold">Arqueta</th>
                <th className="py-1 text-right font-semibold">m³</th>
                <th className="py-1 text-right font-semibold">€</th>
              </tr>
            </thead>
            <tbody>
              {ultimos.map((t) => (
                <tr key={t.id} className="border-t border-dotted border-borde-papel">
                  <td className="py-1">{fechaCorta(t.fecha, hoy)}</td>
                  <td className="py-1">{t.talon}</td>
                  <td className="py-1">{t.arqueta}</td>
                  <td className="py-1 text-right">{formatoNumero(t.volumen_m3)}</td>
                  <td className="py-1 text-right">{formatoNumero(t.coste_eur, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="text-xs text-tinta-suave">
            {riegos.length} riegos apuntados en total. Ver el gasto de la campaña en{" "}
            <Link href="/cosecha?campana=2026-27" className="underline">
              Cosecha
            </Link>
            .
          </span>
        </Panel>
      </div>
    </section>
  );
}

/**
 * Bloque «Gastos de la campaña» para Cosecha. De momento solo el agua de
 * Valladolises (talones de la Comunidad); el resto de gastos llegará con el
 * módulo de contabilidad.
 */
export function GastosCampana({
  riegos,
  hoy,
  inicio,
  kgValladolises,
  falta,
}: {
  riegos: Riego[];
  hoy: string;
  /** año en que empieza la campaña (2026 = 2026/27) */
  inicio: number;
  /** kilos cosechados en Valladolises esa campaña, si se saben (para el €/kg) */
  kgValladolises?: number;
  falta: boolean;
}) {
  const titulo = "Gastos de la campaña";
  if (falta || riegos.length === 0) {
    return (
      <Panel titulo={titulo}>
        <p className="ficha-pendiente p-3 text-sm text-tinta-suave">
          {falta
            ? "Falta ejecutar supabase/migrations/0013_riegos_regantes.sql para ver el gasto de agua."
            : "Aún no hay gastos apuntados."}
        </p>
      </Panel>
    );
  }

  const enCurso = inicio === inicioCampana(hoy);
  const desde = `${inicio}-05-01`;
  const hasta = `${inicio + 1}-04-30`;
  const deEsta = riegos.filter((x) => x.fecha >= desde && x.fecha <= hasta);
  const primer = riegos[0].fecha;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="gastos-campana">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="gastos-campana" className="titulo-pixel text-2xl">
          {titulo}
        </h2>
        <Link href="/agua" className="text-[13px] font-bold text-tinta-suave underline-offset-2 hover:underline">
          Ver los riegos pedidos →
        </Link>
      </div>

      {enCurso ? (
        <TarjetasAgua r={resumenAgua(riegos, hoy)} hoy={hoy} />
      ) : (
        (() => {
          const m = deEsta.reduce((s, x) => s + x.volumen_m3, 0);
          const e = deEsta.reduce((s, x) => s + x.coste_eur, 0);
          const parcial = primer > desde;
          return (
            <div className="grid gap-4 sm:grid-cols-3">
              <Tarjeta
                k="Agua (Valladolises)"
                v={eur(e)}
                s={`${m3(m)} en ${deEsta.length} riegos${parcial ? `, desde el ${fechaCorta(primer)} (faltan los meses de antes)` : ""}`}
              />
              <Tarjeta
                k="Precio medio del agua"
                v={m ? `${formatoNumero(e / m, 3)} €/m³` : "—"}
              />
              <Tarjeta
                k="Agua por kilo cosechado"
                v={kgValladolises && m ? `${formatoNumero(e / kgValladolises, 3)} €/kg` : "—"}
                s={
                  kgValladolises
                    ? `${eur(e)} entre ${formatoNumero(kgValladolises)} kg de Valladolises${parcial ? " (gasto incompleto: saldrá algo más)" : ""}`
                    : "Falta saber los kilos de Valladolises de esta campaña."
                }
              />
            </div>
          );
        })()
      )}

      <p className="text-xs text-tinta-suave">
        Por ahora solo el agua comprada a la Comunidad de Regantes (Valladolises). Los demás gastos (abonos, productos,
        jornales, luz…) se sumarán aquí cuando se empiecen a meter. Campaña de mayo a abril.
      </p>
    </section>
  );
}
