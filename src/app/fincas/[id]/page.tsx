import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marco } from "@/components/Marco";
import { Cargando, Dato, Panel, PorConfirmar } from "@/components/ui";
import { FilaTarea } from "@/components/FilaTarea";
import { BarraPantano } from "@/components/BarraPantano";
import { VistaFinca } from "./VistaFinca";
import { AccionesFinca } from "./AccionesFinca";
import { COLOR_INCIDENCIA, enlaceComoLlegar } from "@/components/PlanoFinca";
import { cerrarIncidencia } from "@/app/avisos/actions";
import { obtenerContexto } from "@/lib/sesion";
import {
  cargarContadores,
  cargarFincas,
  cargarHitos,
  cargarIncidenciasAbiertas,
  cargarPersonas,
  cargarTareasAbiertas,
  cargarZonaSector,
  lugaresDe,
} from "@/lib/datos";
import { fechaCorta, formatoNumero, hoyISO, sumarDias } from "@/lib/texto";

export const instant = false;

const REGIMEN = {
  convencional: "Convencional",
  ecologico: "Ecológica",
  por_confirmar: "Régimen por confirmar",
} as const;

export default function FincaPage({ params, searchParams }: PageProps<"/fincas/[id]">) {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <FincaDetalle params={params} searchParams={searchParams} />
      </Suspense>
    </Marco>
  );
}

async function FincaDetalle({
  params,
  searchParams,
}: {
  params: PageProps<"/fincas/[id]">["params"];
  searchParams: PageProps<"/fincas/[id]">["searchParams"];
}) {
  const { supabase, puedeEditar } = await obtenerContexto();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const vista = sp.vista === "sectores" ? "sectores" : "zonas";
  const hoy = hoyISO();

  const [{ fincas }, { tareas }, incidencias, zonaSector, programadores, contadores, personas, { hitos }] =
    await Promise.all([
      cargarFincas(supabase),
      cargarTareasAbiertas(supabase),
      cargarIncidenciasAbiertas(supabase),
      cargarZonaSector(supabase, id),
      supabase
        .from("programadores")
        .select("id, nombre, marca, modelo, tiene_red, notas")
        .eq("finca_id", id)
        .then(
          (r) =>
            (r.data ?? []) as {
              id: string;
              nombre: string;
              marca: string | null;
              modelo: string | null;
              tiene_red: boolean;
              notas: string | null;
            }[],
        ),
      cargarContadores(supabase),
      cargarPersonas(supabase),
      cargarHitos(supabase, sumarDias(hoy, 365)),
    ]);

  const finca = fincas.find((f) => f.id === id);
  if (!finca) notFound();

  const tareasFinca = tareas.filter((t) => t.finca_id === finca.id);
  const avisos = incidencias.filter((i) => i.finca_id === finca.id);
  const contadoresFinca = contadores.filter((c) => c.finca_id === finca.id);

  const sub = [
    finca.superficie_ha != null
      ? `~${formatoNumero(Number(finca.superficie_ha))} ha (${finca.superficie_fiabilidad})`
      : "Superficie por confirmar",
    finca.n_arboles_aprox ? `~${formatoNumero(finca.n_arboles_aprox)} árboles` : null,
    REGIMEN[finca.regimen],
  ]
    .filter(Boolean)
    .join(" · ");

  const riego = (
    <Panel titulo="Riego">
      {finca.pantanos.map((p) => (
        <BarraPantano key={p.id} pantano={p} finca={p.nombre} hoy={hoy} />
      ))}
      {programadores.map((p) => (
        <div key={p.id} className="flex flex-col gap-1">
          <Dato k="Programador" v={[p.marca, p.modelo].filter(Boolean).join(" ") || <PorConfirmar>por identificar</PorConfirmar>} />
          <Dato k="Conectado a red" v={p.tiene_red ? "Sí" : "No"} />
          {p.notas && <p className="text-xs text-tinta-suave">{p.notas}</p>}
        </div>
      ))}
      {finca.pantanos.length === 0 && programadores.length === 0 && (
        <p className="text-sm text-tinta-suave">Sin pantano ni programador dados de alta.</p>
      )}
    </Panel>
  );

  const lateral = (
    <>
      {avisos.length > 0 && (
        <Panel titulo="Incidencias" extra={avisos.length}>
          <ul className="flex flex-col gap-2.5 text-[13px]">
            {avisos.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-3 w-3 shrink-0 border-2 border-tinta"
                  style={{ background: COLOR_INCIDENCIA[a.tipo] }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span>
                    <b>{a.titulo}</b>
                    {a.descripcion && <span className="text-tinta-suave"> · {a.descripcion}</span>}
                    <span className="text-tinta-suave"> · {fechaCorta(a.fecha, hoy)}</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {a.lat != null && a.lon != null && (
                      <a
                        href={enlaceComoLlegar(a.lat, a.lon)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[32px] border-2 border-tinta bg-[#fff8e2] px-2 py-1 text-xs font-bold hover:bg-[#f6e7c1]"
                      >
                        Cómo llegar
                      </a>
                    )}
                    {puedeEditar && (
                      <form action={cerrarIncidencia}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="estado" value="resuelta" />
                        <button
                          type="submit"
                          className="min-h-[32px] border-2 border-hoja-oscura bg-[#eaf5dc] px-2 text-xs font-bold text-hoja-oscura hover:bg-[#d5ebb8]"
                        >
                          Arreglada
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel titulo="Tareas abiertas" extra={tareasFinca.length}>
        {tareasFinca.length === 0 ? (
          <p className="text-sm text-tinta-suave">Nada pendiente en esta finca.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tareasFinca.slice(0, 6).map((t) => (
              <li key={t.id}>
                <FilaTarea tarea={t} hoy={hoy} puedeEditar={puedeEditar} compacta />
              </li>
            ))}
          </ul>
        )}
        {tareasFinca.length > 6 && (
          <Link href="/tareas" className="text-[13px] font-bold text-tinta-suave underline-offset-2 hover:underline">
            Ver las {tareasFinca.length} tareas →
          </Link>
        )}
      </Panel>

      {finca.notas && (
        <details className="ficha p-3 text-sm">
          <summary className="cursor-pointer font-bold">Notas de la finca</summary>
          <p className="mt-2 leading-relaxed text-tinta-suave">{finca.notas}</p>
        </details>
      )}
    </>
  );

  const acciones = puedeEditar ? (
    <AccionesFinca
      finca={finca.nombre}
      lugares={lugaresDe([finca])}
      personas={personas.map((p) => ({ id: p.id, nombre: p.nombre }))}
      fechasClave={hitos
        .filter((h) => h.finca_id === finca.id || h.finca_id == null)
        .map((h) => ({ id: h.id, titulo: h.titulo, fecha: h.fecha }))}
      pantanos={finca.pantanos.map((p) => ({ id: p.id, etiqueta: p.nombre }))}
      contadores={contadoresFinca.map((c) => ({ id: c.id, etiqueta: c.nombre }))}
      hoy={hoy}
    />
  ) : null;

  return (
    <VistaFinca
      finca={finca}
      subtitulo={sub}
      zonaSector={zonaSector}
      vistaInicial={vista}
      zonaInicial={typeof sp.zona === "string" ? sp.zona : null}
      piscina={avisos.some((a) => a.tipo === "piscina")}
      incidencias={avisos}
      riego={riego}
      acciones={acciones}
      lateral={lateral}
    />
  );
}
