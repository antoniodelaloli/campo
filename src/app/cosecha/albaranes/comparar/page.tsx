import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Panel } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarAlbaranes } from "@/lib/albaranes-datos";
import { compararHojas, type DiferenciaAlbaran } from "@/lib/albaranes";
import { formatoNumero } from "@/lib/texto";

// Compara dos hojas del mismo corte albarán a albarán (p. ej. el Excel de Juan
// Carlos frente a la hoja apuntada a mano en Campo).

export const instant = false;

type Busqueda = Promise<Record<string, string | string[] | undefined>>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const kg = (n: number | null | undefined) => (n ? formatoNumero(Math.round(n)) : "—");
const eur = (n: number) => `${formatoNumero(n, 2)} €`;
const fechaCorta = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

export default function CompararPage({ searchParams }: { searchParams: Busqueda }) {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Comparar searchParams={searchParams} />
      </Suspense>
    </Marco>
  );
}

function Lado({ d, lado }: { d: DiferenciaAlbaran; lado: "a" | "b" }) {
  const x = d[lado];
  if (!x) return <span className="text-[#7d1a10] italic">no está</span>;
  const marca = (campo: string) => (d.campos.includes(campo) ? "font-bold text-[#7d1a10]" : "");
  return (
    <span className="tabular-nums">
      <span className={marca("fecha")}>{fechaCorta(x.fecha)}</span> · <span className={marca("cajas")}>{x.cajas ?? "—"} cajas</span> ·{" "}
      <span className={marca("kilos buenos")}>{kg(x.kg_buenos)} kg</span>
      {(x.kg_citrica > 0 || d.campos.includes("kilos de cítrica")) && (
        <>
          {" "}
          · <span className={marca("kilos de cítrica")}>{kg(x.kg_citrica)} cítrica</span>
        </>
      )}
      {x.importe_eur != null && (
        <>
          {" "}
          · <span className={marca("importe")}>{eur(x.importe_eur)}</span>
        </>
      )}
    </span>
  );
}

async function Comparar({ searchParams }: { searchParams: Busqueda }) {
  const sp = await searchParams;
  const campana = uno(sp.campana);
  const a = uno(sp.a);
  const b = uno(sp.b);
  const { supabase } = await obtenerContexto();
  const { albaranes } = await cargarAlbaranes(supabase, /^\d{4}\/\d{2}$/.test(campana) ? campana : undefined);
  const ha = albaranes.filter((x) => x.hoja === a);
  const hb = albaranes.filter((x) => x.hoja === b);
  const c = compararHojas(ha, hb);
  const dif = (p: number, q: number) => {
    const d = p - q;
    return Math.abs(d) < 0.5 ? "igual" : `${d > 0 ? "+" : "−"}${formatoNumero(Math.abs(Math.round(d * 100) / 100), 2)}`;
  };
  const filasTot = [
    { k: "Camiones", a: c.totales.a.camiones, b: c.totales.b.camiones, f: (n: number) => String(n) },
    { k: "Kilos buenos", a: c.totales.a.kgBuenos, b: c.totales.b.kgBuenos, f: kg },
    { k: "Kilos de cítrica", a: c.totales.a.kgCitrica, b: c.totales.b.kgCitrica, f: kg },
    { k: "Importe", a: c.totales.a.importe, b: c.totales.b.importe, f: eur },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo="Comparar hojas" subtitulo={`Campaña ${campana}`} volver="/cosecha/albaranes" />

      {(!ha.length || !hb.length) && (
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          No encuentro {!ha.length ? `la hoja «${a}»` : `la hoja «${b}»`} en la campaña {campana}.
        </p>
      )}

      <Panel titulo="Totales">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-tinta-suave">
                <th className="py-1" />
                <th className="py-1 text-right">A · {a}</th>
                <th className="py-1 text-right">B · {b}</th>
                <th className="py-1 text-right">A − B</th>
              </tr>
            </thead>
            <tbody>
              {filasTot.map((r) => (
                <tr key={r.k} className="border-t border-dotted border-borde-papel">
                  <td className="py-1 font-bold">{r.k}</td>
                  <td className="py-1 text-right">{r.f(r.a)}</td>
                  <td className="py-1 text-right">{r.f(r.b)}</td>
                  <td className="py-1 text-right font-bold" style={dif(r.a, r.b) === "igual" ? { color: "#2f5a1c" } : { color: "#7d1a10" }}>
                    {dif(r.a, r.b)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px]">
          <b>{c.iguales}</b> albaranes iguales en las dos hojas
          {c.diferencias.length ? (
            <>
              {" "}
              y <b className="text-[#7d1a10]">{c.diferencias.length} con diferencias</b>.
            </>
          ) : (
            ". Las dos hojas coinciden. ✅"
          )}
        </p>
      </Panel>

      {c.diferencias.length > 0 && (
        <Panel titulo="Albaranes que no coinciden">
          <ul className="flex flex-col gap-2 text-[13px]">
            {c.diferencias.map((d, i) => (
              <li key={`${d.albaran}-${i}`} className="ficha flex flex-col gap-0.5 px-3 py-2">
                <b>
                  Albarán {d.albaran}
                  {d.tipo === "solo_a" && " · solo en A"}
                  {d.tipo === "solo_b" && " · solo en B"}
                  {d.tipo === "distinto" && ` · cambia: ${d.campos.join(", ")}`}
                </b>
                <span>
                  A: <Lado d={d} lado="a" />
                </span>
                <span>
                  B: <Lado d={d} lado="b" />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-tinta-suave">Lo marcado en rojo es lo que cambia. Para salir de dudas, el papel del albarán.</p>
        </Panel>
      )}

      <p className="text-sm">
        <Link href={`/cosecha/albaranes/apuntar?campana=${encodeURIComponent(campana)}&hoja=${encodeURIComponent(a)}`} className="font-bold underline">
          ← Volver a la hoja A
        </Link>
      </p>
    </main>
  );
}
