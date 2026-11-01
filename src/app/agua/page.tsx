import { Suspense } from "react";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Chip, ChipFinca, Panel } from "@/components/ui";
import { FormLectura, FormNivel } from "./FormulariosAgua";
import { ListaAvisos } from "@/components/ListaAvisos";
import { obtenerContexto } from "@/lib/sesion";
import {
  cargarAvisos,
  cargarFuentesAgua,
  cargarContadores,
  cargarFincas,
  cargarSuministros,
  ultimaLectura,
  ultimoNivel,
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

async function Agua() {
  const { supabase, puedeEditar } = await obtenerContexto();
  const hoy = hoyISO();
  const [{ fincas, error }, contadores, suministros, fuentes, avisos] = await Promise.all([
    cargarFincas(supabase),
    cargarContadores(supabase),
    cargarSuministros(supabase),
    cargarFuentesAgua(supabase),
    cargarAvisos(supabase, "agua"),
  ]);

  const nombreFinca = new Map(fincas.map((f) => [f.id, f.nombre]));
  const pantanos = fincas.flatMap((f) => f.pantanos.map((p) => ({ ...p, finca: f.nombre })));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo="Agua" subtitulo="Pantanos, contadores y lo que se compra" />

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
