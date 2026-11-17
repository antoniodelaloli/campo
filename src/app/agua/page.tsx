import { Suspense, type ReactNode } from "react";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Chip, ChipFinca, Panel } from "@/components/ui";
import { FormLectura, FormNivel } from "./FormulariosAgua";
import { ListaAvisos } from "@/components/ListaAvisos";
import { RiegosPedidos } from "@/components/RiegosPedidos";
import { cargarRiegos } from "@/lib/riegos";
import { obtenerContexto } from "@/lib/sesion";
import {
  cargarAvisos,
  cargarFuentesAgua,
  cargarContadores,
  cargarFincas,
  cargarSuministros,
  ultimaLectura,
  ultimoNivel,
  type Contador,
  type Pantano,
} from "@/lib/datos";
import { fechaCorta, formatoNumero, hoyISO } from "@/lib/texto";

export const instant = false;

export default function AguaPage() {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Agua />
      </Suspense>
    </Marco>
  );
}

const ORIGEN: Record<string, string> = {
  trasvase: "Trasvase",
  pozo: "Pozo",
  desaladora: "Desaladora",
  pantano: "Pantano",
  otro: "Otro",
};

function DibujoPantano({ pantano }: { pantano: Pantano }) {
  const nivel = ultimoNivel(pantano);
  const tope = Number(pantano.capacidad_util_m3 ?? pantano.capacidad_m3 ?? 0);
  const pct =
    nivel?.nivel_m3 != null && tope > 0
      ? Math.max(0, Math.min(1, Number(nivel.nivel_m3) / tope))
      : null;
  const altoAgua = pct != null ? Math.round(84 * pct) : 0;
  return (
    <svg width="132" height="104" viewBox="0 0 120 96" className="pixel" role="img"
      aria-label={pct != null ? `Lleno al ${Math.round(pct * 100)} %` : "Nivel sin anotar"}>
      <rect x="0" y="0" width="120" height="96" rx="10" fill="#8b6b3d" />
      <rect x="6" y="6" width="108" height="84" rx="7" fill="#e8f3f9" />
      {pct != null ? (
        <>
          <rect x="6" y={90 - altoAgua} width="108" height={altoAgua} fill="#4aa3d9" />
          <rect x="14" y={94 - altoAgua} width="26" height="4" fill="#8fd0f2" />
          <text x="60" y="56" textAnchor="middle" fontFamily="var(--font-pixel)" fontSize="22" fontWeight="700" fill="#ffffff" stroke="#1d4a80" strokeWidth="4" paintOrder="stroke">
            {Math.round(pct * 100)}%
          </text>
        </>
      ) : (
        <>
          <rect x="6" y="6" width="108" height="84" rx="7" fill="none" stroke="#2f7fb0" strokeWidth="2" strokeDasharray="6 5" />
          <text x="60" y="56" textAnchor="middle" fontFamily="var(--font-pixel)" fontSize="24" fontWeight="700" fill="#1d4a80">
            ?
          </text>
        </>
      )}
    </svg>
  );
}

const METODO: Record<string, string> = { a_ojo: "a ojo", sensor: "sensor", calculado: "calculado" };

/** Desplegable bajo un formulario: «Ver últimos niveles (12)». Sin JavaScript. */
function Desplegable({ titulo, n, children }: { titulo: string; n: number; children: ReactNode }) {
  return (
    <details className="group border-t-2 border-dotted border-borde-papel pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-bold text-tinta-suave hover:text-tinta [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">
          ▸
        </span>
        {titulo} ({n})
      </summary>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </details>
  );
}

