import Link from "next/link";
import { Panel } from "@/components/ui";
import { formatoNumero } from "@/lib/texto";
import type { CostePorKilo as Datos } from "@/lib/coste-por-kilo";

/*
 * «¿Cuánto nos cuesta cada kilo?»: gastos de la campaña entre kilos vendidos.
 * Es el precio mínimo para no perder dinero. Se compara con el precio de venta.
 */

const eur = (n: number) => `${formatoNumero(Math.round(n))} €`;
const cent = (n: number | null) => (n == null ? "—" : `${formatoNumero(n, 3)} €/kg`);

function Tarjeta({ k, v, s, tono }: { k: string; v: string; s?: string; tono?: "bien" | "mal" }) {
  return (
    <div className="panel flex flex-col gap-1 px-4 py-3.5">
      <span className="text-[13px] font-bold text-tinta-suave">{k}</span>
      <span
        className="titulo-pixel text-[26px] sm:text-[28px]"
        style={tono === "mal" ? { color: "#c8473a" } : tono === "bien" ? { color: "#2f5a1c" } : undefined}
      >
        {v}
      </span>
      {s && <span className="text-[13px] leading-snug text-tinta-suave">{s}</span>}
    </div>
  );
}

export function CostePorKilo({ d, estimada = false }: { d: Datos; estimada?: boolean }) {
  const t = d.total;
  const margenPct = t.margenKg != null && t.precioKg ? (t.margenKg / t.precioKg) * 100 : null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="coste-kilo">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="coste-kilo" className="titulo-pixel text-2xl">
          ¿Cuánto nos cuesta cada kilo?
        </h2>
        <Link href="/cuentas" className="text-[13px] font-bold text-tinta-suave underline-offset-2 hover:underline">
          Apuntar gastos en Cuentas →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          k="Coste por kilo = precio mínimo"
          v={cent(t.costeKg)}
          s={`${eur(t.gastos)} de gastos entre ${formatoNumero(Math.round(t.kilos))} kg${t.kilosReales ? " vendidos" : estimada ? " previstos" : " de la liquidación"}`}
        />
        <Tarjeta
          k={estimada ? "Precio de venta previsto" : "Precio medio de venta"}
          v={cent(t.precioKg)}
          s={estimada ? "Con la estimación de la campaña" : undefined}
        />
        <Tarjeta
          k="Margen por kilo"
          v={t.margenKg == null ? "—" : `${t.margenKg >= 0 ? "+" : "−"}${formatoNumero(Math.abs(t.margenKg), 3)} €/kg`}
          s={margenPct != null ? `${formatoNumero(Math.round(margenPct))} % del precio de venta` : undefined}
          // con gastos sin apuntar, el margen sale inflado: sin color de «bien»
          tono={t.margenKg == null ? undefined : t.margenKg < 0 ? "mal" : d.faltan.length ? undefined : "bien"}
        />
        <Tarjeta
          k="Gastos apuntados"
          v={eur(t.gastos)}
          s={d.porCategoria.length ? d.porCategoria.map((c) => `${c.categoria} ${eur(c.eur)}`).join(" · ") : "Aún no hay gastos apuntados."}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Panel titulo="Por finca">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-tinta-suave">
                  <th className="py-1 font-semibold">Finca</th>
                  <th className="py-1 text-right font-semibold">Gastos</th>
                  <th className="py-1 text-right font-semibold">Kilos</th>
                  <th className="py-1 text-right font-semibold">Coste/kg</th>
                  <th className="py-1 text-right font-semibold">Precio/kg</th>
                  <th className="py-1 text-right font-semibold">Margen/kg</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {d.fincas.map((f) => (
                  <tr key={f.finca} className="border-t border-dotted border-borde-papel">
                    <td className="py-1 font-bold">{f.finca}</td>
                    <td className="py-1 text-right">{eur(f.gastos)}</td>
                    <td className="py-1 text-right">
                      {formatoNumero(Math.round(f.kilos))}
                      {!f.kilosReales && <span className="text-tinta-suave">*</span>}
                    </td>
                    <td className="py-1 text-right">{f.costeKg == null ? "—" : formatoNumero(f.costeKg, 3)}</td>
                    <td className="py-1 text-right">{f.precioKg == null ? "—" : formatoNumero(f.precioKg, 3)}</td>
                    <td
                      className="py-1 text-right font-bold"
                      style={f.margenKg != null && f.margenKg < 0 ? { color: "#c8473a" } : undefined}
                    >
                      {f.margenKg == null ? "—" : `${f.margenKg >= 0 ? "+" : "−"}${formatoNumero(Math.abs(f.margenKg), 3)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-tinta-suave">
            * Kilos {estimada ? "previstos" : "de la liquidación"}: cuando las facturas de venta lleguen a esos kilos, se usan las facturas.
            {d.gastosMitad > 0 && ` Los tratamientos sin finca (${eur(d.gastosMitad)}) van al 50 % entre Valladolises y Corvera.`}
            {d.gastosPorKilos > 0 && ` El resto de gastos sin finca (${eur(d.gastosPorKilos)}) se reparte según los kilos de cada finca.`}
          </p>
        </Panel>

        <section className="flex flex-col gap-2 border-[3px] border-alerta bg-[#fdebd0] p-4 shadow-[0_3px_0_#8a5a1a]">
          <h3 className="titulo-pixel text-lg">Ojo: aún faltan gastos</h3>
          <p className="text-[13px] leading-snug">
            El coste por kilo solo es fiable cuando estén todos los gastos de la campaña (mayo a abril). Ahora mismo cuenta lo que hay
            apuntado{d.porCategoria.length ? "" : ", que es nada"}, así que el precio mínimo real será <b>más alto</b>.
          </p>
          {d.faltan.length > 0 && (
            <p className="text-[13px] leading-snug">
              <b>Sin nada apuntado:</b> {d.faltan.join(", ")}.
            </p>
          )}
          <p className="text-[13px] leading-snug">
            Corvera paga su agua al Pozo Villalba y la luz del bombeo: hay que meter todas esas facturas de la campaña en Cuentas, no
            solo alguna.
          </p>
        </section>
      </div>
    </section>
  );
}
