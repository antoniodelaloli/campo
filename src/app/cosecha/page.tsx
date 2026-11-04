import { Suspense } from "react";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Dato, Panel } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarAvisos, cargarFincas } from "@/lib/datos";
import { KpisCosecha } from "@/components/KpisCosecha";
import { ListaAvisos } from "@/components/ListaAvisos";
import { GastosCampana } from "@/components/RiegosPedidos";
import { cargarRiegos } from "@/lib/riegos";
import Link from "next/link";
import {
  CONTRATO_MANDARINAS_2024,
  CUENTAS_FAMILIA_2425,
  CUENTAS_TIO_2526,
  ESTIMACION_2627,
  LIQUIDACION_2526,
} from "@/lib/cosecha-documentos";
import { formatoNumero, hoyISO } from "@/lib/texto";

export const instant = false;

export default function CosechaPage({ searchParams }: PageProps<"/cosecha">) {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Cosecha searchParams={searchParams} />
      </Suspense>
    </Marco>
  );
}

const CAMPANAS = [
  { id: "2024-25", label: "2024/25", marca: null },
  { id: "2025-26", label: "2025/26", marca: "cuadrando cuentas" },
  { id: "2026-27", label: "2026/27", marca: "en curso" },
] as const;

type IdCampana = (typeof CAMPANAS)[number]["id"];

/** Al entrar sin elegir: hasta fin de año se cuadran las cuentas de 2025/26 (año fiscal); desde 2027, la campaña en curso. */
function campanaPorDefecto(hoy: string): IdCampana {
  return hoy < "2027-01-01" ? "2025-26" : "2026-27";
}