/** Últimos niveles de todos los pantanos, con el cambio desde el anterior del mismo pantano. */
function UltimosNiveles({ pantanos, hoy }: { pantanos: (Pantano & { finca: string })[]; hoy: string }) {
  const filas = pantanos.flatMap((p) => {
    const tope = Number(p.capacidad_util_m3 ?? p.capacidad_m3 ?? 0);
    const ns = p.niveles_pantano.filter((n) => !n.anulado).sort((a, b) => a.fecha.localeCompare(b.fecha));
    return ns.map((n, i) => {
      const antes = ns[i - 1]?.nivel_m3;
      return {
        ...n,
        finca: p.finca,
        pct: n.nivel_m3 != null && tope ? Math.round((Number(n.nivel_m3) / tope) * 100) : null,
        cambio: n.nivel_m3 != null && antes != null ? Number(n.nivel_m3) - Number(antes) : null,
      };
    });
  });
  filas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (filas.length === 0) return <p className="text-[13px] text-tinta-suave">Aún no hay niveles apuntados.</p>;
  return (
    <Desplegable titulo="Ver últimos niveles" n={Math.min(filas.length, 15)}>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-tinta-suave">
            <th className="py-1 font-semibold">Fecha</th>
            <th className="py-1 font-semibold">Pantano</th>
            <th className="py-1 text-right font-semibold">m³</th>
            <th className="py-1 text-right font-semibold">Cambio</th>
          </tr>
        </thead>
        <tbody>
          {filas.slice(0, 15).map((f) => (
            <tr key={f.id} className="border-t border-dotted border-borde-papel">
              <td className="py-1 whitespace-nowrap">{fechaCorta(f.fecha, hoy)}</td>
              <td className="py-1">
                {f.finca}
                <span className="text-tinta-suave"> · {METODO[f.metodo] ?? f.metodo}</span>
              </td>
              <td className="py-1 text-right whitespace-nowrap">
                {f.nivel_m3 != null ? formatoNumero(Number(f.nivel_m3)) : "—"}
                {f.pct != null && <span className="text-tinta-suave"> ({f.pct} %)</span>}
              </td>
              <td className="py-1 text-right whitespace-nowrap">
                {f.cambio == null ? "" : `${f.cambio >= 0 ? "+" : "−"}${formatoNumero(Math.abs(f.cambio))}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Desplegable>
  );
}

/** Últimas lecturas de todos los contadores, con lo gastado desde la anterior del mismo contador. */
function UltimasLecturas({
  contadores,
  nombreFinca,
  hoy,
}: {
  contadores: Contador[];
  nombreFinca: Map<string, string>;
  hoy: string;
}) {
  const filas = contadores.flatMap((c) => {
    const ls = c.lecturas_contador.filter((l) => !l.anulada).sort((a, b) => a.fecha.localeCompare(b.fecha));
    return ls.map((l, i) => {
      const antes = ls[i - 1];
      const m3 = antes ? Number(l.lectura_m3) - Number(antes.lectura_m3) : null;
      return { ...l, contador: c.nombre, finca: nombreFinca.get(c.finca_id) ?? "", m3: m3 != null && m3 >= 0 ? m3 : null };
    });
  });
  filas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (filas.length === 0) return <p className="text-[13px] text-tinta-suave">Aún no hay lecturas apuntadas.</p>;
  return (
    <Desplegable titulo="Ver últimas lecturas" n={Math.min(filas.length, 15)}>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-tinta-suave">
            <th className="py-1 font-semibold">Fecha</th>
            <th className="py-1 font-semibold">Contador</th>
            <th className="py-1 text-right font-semibold">Lectura</th>
            <th className="py-1 text-right font-semibold">Gastado</th>
          </tr>
        </thead>
        <tbody>
          {filas.slice(0, 15).map((f) => (
            <tr key={f.id} className="border-t border-dotted border-borde-papel">
              <td className="py-1 whitespace-nowrap">{fechaCorta(f.fecha, hoy)}</td>
              <td className="py-1">
                {f.contador}
                <span className="text-tinta-suave"> · {f.finca}</span>
                {f.pendiente_conciliar && (
                  <>
                    {" "}
                    <Chip tono="ambar">por confirmar</Chip>
                  </>
                )}
              </td>
              <td className="py-1 text-right whitespace-nowrap">{formatoNumero(Number(f.lectura_m3))}</td>
              <td className="py-1 text-right whitespace-nowrap">{f.m3 != null ? `${formatoNumero(f.m3)} m³` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-tinta-suave">«Gastado» es la diferencia con la lectura anterior del mismo contador.</p>
    </Desplegable>
  );
}

async function Agua() {
  const { supabase, puedeEditar } = await obtenerContexto();
  const hoy = hoyISO();
  const [{ fincas, error }, contadores, suministros, fuentes, avisos, riegos] = await Promise.all([
    cargarFincas(supabase),
    cargarContadores(supabase),
    cargarSuministros(supabase),
    cargarFuentesAgua(supabase),
    cargarAvisos(supabase, "agua"),
    cargarRiegos(supabase),
  ]);
  // lecturas válidas de los contadores de entrada del trasvase, para ver si llega el agua pedida
  const lecturasEntrada = contadores
    .filter((c) => c.tipo === "entrada" && c.origen_agua === "trasvase")
    .map((c) => ({
      contador: c.nombre,
      lecturas: c.lecturas_contador
        .filter((l) => !l.anulada && !l.pendiente_conciliar)
        .map((l) => ({ fecha: l.fecha, lectura_m3: Number(l.lectura_m3) })),
    }));

  const nombreFinca = new Map(fincas.map((f) => [f.id, f.nombre]));
  const pantanos = fincas.flatMap((f) => f.pantanos.map((p) => ({ ...p, finca: f.nombre })));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo="Agua y lecturas" subtitulo="Pantanos, contadores, lo que se compra y, pronto, todo lo que se lee o se mide en las fincas" />

      {error && (
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          No se pudieron cargar los datos: {error}
        </p>
      )}

      {/* Pantanos */}
      <div className="grid gap-4 sm:grid-cols-2">
        {pantanos.map((p) => {
          const nivel = ultimoNivel(p);
          return (
            <section key={p.id} className="panel flex items-center gap-4 p-4">
              <DibujoPantano pantano={p} />
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="titulo-pixel text-xl">{p.finca}</h2>
                <span className="text-sm">
                  {p.capacidad_m3 != null ? `~${formatoNumero(Number(p.capacidad_m3))} m³` : "Capacidad por confirmar"}
                </span>
                <span className="text-sm font-bold">
                  {p.capacidad_util_m3 != null
                    ? `~${formatoNumero(Number(p.capacidad_util_m3))} útiles`
                    : "útiles por confirmar"}
                </span>
                <span className="text-xs text-tinta-suave">
                  {nivel
                    ? `Última: ${nivel.nivel_m3 != null ? `${formatoNumero(Number(nivel.nivel_m3))} m³` : "sin cifra"} · ${fechaCorta(nivel.fecha, hoy)}`
                    : "Aún sin lectura: se valora a ojo."}
                </span>
                <span className="text-xs text-tinta-suave">Dato {p.fiabilidad}</span>
              </div>
            </section>
          );
        })}
      </div>

      <RiegosPedidos riegos={riegos.riegos} pagos={riegos.pagos} lecturasEntrada={lecturasEntrada} hoy={hoy} falta={riegos.falta} />

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* De dónde viene el agua */}
        <Panel titulo="De dónde viene">
          {fuentes.length === 0 ? (
            <p className="ficha-pendiente p-3 text-sm text-tinta-suave">
              Sin fuentes de agua registradas (aplica la migración 0002 y datos_0002.sql).
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {fuentes.map((f) => (
                <li key={f.id} className="ficha flex flex-col gap-1 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold">
                      {ORIGEN[f.origen_agua] ?? f.origen_agua}
                      {f.proveedor ? ` · ${f.proveedor}` : ""}
                    </span>
                    <ChipFinca nombre={nombreFinca.get(f.finca_id)} />
                  </div>
                  {f.precio_ref_eur_m3 != null && (
                    <span className="text-sm">
                      <b>~{formatoNumero(Number(f.precio_ref_eur_m3), 2)} €/m³</b>
                      <span className="text-tinta-suave">
                        {" "}
                        · referencia {f.anio_ref ?? ""} ({f.fiabilidad})
                      </span>
                    </span>
                  )}
                  {f.notas && <span className="text-xs leading-snug text-tinta-suave">{f.notas}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Expedientes y pendientes del agua */}
        <Panel titulo="Pendiente" extra={avisos.length || undefined}>
          <ListaAvisos avisos={avisos} hoy={hoy} puedeEditar={puedeEditar} />
        </Panel>

        {/* Contadores */}
        <Panel titulo="Contadores" extra={contadores.length}>
          {contadores.length === 0 && <p className="text-sm text-tinta-suave">Sin contadores dados de alta.</p>}
          <ul className="flex flex-col gap-2">
            {contadores.map((c) => {
              const l = ultimaLectura(c);
              return (
                <li key={c.id} className="ficha flex flex-col gap-1 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold">{c.nombre}</span>
                    <ChipFinca nombre={nombreFinca.get(c.finca_id)} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-tinta-suave">
                    <span>{c.tipo === "entrada" ? "Entrada" : "Salida"}</span>
                    {c.origen_agua && <span>{ORIGEN[c.origen_agua] ?? c.origen_agua}</span>}
                    {c.sectores_riego && <span>Sector {c.sectores_riego.numero}</span>}
                    {c.es_contraste && <span>Contraste</span>}
                  </div>
                  <span className="text-sm">
                    {l ? (
                      <>
                        <b>{formatoNumero(Number(l.lectura_m3))} m³</b>
                        <span className="text-tinta-suave"> · {fechaCorta(l.fecha, hoy)} </span>
                        {l.pendiente_conciliar && <Chip tono="ambar">por confirmar</Chip>}
                        {l.notas && <span className="mt-0.5 block text-xs leading-snug text-tinta-suave">{l.notas}</span>}
                      </>
                    ) : (
                      <span className="text-tinta-suave italic">Sin lecturas todavía</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="flex flex-col gap-5">
          {puedeEditar && pantanos.length > 0 && (
            <Panel titulo="Anotar nivel">
              <FormNivel
                pantanos={pantanos.map((p) => ({ id: p.id, etiqueta: `${p.nombre}` }))}
                hoy={hoy}
              />
              <UltimosNiveles pantanos={pantanos} hoy={hoy} />
            </Panel>
          )}
          {puedeEditar && contadores.length > 0 && (
            <Panel titulo="Anotar lectura">
              <FormLectura
                contadores={contadores.map((c) => ({
                  id: c.id,
                  etiqueta: `${c.nombre} · ${nombreFinca.get(c.finca_id) ?? ""}`,
                }))}
                hoy={hoy}
              />
              <UltimasLecturas contadores={contadores} nombreFinca={nombreFinca} hoy={hoy} />
            </Panel>
          )}

          <Panel titulo="Agua comprada">
            {suministros.length === 0 ? (
              <p className="ficha-pendiente p-3 text-sm text-tinta-suave">
                Aún no hay suministros ni facturas de agua registrados.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {suministros.map((s) => (
                  <li key={s.id} className="flex flex-wrap justify-between gap-2 border-b-2 border-dotted border-borde-papel pb-1 text-sm">
                    <span>
                      <b>{fechaCorta(s.fecha, hoy)}</b> · {nombreFinca.get(s.finca_id)}
                      {s.origen_agua && ` · ${ORIGEN[s.origen_agua] ?? s.origen_agua}`}
                    </span>
                    <span>
                      {s.volumen_m3 != null && `${formatoNumero(Number(s.volumen_m3))} m³`}
                      {s.coste_eur != null && ` · ${formatoNumero(Number(s.coste_eur), 2)} €`}
                      {s.volumen_m3 && s.coste_eur
                        ? ` · ${formatoNumero(Number(s.coste_eur) / Number(s.volumen_m3), 2)} €/m³`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}
