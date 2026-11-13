import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, ChipFinca, Panel } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarFincas } from "@/lib/datos";
import { cargarCuentas, CATEGORIAS_GASTO, enlacesArchivos, estadoDe, situacion, type Factura, type SituacionTitular } from "@/lib/cuentas";
import { fechaCorta, formatoNumero, hoyISO } from "@/lib/texto";
import { ApuntarFactura, Simulador } from "./FormulariosCuentas";
import { COLOR_ESTADO } from "@/lib/cuentas-calculo";
import { anularFactura, marcarEmitida } from "./actions";

// Cuentas (migración 0014). Primera parte: ventas por titular y año, para que
// nadie pase del límite de 250.000 € de los módulos. Los gastos llegarán después.

export const instant = false;

const eur = (n: number) => `${formatoNumero(Math.round(n))} €`;

export default function CuentasPage({ searchParams }: PageProps<"/cuentas">) {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Cuentas searchParams={searchParams} />
      </Suspense>
    </Marco>
  );
}

/** Barra de ventas del año frente al límite, con el tope de seguridad marcado. */
function BarraLimite({ t }: { t: SituacionTitular }) {
  const escala = Math.max(t.limite_eur, t.facturado + t.previsto) * 1.04;
  const pct = (n: number) => `${Math.min(100, (n / escala) * 100)}%`;
  const c = COLOR_ESTADO[t.estado];
  const cp = COLOR_ESTADO[t.estadoConPrevistas];
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative h-7 border-[3px] border-tinta bg-white"
        role="img"
        aria-label={`${t.nombre}: ${eur(t.facturado)} facturado y ${eur(t.previsto)} previsto, de un límite de ${eur(t.limite_eur)}`}
      >
        <div className="absolute inset-y-0 left-0" style={{ width: pct(t.facturado), background: c.fondo }} />
        {t.previsto > 0 && (
          <div
            className="absolute inset-y-0"
            style={{
              left: pct(t.facturado),
              width: `calc(${pct(t.facturado + t.previsto)} - ${pct(t.facturado)})`,
              background: `repeating-linear-gradient(45deg, ${cp.fondo} 0 6px, #ffffff 6px 10px)`,
            }}
          />
        )}
        {/* tope de seguridad y límite */}
        <div className="absolute inset-y-[-6px] w-[3px] bg-[#d9731f]" style={{ left: pct(t.tope_seguridad_eur) }} />
        <div className="absolute inset-y-[-6px] w-[3px] bg-[#c8473a]" style={{ left: pct(t.limite_eur) }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-tinta-suave">
        <span>
          Tope {eur(t.tope_seguridad_eur)} · límite {eur(t.limite_eur)}
        </span>
        <span>
          {t.margenTope >= 0 ? `Le quedan ${eur(t.margenTope)} hasta el tope` : `Pasa el tope en ${eur(-t.margenTope)}`}
        </span>
      </div>
    </div>
  );
}

/** Enlace a la foto o el PDF de la factura, si lo tiene. */
function Archivo({ f, enlaces }: { f: Factura; enlaces: Map<string, string> }) {
  const url = f.archivo_url ? enlaces.get(f.archivo_url) : null;
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="ml-1.5 font-bold underline" title="Ver la factura">
      📎
    </a>
  );
}

