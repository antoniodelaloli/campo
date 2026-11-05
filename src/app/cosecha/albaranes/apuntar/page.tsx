import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Panel } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarFincas } from "@/lib/datos";
import { cargarAlbaranes } from "@/lib/albaranes-datos";
import { nombreCampana } from "@/lib/albaranes";
import { formatoNumero, hoyISO } from "@/lib/texto";
import { FilaNueva } from "./FilaNueva";
import { quitarAlbaran } from "../actions";

// Apuntar albaranes uno a uno (una línea por camión), en paralelo al Excel de
// Juan Carlos, para comparar después las dos hojas.

export const instant = false;

type Busqueda = Promise<Record<string, string | string[] | undefined>>;
const kg = (n: number) => formatoNumero(Math.round(n));
const eur = (n: number) => `${formatoNumero(n, 2)} €`;
const fechaCorta = (iso: string) => `${Number(iso.slice(8, 10))}-${Number(iso.slice(5, 7))}`;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function ApuntarAlbaranesPage({ searchParams }: { searchParams: Busqueda }) {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Apuntar searchParams={searchParams} />
      </Suspense>
    </Marco>
  );
}

async function Apuntar({ searchParams }: { searchParams: Busqueda }) {
  const sp = await searchParams;
  const { supabase, puedeAdministrar } = await obtenerContexto();
  const hoy = hoyISO();
  const iniHoy = Number(hoy.slice(5, 7)) >= 5 ? Number(hoy.slice(0, 4)) : Number(hoy.slice(0, 4)) - 1;
  const campana = /^\d{4}\/\d{2}$/.test(uno(sp.campana)) ? uno(sp.campana) : nombreCampana(iniHoy);
  const hoja = uno(sp.hoja).trim();

  const [{ fincas }, datos, t] = await Promise.all([
    cargarFincas(supabase),
    cargarAlbaranes(supabase, campana),
    supabase.from("titulares").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  const titulares = (t.data ?? []) as { id: string; nombre: string }[];
  const nombreFinca = new Map(fincas.map((f) => [f.id, f.nombre]));
  const nombreTitular = new Map(titulares.map((x) => [x.id, x.nombre]));
  const hojas = [...new Set(datos.albaranes.map((a) => a.hoja).filter((h): h is string => !!h))].sort();

  if (datos.falta) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
        <CabeceraSeccion titulo="Apuntar albaranes" volver="/cosecha/albaranes" />
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          Falta preparar la base de datos: ejecuta <code>supabase/migrations/0020_albaranes.sql</code> en Supabase.
        </p>
      </main>
    );
  }

  // ---------------------------------------------- elegir o empezar una hoja
  if (!hoja) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-5">
        <CabeceraSeccion titulo="Apuntar albaranes" subtitulo="Uno a uno, mientras se pasan los papeles" volver="/cosecha/albaranes" />
        <Panel titulo="Empezar una hoja nueva">
          <p className="text-[13px] leading-snug text-tinta-suave">
            Una hoja es un corte de una finca a nombre de alguien, como cada Excel. Ponle un nombre que la distinga de la del
            Excel (por ejemplo, «Lobosillo 1º corte 2026 (Campo)»), y al terminar compáralas.
          </p>
          <form method="get" className="grid gap-2 sm:grid-cols-6">
            <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-3">
              Nombre de la hoja
              <input name="hoja" required className="campo" placeholder="Lobosillo 1º corte 2026 (Campo)" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Campaña
              <input name="campana" defaultValue={campana} required className="campo" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Corte
              <select name="corte" className="campo" defaultValue="1">
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}º
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              € / kg
              <input name="precio" className="campo" inputMode="decimal" placeholder="0,60" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-3">
              Finca
              <select name="finca" className="campo" defaultValue={fincas.find((f) => f.nombre === "Lobosillo")?.id ?? ""}>
                <option value="">Por confirmar</option>
                {fincas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-3">
              A nombre de
              <select name="titular" className="campo" defaultValue="">
                <option value="">Por confirmar</option>
                {titulares.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="boton self-start sm:col-span-6">
              Empezar a apuntar
            </button>
          </form>
        </Panel>

        {hojas.length > 0 && (
          <Panel titulo={`Seguir con una hoja de ${campana}`}>
            <ul className="flex flex-col gap-1.5 text-sm">
              {hojas.map((h) => (
                <li key={h}>
                  <Link href={`/cosecha/albaranes/apuntar?campana=${encodeURIComponent(campana)}&hoja=${encodeURIComponent(h)}`} className="font-bold underline">
                    {h}
                  </Link>{" "}
                  <span className="text-tinta-suave">({datos.albaranes.filter((a) => a.hoja === h).length} albaranes)</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </main>
    );
  }

  // ---------------------------------------------- hoja abierta
  const filas = datos.albaranes
    .filter((a) => a.hoja === hoja)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.albaran.localeCompare(b.albaran));
  const primera = filas[0];
  const finca = uno(sp.finca) || primera?.finca_id || "";
  const titular = uno(sp.titular) || primera?.titular_id || "";
  const corte = uno(sp.corte) || (primera?.corte ? String(primera.corte) : "");
  const ultima = filas[filas.length - 1];
  const precioUltimo = ultima?.importe_eur && ultima.kg_buenos ? (ultima.importe_eur / ultima.kg_buenos).toFixed(3).replace(".", ",") : "";
  const precio = uno(sp.precio) || precioUltimo;

  const pesadas = filas.filter((a) => a.bruto_kg);
  const tot = {
    neto: pesadas.reduce((s, a) => s + a.kg_buenos, 0),
    buenos: filas.reduce((s, a) => s + a.kg_buenos, 0),
    citrica: filas.reduce((s, a) => s + a.kg_citrica, 0),
    cajas: pesadas.reduce((s, a) => s + (a.cajas ?? 0), 0),
    importe: filas.reduce((s, a) => s + (a.importe_eur ?? 0), 0),
  };
  const otras = hojas.filter((h) => h !== hoja);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion
        titulo={hoja}
        subtitulo={`Campaña ${campana} · ${finca ? (nombreFinca.get(finca) ?? "—") : "finca por confirmar"} · a nombre de ${titular ? (nombreTitular.get(titular) ?? "—") : "por confirmar"}${corte ? ` · ${corte}º corte` : ""}`}
        volver="/cosecha/albaranes/apuntar"
      />

      {puedeAdministrar ? (
        <Panel titulo="Apuntar un albarán">
          <FilaNueva
            campana={campana}
            hoja={hoja}
            finca={finca}
            titular={titular}
            corte={corte}
            fechaInicial={ultima?.fecha ?? hoy}
            precioInicial={precio}
          />
        </Panel>
      ) : (
        <p className="text-sm text-tinta-suave">Tu usuario solo puede consultar.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="panel flex flex-col px-4 py-3">
          <span className="text-[13px] font-bold text-tinta-suave">Camiones</span>
          <span className="titulo-pixel text-[26px]">{filas.length}</span>
        </div>
        <div className="panel flex flex-col px-4 py-3">
          <span className="text-[13px] font-bold text-tinta-suave">Kilos buenos</span>
          <span className="titulo-pixel text-[26px]">{kg(tot.buenos)}</span>
          <span className="text-xs text-tinta-suave">neto de los pesados: {kg(tot.neto)}</span>
        </div>
        <div className="panel flex flex-col px-4 py-3">
          <span className="text-[13px] font-bold text-tinta-suave">Kilos de cítrica</span>
          <span className="titulo-pixel text-[26px]">{kg(tot.citrica)}</span>
        </div>
        <div className="panel flex flex-col px-4 py-3">
          <span className="text-[13px] font-bold text-tinta-suave">Importe</span>
          <span className="titulo-pixel text-[26px]">{eur(tot.importe)}</span>
          <span className="text-xs text-tinta-suave">con el 12 %: {eur(tot.importe * 1.12)}</span>
        </div>
      </div>

      <div className="panel overflow-x-auto p-3.5">
        <table className="w-full min-w-[760px] text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-tinta-suave">
              <th className="py-1">Albarán</th>
              <th className="py-1">Fecha</th>
              <th className="py-1 text-right">Cajas</th>
              <th className="py-1 text-right">Bruto</th>
              <th className="py-1 text-right">Tara</th>
              <th className="py-1 text-right">Tara cajas</th>
              <th className="py-1 text-right">Kilos</th>
              <th className="py-1 text-right">Med</th>
              <th className="py-1 text-right">Cítrica</th>
              <th className="py-1 text-right">Importe</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {filas.map((a) => (
              <tr key={a.id} className="border-t border-dotted border-borde-papel">
                <td className="py-1 font-bold">{a.albaran}</td>
                <td className="py-1">{fechaCorta(a.fecha)}</td>
                <td className="py-1 text-right">{a.cajas ?? ""}</td>
                <td className="py-1 text-right">{a.bruto_kg ? kg(a.bruto_kg) : ""}</td>
                <td className="py-1 text-right">{a.tara_camion_kg ? kg(a.tara_camion_kg) : ""}</td>
                <td className="py-1 text-right">{a.tara_cajas_kg ? formatoNumero(a.tara_cajas_kg, 1) : ""}</td>
                <td className="py-1 text-right font-bold">{a.kg_buenos ? kg(a.kg_buenos) : ""}</td>
                <td className="py-1 text-right">{a.cajas && a.bruto_kg ? formatoNumero(a.kg_buenos / a.cajas, 2) : ""}</td>
                <td className="py-1 text-right">{a.kg_citrica ? kg(a.kg_citrica) : ""}</td>
                <td className="py-1 text-right">{a.importe_eur != null ? eur(a.importe_eur) : ""}</td>
                <td className="py-1 text-right">
                  {puedeAdministrar && (
                    <form action={quitarAlbaran}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="text-xs font-bold text-[#7d1a10] underline" title={a.notas ?? undefined}>
                        quitar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {filas.length > 0 && (
              <tr className="border-t-2 border-tinta font-bold">
                <td className="py-1" colSpan={2}>
                  Total
                </td>
                <td className="py-1 text-right">{tot.cajas || ""}</td>
                <td className="py-1" colSpan={3} />
                <td className="py-1 text-right">{kg(tot.buenos)}</td>
                <td className="py-1 text-right">{tot.cajas ? formatoNumero(tot.neto / tot.cajas, 2) : ""}</td>
                <td className="py-1 text-right">{tot.citrica ? kg(tot.citrica) : ""}</td>
                <td className="py-1 text-right">{eur(tot.importe)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
        {filas.length === 0 && <p className="text-sm text-tinta-suave">Todavía no hay albaranes en esta hoja.</p>}
      </div>

      {otras.length > 0 && filas.length > 0 && (
        <Panel titulo="Comparar con otra hoja">
          <p className="text-[13px] leading-snug text-tinta-suave">
            Cuando Juan Carlos tenga su Excel, pégalo en Albaranes → «Meter una hoja» y compáralo aquí albarán a albarán.
          </p>
          <form method="get" action="/cosecha/albaranes/comparar" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="campana" value={campana} />
            <input type="hidden" name="a" value={hoja} />
            <label className="flex flex-1 flex-col gap-1 text-sm font-bold">
              Hoja con la que comparar
              <select name="b" className="campo">
                {otras.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="boton">
              Comparar
            </button>
          </form>
        </Panel>
      )}
    </main>
  );
}
