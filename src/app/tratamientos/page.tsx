import { Suspense } from "react";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Chip, ChipFinca, Panel } from "@/components/ui";
import { NuevoTratamiento } from "./NuevoTratamiento";
import { PrevisionFumigar } from "./PrevisionFumigar";
import { ListaAvisos } from "@/components/ListaAvisos";
import { cambiarEstadoTratamiento } from "./actions";
import { obtenerContexto } from "@/lib/sesion";
import {
  cargarAvisos,
  cargarFincas,
  cargarPersonas,
  cargarProductos,
  cargarTratamientos,
  type Tratamiento,
} from "@/lib/datos";
import { fechaCorta, formatoNumero, hoyISO, sumarDias } from "@/lib/texto";

export const instant = false;

export default function TratamientosPage() {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Tratamientos />
      </Suspense>
    </Marco>
  );
}

/** Si todos los productos tienen plazo de seguridad validado, desde cuándo se puede cortar. */
function finPlazoSeguridad(t: Tratamiento): { fecha: string | null; motivo: string } {
  const prods = t.tratamiento_productos.map((tp) => tp.productos).filter(Boolean);
  if (prods.length === 0) return { fecha: null, motivo: "Sin productos anotados." };
  const sinPlazo = prods.filter((p) => !p!.validado || p!.plazo_seguridad_dias == null);
  if (sinPlazo.length)
    return {
      fecha: null,
      motivo: `Falta validar el plazo de seguridad de: ${sinPlazo.map((p) => p!.nombre).join(", ")}.`,
    };
  const dias = Math.max(...prods.map((p) => p!.plazo_seguridad_dias ?? 0));
  return { fecha: sumarDias(t.fecha, dias), motivo: `${dias} días de plazo de seguridad.` };
}