async function Cuentas({ searchParams }: { searchParams: PageProps<"/cuentas">["searchParams"] }) {
  const { supabase, puedeAdministrar: puedeEditar } = await obtenerContexto();
  const sp = await searchParams;
  const hoy = hoyISO();
  const anioHoy = Number(hoy.slice(0, 4));
  const anio = /^\d{4}$/.test(String(sp.anio ?? "")) ? Number(sp.anio) : anioHoy;

  const [{ fincas }, cuentas] = await Promise.all([cargarFincas(supabase), cargarCuentas(supabase, anio)]);
  const nombreFinca = new Map(fincas.map((f) => [f.id, f.nombre]));
  const nombreTitular = new Map(cuentas.titulares.map((t) => [t.id, t.nombre]));
  const sit = situacion(cuentas.titulares, cuentas.facturas, cuentas.socios);
  const ventas = cuentas.facturas.filter((f) => f.tipo === "venta");
  const gastos = cuentas.facturas.filter((f) => f.tipo === "gasto");
  const enlaces = await enlacesArchivos(
    supabase,
    cuentas.facturas.map((f) => f.archivo_url).filter((r): r is string => !!r),
  );
  const totalGastos = gastos.reduce((s, f) => s + f.base_eur, 0);
  const porCategoria = new Map<string, number>();
  for (const g of gastos) {
    const k = CATEGORIAS_GASTO[g.categoria ?? "otros"] ?? "Otros";
    porCategoria.set(k, (porCategoria.get(k) ?? 0) + g.base_eur);
  }

  // por finca de origen (lo que da cada finca, se facture a nombre de quien sea)
  const porFinca = new Map<string, number>();
  for (const f of ventas.filter((v) => v.estado === "emitida")) {
    const k = f.finca_id ? (nombreFinca.get(f.finca_id) ?? "—") : "Sin finca";
    porFinca.set(k, (porFinca.get(k) ?? 0) + f.base_eur);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion
        titulo="Cuentas"
        subtitulo="Ventas y gastos del año. Ventas de cada titular, para no pasar del límite de los módulos"
        volver="/cosecha"
      >
        <nav aria-label="Año" className="flex gap-1.5">
          {[anioHoy - 1, anioHoy, anioHoy + 1].map((a) => (
            <Link key={a} href={`/cuentas?anio=${a}`} aria-current={a === anio ? "page" : undefined} className="pestana">
              {a}
            </Link>
          ))}
        </nav>
      </CabeceraSeccion>

      {cuentas.falta && (
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          Falta preparar la base de datos: ejecuta <code>supabase/migrations/0014_cuentas.sql</code> en Supabase.
          {cuentas.error ? ` (${cuentas.error})` : ""}
        </p>
      )}

      <p className="ficha-pendiente px-3 py-2 text-[13px] leading-snug">
        <b>Límite de los módulos: 250.000 € de ventas al año por titular</b> (año natural, enero a diciembre; cuenta la
        base sin IVA ni compensación). <b>Por confirmar con el asesor:</b> si a cada socio se le suman todas las ventas de
        JHSYO (de Maite, Chelo y Juan Carlos a partes iguales). Por si acaso, la barra las suma; debajo sale también la
        cuenta sin sumarlas. Chelo no sale: no está en módulos ni factura a su nombre, solo es socia de JHSYO. Mis Partos, C.B. (Lobosillo) tampoco: es una comunidad de bienes, no va por módulos y sus ventas no suman al límite de sus comuneros.
        {cuentas.falta0021 && " Falta ejecutar la migración 0021 (socios de JHSYO) para que se sumen."}
        {cuentas.falta0023 && " (Falta la migración 0023; mientras tanto, Chelo se deja fuera por su nombre.)"}
      </p>

      {/* Un bloque por titular */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sit.map((t) => {
          const c = COLOR_ESTADO[t.estado];
          // una persona sin ventas y sin sociedades (no factura) no necesita tarjeta
          if (t.tipo === "persona" && t.facturado === 0 && t.previsto === 0 && t.sociedades.length === 0) return null;
          return (
            <section key={t.id} className="panel flex flex-col gap-2 px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="titulo-pixel text-xl">{t.nombre}</h2>
                  {t.nombre_completo && <p className="text-xs text-tinta-suave">{t.nombre_completo}</p>}
                </div>
                <span className="border-2 px-1.5 py-0.5 text-xs font-bold" style={{ borderColor: c.fondo, color: c.texto }}>
                  {c.etiqueta}
                </span>
              </div>
              <span className="titulo-pixel text-[28px]">{eur(t.facturado)}</span>
              <span className="text-[13px] text-tinta-suave">
                {t.sociedades.length ? "cuenta para su límite en " : "facturado en "}
                {anio} · {formatoNumero((t.facturado / t.limite_eur) * 100, 1)} % del límite
                {t.previsto > 0 ? ` · + ${eur(t.previsto)} previsto` : ""}
              </span>
              {t.sociedades.length > 0 && (
                <span className="text-xs leading-snug text-tinta-suave">
                  A su nombre: {eur(t.facturadoPropio)}
                  {t.sociedades.map((x) => ` · ${x.nombre}: ${eur(x.facturado)} (entero; es socio/a de ${formatoNumero(x.participacion * 100, 0)} %)`)}
                  {`. Si no se suma la sociedad: ${eur(t.facturadoPropio)} (${formatoNumero((t.facturadoPropio / t.limite_eur) * 100, 1)} %, ${COLOR_ESTADO[estadoDe(t, t.facturadoPropio)].etiqueta.toLowerCase()}).`}
                </span>
              )}
              <BarraLimite t={t} />
            </section>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel titulo="¿A nombre de quién facturo este corte?">
          <Simulador titulares={sit} />
        </Panel>

        {puedeEditar && !cuentas.falta && (
          <Panel titulo="Apuntar una factura">
            <ApuntarFactura
              titulares={cuentas.titulares.filter((t) => t.factura).map((t) => ({ id: t.id, nombre: t.nombre }))}
              fincas={fincas.map((f) => ({ id: f.id, nombre: f.nombre }))}
              hoy={hoy}
              conArchivos={!cuentas.falta0015}
              conGastos={!cuentas.falta0015}
            />
          </Panel>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr] lg:items-start">
        <Panel titulo={`Ventas de ${anio} por finca`}>
          {porFinca.size === 0 ? (
            <p className="text-sm text-tinta-suave">Aún no hay ventas apuntadas en {anio}.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {[...porFinca.entries()].map(([f, v]) => (
                <li key={f} className="flex justify-between border-b-2 border-dotted border-borde-papel pb-1">
                  <b>{f}</b>
                  <span>{eur(v)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-tinta-suave">Según la finca de donde sale el limón, se facture a nombre de quien sea.</p>
        </Panel>

        <Panel titulo={`Facturas de venta de ${anio}`} extra={ventas.length || undefined}>
          {ventas.length === 0 ? (
            <p className="text-sm text-tinta-suave">Todavía no hay ninguna.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-tinta-suave">
                    <th className="py-1 font-semibold">Fecha</th>
                    <th className="py-1 font-semibold">A nombre de</th>
                    <th className="py-1 font-semibold">Finca</th>
                    <th className="py-1 font-semibold">Comprador</th>
                    <th className="py-1 text-right font-semibold">Base</th>
                    <th className="py-1" />
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((f) => (
                    <tr key={f.id} className={`border-t border-dotted border-borde-papel ${f.estado === "prevista" ? "italic text-tinta-suave" : ""}`}>
                      <td className="py-1">
                        {fechaCorta(f.fecha, hoy)}
                        {f.estado === "prevista" ? " · prevista" : ""}
                      </td>
                      <td className="py-1 font-bold">{nombreTitular.get(f.titular_id)}</td>
                      <td className="py-1">{f.finca_id ? <ChipFinca nombre={nombreFinca.get(f.finca_id)} /> : "—"}</td>
                      <td className="py-1">
                        {f.contraparte ?? "—"}
                        {f.kg ? <span className="text-tinta-suave"> · {formatoNumero(f.kg)} kg</span> : null}
                      </td>
                      <td className="py-1 text-right">
                        {formatoNumero(f.base_eur, 2)}
                        <Archivo f={f} enlaces={enlaces} />
                      </td>
                      <td className="py-1 text-right">
                        {puedeEditar && (
                          <span className="flex justify-end gap-1">
                            {f.estado === "prevista" && (
                              <form action={marcarEmitida}>
                                <input type="hidden" name="id" value={f.id} />
                                <button type="submit" className="border-2 border-hoja-oscura px-1.5 text-xs font-bold text-hoja-oscura">
                                  Ya facturada
                                </button>
                              </form>
                            )}
                            <form action={anularFactura}>
                              <input type="hidden" name="id" value={f.id} />
                              <button type="submit" className="border-2 border-borde-papel px-1.5 text-xs font-bold text-tinta-suave">
                                Anular
                              </button>
                            </form>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="gastos-anio">
        <h2 id="gastos-anio" className="titulo-pixel text-2xl">
          Gastos de {anio}
        </h2>
        <div className="grid gap-5 lg:grid-cols-[1fr_2fr] lg:items-start">
          <Panel titulo="Por tipo de gasto" extra={gastos.length ? eur(totalGastos) : undefined}>
            {gastos.length === 0 ? (
              <p className="text-sm text-tinta-suave">
                Aún no hay gastos apuntados en {anio}. El agua de la Comunidad de Regantes se ve en Agua y en Cosecha.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {[...porCategoria.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <li key={k} className="flex justify-between border-b-2 border-dotted border-borde-papel pb-1">
                      <b>{k}</b>
                      <span>{eur(v)}</span>
                    </li>
                  ))}
              </ul>
            )}
            <p className="text-xs text-tinta-suave">Sin IVA.</p>
          </Panel>

          <Panel titulo={`Facturas de gasto de ${anio}`} extra={gastos.length || undefined}>
            {gastos.length === 0 ? (
              <p className="text-sm text-tinta-suave">Todavía no hay ninguna.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-tinta-suave">
                      <th className="py-1 font-semibold">Fecha</th>
                      <th className="py-1 font-semibold">Proveedor</th>
                      <th className="py-1 font-semibold">Tipo</th>
                      <th className="py-1 font-semibold">Finca</th>
                      <th className="py-1 font-semibold">Paga</th>
                      <th className="py-1 text-right font-semibold">Base</th>
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map((f) => (
                      <tr key={f.id} className="border-t border-dotted border-borde-papel">
                        <td className="py-1">{fechaCorta(f.fecha, hoy)}</td>
                        <td className="py-1">
                          {f.contraparte ?? "—"}
                          {f.concepto ? <span className="text-tinta-suave"> · {f.concepto}</span> : null}
                        </td>
                        <td className="py-1">{CATEGORIAS_GASTO[f.categoria ?? "otros"] ?? "Otros"}</td>
                        <td className="py-1">{f.finca_id ? <ChipFinca nombre={nombreFinca.get(f.finca_id)} /> : "—"}</td>
                        <td className="py-1 font-bold">{nombreTitular.get(f.titular_id)}</td>
                        <td className="py-1 text-right">
                          {formatoNumero(f.base_eur, 2)}
                          <Archivo f={f} enlaces={enlaces} />
                        </td>
                        <td className="py-1 text-right">
                          {puedeEditar && (
                            <form action={anularFactura}>
                              <input type="hidden" name="id" value={f.id} />
                              <button type="submit" className="border-2 border-borde-papel px-1.5 text-xs font-bold text-tinta-suave">
                                Anular
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </section>
    </main>
  );
}
