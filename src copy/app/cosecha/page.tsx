import { Suspense } from "react";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Dato, Panel } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarAvisos } from "@/lib/datos";
import { ListaAvisos } from "@/components/ListaAvisos";
import {
  CONTRATO_MANDARINAS_2024,
  CUENTAS_TIO_2526,
  LIQUIDACION_2526,
} from "@/lib/cosecha-documentos";
import { formatoNumero, hoyISO } from "@/lib/texto";

export const instant = false;

export default function CosechaPage() {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Cosecha />
      </Suspense>
    </Marco>
  );
}

const kg = (n: number) => `${formatoNumero(n)} kg`;
const eur = (n: number) => `${formatoNumero(n, 2)} €`;

const COLORES = {
  comercial: "#d4a20a",
  citrica: "#7fb8d8",
  rodrejos: "#6b4a2a",
};

async function Cosecha() {
  // Las cifras de esta pantalla vienen de documentos; los avisos, de la base de datos.
  const { supabase, puedeEditar } = await obtenerContexto();
  const avisos = await cargarAvisos(supabase, "cosecha");
  const hoy = hoyISO();

  const liq = LIQUIDACION_2526;
  const total = liq.filas.reduce((s, f) => s + f.kgTotal, 0);
  const liquidables = liq.filas.reduce((s, f) => s + f.kgLiquidables, 0);
  const importe = liq.filas.reduce((s, f) => s + f.importeEur, 0);
  const maximo = Math.max(...liq.filas.map((f) => f.kgTotal));
  const totalTio = CUENTAS_TIO_2526.filas.reduce((s, f) => s + f.kgTotal, 0);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo="Cosecha" subtitulo={`Campaña ${liq.campana}`}>
        <span className="pestana" aria-current="page">
          {liq.campana}
        </span>
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
    </main>
  );
}
