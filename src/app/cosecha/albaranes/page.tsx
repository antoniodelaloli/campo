import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Panel } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarFincas } from "@/lib/datos";
import { cargarAlbaranes } from "@/lib/albaranes-datos";
import { agrupar, type GrupoAlbaranes } from "@/lib/albaranes";
import { formatoNumero } from "@/lib/texto";
import { ImportarHoja } from "./ImportarHoja";
import { corregirHoja, quitarHoja } from "./actions";

// Albaranes de báscula (migración 0020): las hojas de Excel de cada corte, una
// fila por camión. Es de donde salen los kilos de cada finca y de cada titular.

export const instant = false;

const kg = (n: number) => formatoNumero(Math.round(n));
const eur = (n: number) => `${formatoNumero(Math.round(n))} €`;
const fecha = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}/${iso.slice(2, 4)}`;

export default function AlbaranesPage() {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Albaranes />
      </Suspense>
    </Marco>
  );
}

type Opcion = { id: string; nombre: string };

function Resumen({ grupos, titulo }: { grupos: GrupoAlbaranes[]; titulo: string }) {
  const suma = (f: (g: GrupoAlbaranes) => number) => grupos.reduce((s, g) => s + f(g), 0);
  const porFinca = new Map<string, { buenos: number; citrica: number }>();
  const porTitular = new Map<string, number>();
  for (const g of grupos) {
    const f = porFinca.get(g.finca) ?? { buenos: 0, citrica: 0 };
    f.buenos += g.kgBuenos;
    f.citrica += g.kgCitrica;
    porFinca.set(g.finca, f);
    porTitular.set(g.titular, (porTitular.get(g.titular) ?? 0) + g.kgBuenos);
  }
  const buenos = suma((g) => g.kgBuenos);
  const citrica = suma((g) => g.kgCitrica);
  return (
    <Panel titulo={titulo} extra={`${suma((g) => g.camiones)} camiones`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col">
          <span className="text-[13px] font-bold text-tinta-suave">Kilos buenos</span>
          <span className="titulo-pixel text-[26px]">{kg(buenos)} kg</span>
          {citrica > 0 && (
            <span className="text-[13px] text-tinta-suave">
              + {kg(citrica)} kg de cítrica ({Math.round((citrica / (buenos + citrica)) * 100)} %)
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5 text-[13px]">
          <span className="font-bold text-tinta-suave">Por finca</span>
          {[...porFinca].map(([f, v]) => (
            <span key={f}>
              <b>{f}</b>: {kg(v.buenos)} kg{v.citrica > 0 ? ` (+${kg(v.citrica)} cítrica)` : ""}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 text-[13px]">
          <span className="font-bold text-tinta-suave">A nombre de</span>
          {[...porTitular].map(([t, v]) => (
            <span key={t}>
              <b>{t}</b>: {kg(v)} kg
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function FilaHoja({
  g,
  fincas,
  titulares,
  puedeEditar,
}: {
  g: GrupoAlbaranes;
  fincas: Opcion[];
  titulares: Opcion[];
  puedeEditar: boolean;
}) {
  const idDe = (lista: Opcion[], nombre: string) => lista.find((o) => o.nombre === nombre)?.id ?? "";
  return (
    <tr className="border-t border-dotted border-borde-papel align-top">
      <td className="py-1.5 pr-2">
        <Link
          href={`/cosecha/albaranes/apuntar?campana=${encodeURIComponent(g.campana)}&hoja=${encodeURIComponent(g.hoja ?? "")}`}
          className="font-bold underline-offset-2 hover:underline"
        >
          {g.hoja ?? "—"}
        </Link>
        <span className="block text-xs text-tinta-suave">
          {fecha(g.desde)}
          {g.hasta !== g.desde && ` – ${fecha(g.hasta)}`} · {g.camiones} camiones
          {g.kgCaja && ` · ${formatoNumero(g.kgCaja, 1)} kg/caja`}
        </span>
        {puedeEditar && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs font-bold text-tinta-suave">Corregir o quitar</summary>
            <form action={corregirHoja} className="mt-1 flex flex-wrap items-end gap-1.5 text-xs">
              <input type="hidden" name="campana" value={g.campana} />
              <input type="hidden" name="hoja" value={g.hoja ?? ""} />
              <select name="finca" defaultValue={idDe(fincas, g.finca)} className="campo py-1 text-xs" aria-label="Finca">
                <option value="">Finca por confirmar</option>
                {fincas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
              <select name="titular" defaultValue={idDe(titulares, g.titular)} className="campo py-1 text-xs" aria-label="A nombre de">
                <option value="">Titular por confirmar</option>
                {titulares.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
              <select name="corte" defaultValue={g.corte ?? ""} className="campo py-1 text-xs" aria-label="Corte">
                <option value="">Corte —</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}º corte
                  </option>
                ))}
              </select>
              <button type="submit" className="boton px-2 py-1 text-xs">
                Guardar
              </button>
            </form>
            <form action={quitarHoja} className="mt-1">
              <input type="hidden" name="campana" value={g.campana} />
              <input type="hidden" name="hoja" value={g.hoja ?? ""} />
              <button type="submit" className="text-xs font-bold text-[#7d1a10] underline">
                Quitar esta hoja (se puede volver a pegar)
              </button>
            </form>
          </details>
        )}
      </td>
      <td className="py-1.5" style={g.finca === "Sin finca" ? { color: "#c8473a", fontWeight: 700 } : undefined}>
        {g.finca === "Sin finca" ? "Por confirmar" : g.finca}
      </td>
      <td className="py-1.5">{g.titular}</td>
      <td className="py-1.5 text-right">{g.corte ? `${g.corte}º` : "—"}</td>
      <td className="py-1.5 text-right font-bold">{kg(g.kgBuenos)}</td>
      <td className="py-1.5 text-right">{g.kgCitrica ? kg(g.kgCitrica) : "—"}</td>
      <td className="py-1.5 text-right">{g.importe ? eur(g.importe) : "—"}</td>
      <td className="py-1.5 text-right">{g.precioKg ? formatoNumero(g.precioKg, 3) : "—"}</td>
    </tr>
  );
}

async function Albaranes() {
  const { supabase, puedeAdministrar } = await obtenerContexto();
  const [{ fincas }, datos, t] = await Promise.all([
    cargarFincas(supabase),
    cargarAlbaranes(supabase),
    supabase.from("titulares").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  const opFincas: Opcion[] = fincas.map((f) => ({ id: f.id, nombre: f.nombre }));
  const opTitulares: Opcion[] = (t.data ?? []).map((x) => ({ id: x.id, nombre: x.nombre }));
  const grupos = agrupar(
    datos.albaranes,
    new Map(opFincas.map((f) => [f.id, f.nombre])),
    new Map(opTitulares.map((x) => [x.id, x.nombre])),
  );
  const campanas = [...new Set(grupos.map((g) => g.campana))].sort().reverse();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo="Albaranes" subtitulo="Las hojas de cada corte: camión a camión, por finca y a nombre de quién" volver="/cosecha" />

      {!datos.falta && puedeAdministrar && (
        <Link href="/cosecha/albaranes/apuntar" className="boton self-start">
          ✍ Apuntar albaranes uno a uno
        </Link>
      )}

      {datos.falta && (
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          Falta preparar la base de datos: ejecuta <code>supabase/migrations/0020_albaranes.sql</code> en Supabase.
        </p>
      )}

      {puedeAdministrar && !datos.falta && (
        <Panel titulo="Meter una hoja">
          <p className="text-[13px] leading-snug text-tinta-suave">
            Abre el Excel del corte, selecciona desde el título hasta la fila de totales, copia y pégalo aquí. Campo lee los albaranes,
            deduce la campaña, la finca, el corte y a nombre de quién va por el título (compruébalo) y te enseña los kilos antes de guardar.
          </p>
          <ImportarHoja fincas={opFincas} titulares={opTitulares} />
        </Panel>
      )}

      {campanas.length === 0 && !datos.falta && <p className="text-sm text-tinta-suave">Todavía no hay hojas metidas.</p>}

      {campanas.map((c) => {
        const gs = grupos.filter((g) => g.campana === c);
        return (
          <section key={c} className="flex flex-col gap-3">
            <Resumen grupos={gs} titulo={`Campaña ${c}`} />
            <div className="panel overflow-x-auto p-3.5">
              <table className="w-full min-w-[720px] text-[13px] tabular-nums">
                <thead>
                  <tr className="text-left text-tinta-suave">
                    <th className="py-1 font-semibold">Hoja</th>
                    <th className="py-1 font-semibold">Finca</th>
                    <th className="py-1 font-semibold">A nombre de</th>
                    <th className="py-1 text-right font-semibold">Corte</th>
                    <th className="py-1 text-right font-semibold">Kg buenos</th>
                    <th className="py-1 text-right font-semibold">Kg cítrica</th>
                    <th className="py-1 text-right font-semibold">Importe</th>
                    <th className="py-1 text-right font-semibold">€/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {gs.map((g) => (
                    <FilaHoja key={`${g.campana}|${g.hoja}|${g.finca}|${g.titular}|${g.corte}`} g={g} fincas={opFincas} titulares={opTitulares} puedeEditar={puedeAdministrar} />
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-tinta-suave">
                El importe es el de la hoja (kilos buenos × precio), sin el 12 % de compensación. Las facturas dicen a nombre de quién
                se vende; los albaranes dicen de qué finca sale el limón.
              </p>
            </div>
          </section>
        );
      })}
    </main>
  );
}