/** Pestañas de campaña, arriba a la derecha */
function Pestanas({ actual }: { actual: IdCampana }) {
  return (
    <nav aria-label="Campaña" className="flex flex-wrap gap-1.5">
      {CAMPANAS.map((c) => {
        const enCurso = c.marca === "en curso";
        return (
          <Link
            key={c.id}
            href={`/cosecha?campana=${c.id}`}
            aria-current={actual === c.id ? "page" : undefined}
            className={`pestana gap-1.5 whitespace-nowrap ${enCurso ? "ring-2 ring-hoja ring-offset-1" : ""}`}
          >
            {enCurso && <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-hoja" />}
            {c.label}
            {c.marca && (
              <span
                className={`px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none ${
                  enCurso ? "bg-hoja text-white" : "bg-[#ece0c0] text-tinta-suave"
                }`}
              >
                {c.marca}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

const kg = (n: number) => `${formatoNumero(n)} kg`;
const eur = (n: number) => `${formatoNumero(n, 2)} €`;

const COLORES = {
  comercial: "#d4a20a",
  citrica: "#7fb8d8",
  rodrejos: "#6b4a2a",
};

const pct = (parte: number, total: number) => `${formatoNumero((parte / total) * 100, 2)} %`;

/** Campaña 2024/25: cuentas de la familia (buenos / destrío, venta y seguro). */
function Campana2425() {
  const c = CUENTAS_FAMILIA_2425;
  const total = c.filas.reduce((s, f) => s + f.kgTotal, 0);
  const destrio = c.filas.reduce((s, f) => s + f.kgDestrio, 0);
  const maximo = Math.max(...c.filas.map((f) => f.kgTotal));
  const corvera = c.filas.find((f) => f.finca === "Corvera")!;
  const ingresoCorvera = (corvera.ventaBuenosEur ?? 0) + (corvera.seguroEur ?? 0);

  return (
    <>
      <p className="ficha-pendiente px-3 py-2 text-[13px]">
        <b>Cifras copiadas de documentos.</b> {c.fuente}. No hay liquidación del comprador de esta campaña.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { k: "Cosecha total", v: kg(total), s: "Corvera y Valladolises" },
          { k: "Destrío (cítrica)", v: kg(destrio), s: `${pct(destrio, total)} de la cosecha` },
          {
            k: "Ingresos de Corvera",
            v: eur(ingresoCorvera),
            s: `Venta + seguro · ${formatoNumero(ingresoCorvera / corvera.kgTotal, 3)} €/kg de media`,
          },
        ].map((x) => (
          <div key={x.k} className="panel flex flex-col gap-1 px-4 py-3.5">
            <span className="text-[13px] font-bold text-tinta-suave">{x.k}</span>
            <span className="titulo-pixel text-[28px] sm:text-[30px]">{x.v}</span>
            <span className="text-[13px] text-tinta-suave">{x.s}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Panel titulo="Por finca">
          <div className="flex flex-wrap gap-4 text-[13px] font-bold">
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 border-2 border-tinta" style={{ background: COLORES.comercial }} />
              Buenos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 border-2 border-tinta" style={{ background: COLORES.citrica }} />
              Destrío (cítrica)
            </span>
          </div>
          {c.filas.map((f) => (
            <div key={f.finca} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap justify-between gap-2 text-[15px]">
                <b>{f.finca}</b>
                <span>{kg(f.kgTotal)}</span>
              </div>
              <div
                className="flex h-8 border-[3px] border-tinta bg-white"
                style={{ width: `${(f.kgTotal / maximo) * 100}%` }}
                role="img"
                aria-label={`${f.finca}: ${kg(f.kgBuenos)} buenos, ${kg(f.kgDestrio)} de destrío`}
              >
                <div style={{ width: `${(f.kgBuenos / f.kgTotal) * 100}%`, background: COLORES.comercial }} className="border-r-2 border-white" />
                <div style={{ width: `${(f.kgDestrio / f.kgTotal) * 100}%`, background: COLORES.citrica }} />
              </div>
              <div className="flex flex-wrap gap-x-4 text-[13px] text-tinta-suave">
                <span>
                  {formatoNumero(f.kgBuenos)} buenos ({pct(f.kgBuenos, f.kgTotal)})
                </span>
                <span>
                  {formatoNumero(f.kgDestrio)} destrío ({pct(f.kgDestrio, f.kgTotal)})
                </span>
              </div>
            </div>
          ))}
          <p className="text-xs text-tinta-suave">Fuente: {c.fuente}.</p>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel titulo="Corvera: venta y seguro">
            <Dato k="Precio de los buenos" v={`${formatoNumero(corvera.precioBuenosEurKg ?? 0, 2)} €/kg + IVA`} />
            <Dato k="Venta de los buenos" v={eur(corvera.ventaBuenosEur ?? 0)} />
            <Dato k="Seguro agrícola cobrado" v={eur(corvera.seguroEur ?? 0)} />
            <Dato k="Total" v={eur(ingresoCorvera)} />
            <Dato k="Media sobre toda la cosecha" v={`${formatoNumero(ingresoCorvera / corvera.kgTotal, 3)} €/kg`} />
          </Panel>
          <Panel titulo="Notas">
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-snug">
              {c.notas.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

async function Cosecha({ searchParams }: { searchParams: PageProps<"/cosecha">["searchParams"] }) {
  // Las cifras de esta pantalla vienen de documentos; los avisos, de la base de datos.
  const { supabase, puedeEditar } = await obtenerContexto();
  const sp = await searchParams;
  const hoy = hoyISO();
  const campana: IdCampana = CAMPANAS.some((c) => c.id === sp.campana)
    ? (sp.campana as IdCampana)
    : campanaPorDefecto(hoy);
  const [avisos, { fincas }, agua] = await Promise.all([
    cargarAvisos(supabase, "cosecha"),
    cargarFincas(supabase),
    cargarRiegos(supabase),
  ]);

  const liq = LIQUIDACION_2526;
  const total = liq.filas.reduce((s, f) => s + f.kgTotal, 0);
  const liquidables = liq.filas.reduce((s, f) => s + f.kgLiquidables, 0);
  const importe = liq.filas.reduce((s, f) => s + f.importeEur, 0);
  const maximo = Math.max(...liq.filas.map((f) => f.kgTotal));
  const totalTio = CUENTAS_TIO_2526.filas.reduce((s, f) => s + f.kgTotal, 0);

  if (campana === "2024-25") {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
        <CabeceraSeccion titulo="Cosecha" subtitulo={`Campaña ${CUENTAS_FAMILIA_2425.campana}`}>
          <Pestanas actual={campana} />
        </CabeceraSeccion>
        <Campana2425 />
      </main>
    );
  }

  if (campana === "2026-27") {
    const est = ESTIMACION_2627;
    const importeEst = est.filas.reduce((s, f) => s + f.importeEur, 0);
    const bajo = 1 - est.margen;
    const alto = 1 + est.margen;
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
        <CabeceraSeccion titulo="Cosecha" subtitulo={`Campaña ${est.campana} · en curso (estimación)`}>
          <Pestanas actual={campana} />
        </CabeceraSeccion>

        <p className="rounded-[3px] border-2 border-alerta bg-[#fdebd0] px-3 py-2 text-[13px]">
          <b>Esto es una estimación, no son datos reales.</b> Sale de la campaña 2025/26 y del contrato 2026/27; se
          irá corrigiendo con los cortes y los albaranes de esta campaña.
        </p>

        {avisos.length > 0 && (
          <Panel titulo="Pendiente" extra={avisos.length}>
            <ListaAvisos avisos={avisos} hoy={hoy} puedeEditar={puedeEditar} />
          </Panel>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              k: "Cosecha esperada",
              v: `≈ ${kg(total)}`,
              s: `Entre ${formatoNumero(Math.round(total * bajo))} y ${formatoNumero(Math.round(total * alto))} kg`,
            },
            {
              k: "Precio neto esperado",
              v: `≈ ${formatoNumero(est.precioEurKg, 3)} €/kg`,
              s: `Referencia ${formatoNumero(est.precioReferencia, 3)} €/kg menos 3 % + 3 %`,
            },
            {
              k: "Importe esperado",
              v: `≈ ${formatoNumero(Math.round(importeEst))} €`,
              s: `Entre ${formatoNumero(Math.round(importeEst * bajo))} y ${formatoNumero(Math.round(importeEst * alto))} €`,
            },
          ].map((c) => (
            <div key={c.k} className="panel flex flex-col gap-1 px-4 py-3.5">
              <span className="text-[13px] font-bold text-tinta-suave">{c.k}</span>
              <span className="titulo-pixel text-[28px] sm:text-[30px]">{c.v}</span>
              <span className="text-[13px] text-tinta-suave">{c.s}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <Panel titulo="Supuestos de la estimación">
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-snug">
              {est.supuestos.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Panel>
          <Panel titulo="Lo que la cambiaría">
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-snug">
              {est.cambiaria.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Panel>
        </div>

        <GastosCampana riegos={agua.riegos} hoy={hoy} inicio={2026} falta={agua.falta} />

        <KpisCosecha fincas={fincas} campana={est.campana} filas={est.filas} estimada />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo="Cosecha" subtitulo={`Campaña ${liq.campana} · cuadrando las cuentas del año`}>
        <Pestanas actual={campana} />
      </CabeceraSeccion>

      <p className="ficha-pendiente px-3 py-2 text-[13px]">
        <b>Cifras copiadas de documentos.</b> Todavía no se registran cortes ni albaranes en la app; esto llegará
        con la próxima ampliación de la base de datos.
      </p>

      {avisos.length > 0 && (
        <Panel titulo="Pendiente" extra={avisos.length}>
          <ListaAvisos avisos={avisos} hoy={hoy} puedeEditar={puedeEditar} />
        </Panel>
      )}

      {/* Cifras grandes */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { k: "Cosecha física", v: kg(total), s: "Según la liquidación" },
          { k: "Kilos liquidables", v: kg(liquidables), s: `A ${formatoNumero(liq.precioEurKg, 3)} €/kg` },
          { k: "Importe estimado", v: eur(importe), s: "Suma de las dos fincas" },
        ].map((c) => (
          <div key={c.k} className="panel flex flex-col gap-1 px-4 py-3.5">
            <span className="text-[13px] font-bold text-tinta-suave">{c.k}</span>
            <span className="titulo-pixel text-[28px] sm:text-[30px]">{c.v}</span>
            <span className="text-[13px] text-tinta-suave">{c.s}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Panel titulo="Por finca y categoría">
          <div className="flex flex-wrap gap-4 text-[13px] font-bold">
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 border-2 border-tinta" style={{ background: COLORES.comercial }} />
              Limón comercial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 border-2 border-tinta" style={{ background: COLORES.citrica }} />
              Cítrica
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 border-2 border-tinta" style={{ background: COLORES.rodrejos }} />
              Rodrejos (no se pagan)
            </span>
          </div>

          {liq.filas.map((f) => {
            const suma = f.kgComercial + f.kgCitrica + f.kgRodrejos;
            const ancho = (f.kgTotal / maximo) * 100;
            return (
              <div key={f.finca} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap justify-between gap-2 text-[15px]">
                  <b>{f.finca}</b>
                  <span>
                    {kg(f.kgTotal)} · {eur(f.importeEur)}
                  </span>
                </div>
                <div
                  className="flex h-8 border-[3px] border-tinta bg-white"
                  style={{ width: `${ancho}%` }}
                  role="img"
                  aria-label={`${f.finca}: ${kg(f.kgComercial)} comercial, ${kg(f.kgCitrica)} cítrica, ${kg(f.kgRodrejos)} rodrejos`}
                >
                  <div style={{ width: `${(f.kgComercial / suma) * 100}%`, background: COLORES.comercial }} className="border-r-2 border-white" />
                  <div style={{ width: `${(f.kgCitrica / suma) * 100}%`, background: COLORES.citrica }} className="border-r-2 border-white" />
                  <div style={{ width: `${(f.kgRodrejos / suma) * 100}%`, background: COLORES.rodrejos }} />
                </div>
                <div className="flex flex-wrap gap-x-4 text-[13px] text-tinta-suave">
                  <span>{formatoNumero(f.kgComercial)} comercial</span>
                  <span>{formatoNumero(f.kgCitrica)} cítrica</span>
                  <span>{formatoNumero(f.kgRodrejos)} rodrejos</span>
                </div>
                {f.nota && <span className="text-xs text-tinta-suave">{f.nota}</span>}
              </div>
            );
          })}
          <p className="text-xs text-tinta-suave">Fuente: {liq.fuente}.</p>
        </Panel>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2 border-[3px] border-alerta bg-[#fdebd0] p-4 shadow-[0_3px_0_#8a5a1a]">
            <h2 className="titulo-pixel text-lg">Pendiente de conciliar</h2>
            <Dato k="Liquidación" v={kg(total)} />
            <Dato k="Cuentas de la familia" v={kg(totalTio)} />
            <Dato k="Diferencia" v={kg(Math.abs(totalTio - total))} />
            <table className="mt-1 w-full text-[13px]">
              <caption className="sr-only">Comparación por finca</caption>
              <thead>
                <tr className="text-left text-tinta-suave">
                  <th className="py-1 font-semibold">Finca</th>
                  <th className="py-1 text-right font-semibold">Liquidación</th>
                  <th className="py-1 text-right font-semibold">Familia</th>
                </tr>
              </thead>
              <tbody>
                {liq.filas.map((f) => {
                  const t = CUENTAS_TIO_2526.filas.find((x) => x.finca === f.finca);
                  return (
                    <tr key={f.finca} className="border-t border-dotted border-alerta">
                      <td className="py-1 font-bold">{f.finca}</td>
                      <td className="py-1 text-right">{formatoNumero(f.kgTotal)}</td>
                      <td className="py-1 text-right">{t ? formatoNumero(t.kgTotal) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[13px] leading-snug">
              Seguramente se cuentan con criterios o fechas distintas. {CUENTAS_TIO_2526.nota}
            </p>
            <p className="text-[13px] leading-snug font-bold">
              {CUENTAS_TIO_2526.sospecha}{" "}
              <Link href="/cosecha?campana=2024-25" className="underline">
                Ver 2024/25
              </Link>
            </p>
          </section>

          <Panel titulo="Mandarinas 2024">
            <Dato k="Finca" v={CONTRATO_MANDARINAS_2024.finca} />
            <Dato k="Precio a limpia" v={`${formatoNumero(CONTRATO_MANDARINAS_2024.precioEurKg, 2)} €/kg`} />
            <Dato k="Descuento fruta dañada" v={`${CONTRATO_MANDARINAS_2024.descuentoDaniada} %`} />
            <Dato k="Corte" v={CONTRATO_MANDARINAS_2024.corte} />
            <span className="text-xs text-tinta-suave">{CONTRATO_MANDARINAS_2024.nota}</span>
          </Panel>
        </div>
      </div>

      <GastosCampana
        riegos={agua.riegos}
        hoy={hoy}
        inicio={2025}
        kgValladolises={liq.filas.find((f) => f.finca === "Valladolises")?.kgTotal}
        falta={agua.falta}
      />

      <KpisCosecha fincas={fincas} campana={liq.campana} filas={liq.filas} />
    </main>
  );
}