function Tarjeta({ t, hoy, puedeEditar }: { t: Tratamiento; hoy: string; puedeEditar: boolean }) {
  const plazo = finPlazoSeguridad(t);
  const enCurso = t.estado === "en_curso";
  return (
    <article className={`${enCurso ? "panel p-4" : "ficha px-3.5 py-3"} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ChipFinca nombre={t.fincas?.nombre} />
          {enCurso ? (
            <Chip tono="verde">En curso</Chip>
          ) : t.estado === "prevista" ? (
            <Chip tono="ambar">Previsto</Chip>
          ) : (
            <Chip>Hecho</Chip>
          )}
        </div>
        <span className="text-sm text-tinta-suave">
          {t.fecha_aproximada ? "hacia el " : ""}
          {fechaCorta(t.fecha, hoy)}
        </span>
      </div>

      <h3 className={`font-bold ${enCurso ? "titulo-pixel text-xl" : "text-[15px]"}`}>
        {t.objetivo ?? <span className="text-tinta-suave italic">Objetivo sin confirmar</span>}
      </h3>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="text-tinta-suave">Quién: </span>
          {t.personas?.nombre ?? "sin indicar"}
        </span>
        {t.litros_cuba != null && (
          <span>
            <span className="text-tinta-suave">Cuba: </span>
            {formatoNumero(Number(t.litros_cuba))} L
          </span>
        )}
        {t.n_cubas != null && (
          <span>
            <span className="text-tinta-suave">Cubas: </span>
            {t.n_cubas}
          </span>
        )}
      </div>

      {t.tratamiento_productos.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {t.tratamiento_productos.map((tp) => (
            <li key={tp.id} className="flex items-center gap-1 bg-[#ece0c0] px-2 py-0.5 text-xs font-bold">
              {tp.productos?.nombre ?? "¿?"}
              {tp.dosis_por_cuba != null && (
                <span className="font-normal">
                  · {formatoNumero(Number(tp.dosis_por_cuba), Number(tp.dosis_por_cuba) % 1 ? 3 : 0)} {tp.unidad ?? ""}
                </span>
              )}
              {tp.productos && !tp.productos.validado && <span className="font-normal text-[#7d1a10]">· sin validar</span>}
            </li>
          ))}
        </ul>
      )}

      {t.notas && <p className="text-[13px] leading-snug text-tinta-suave">{t.notas}</p>}

      {t.estado !== "prevista" && (
        <p
          className={`border-2 px-2.5 py-1.5 text-[13px] ${
            plazo.fecha ? "border-hoja bg-[#eaf5dc]" : "border-aviso bg-[#fbe1dc]"
          }`}
        >
          {plazo.fecha ? (
            <>
              <b>Se puede cortar desde el {fechaCorta(plazo.fecha, hoy)}</b> · {plazo.motivo}
            </>
          ) : (
            <>
              <b>Plazo de seguridad desconocido.</b> {plazo.motivo}
            </>
          )}
        </p>
      )}

      {puedeEditar && t.estado !== "realizada" && (
        <form action={cambiarEstadoTratamiento} className="self-start">
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="estado" value={t.estado === "prevista" ? "en_curso" : "realizada"} />
          <button type="submit" className="boton-madera min-h-[40px] text-sm">
            {t.estado === "prevista" ? "Empezar" : "Marcar como terminado"}
          </button>
        </form>
      )}
    </article>
  );
}

async function Tratamientos() {
  const { supabase, puedeEditar } = await obtenerContexto();
  const hoy = hoyISO();
  const [{ tratamientos, error }, { fincas }, personas, productos, avisos] = await Promise.all([
    cargarTratamientos(supabase),
    cargarFincas(supabase),
    cargarPersonas(supabase),
    cargarProductos(supabase),
    cargarAvisos(supabase, "tratamientos"),
  ]);

  const enCurso = tratamientos.filter((t) => t.estado === "en_curso");
  const previstos = tratamientos.filter((t) => t.estado === "prevista");
  const hechos = tratamientos.filter((t) => t.estado === "realizada");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo="Tratamientos" subtitulo="Lo que se ha aplicado en cada finca" />

      {error && (
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          No se pudieron cargar los tratamientos: {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="flex flex-col gap-5">
          {enCurso.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="titulo-pixel text-xl">En curso</h2>
              {enCurso.map((t) => (
                <Tarjeta key={t.id} t={t} hoy={hoy} puedeEditar={puedeEditar} />
              ))}
            </section>
          )}
          {previstos.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="titulo-pixel text-xl">Previstos</h2>
              {previstos.map((t) => (
                <Tarjeta key={t.id} t={t} hoy={hoy} puedeEditar={puedeEditar} />
              ))}
            </section>
          )}
          <section className="flex flex-col gap-2">
            <h2 className="titulo-pixel text-xl">Historial</h2>
            {hechos.length === 0 ? (
              <p className="ficha-pendiente p-3 text-sm text-tinta-suave">Aún no hay tratamientos terminados.</p>
            ) : (
              hechos.map((t) => <Tarjeta key={t.id} t={t} hoy={hoy} puedeEditar={puedeEditar} />)
            )}
          </section>
          <p className="text-xs text-tinta-suave">
            Esto es un registro de lo aplicado, no una recomendación. El cuaderno oficial (CUE digital,
            obligatorio desde el 1/1/2027) se rellenará exportando estos datos.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <Suspense fallback={<Panel titulo="¿Se puede fumigar?"><p className="text-sm text-tinta-suave">Mirando el viento…</p></Panel>}>
            <PrevisionFumigar hoy={hoy} />
          </Suspense>
          {avisos.length > 0 && (
            <section className="flex flex-col gap-2 border-[3px] border-aviso bg-[#fbe1dc] p-4 shadow-[0_3px_0_#7d1a10]">
              <h2 className="titulo-pixel text-lg text-[#7d1a10]">Antes de cortar</h2>
              <ListaAvisos avisos={avisos} hoy={hoy} puedeEditar={puedeEditar} />
            </section>
          )}
          {puedeEditar && (
            <Panel titulo="Anotar tratamiento">
              <NuevoTratamiento
                fincas={fincas.map((f) => ({ id: f.id, nombre: f.nombre }))}
                personas={personas.map((p) => ({ id: p.id, nombre: p.nombre }))}
                productos={productos.map((p) => ({ id: p.id, nombre: p.nombre, validado: p.validado }))}
                hoy={hoy}
              />
            </Panel>
          )}
          <Panel titulo="Productos" extra={productos.length}>
            <ul className="flex flex-wrap gap-1.5">
              {productos.map((p) => (
                <li key={p.id} className="bg-[#ece0c0] px-2 py-0.5 text-xs font-bold">
                  {p.nombre}
                  {!p.validado && <span className="font-normal text-[#7d1a10]"> · sin validar</span>}
                </li>
              ))}
            </ul>
            <p className="text-xs text-tinta-suave">
              «Sin validar» = nombre copiado de un registro; falta confirmar nº de registro, dosis y plazo de seguridad.
            </p>
          </Panel>
        </div>
      </div>
    </main>
  );
}
