import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/Marco";
import { MapaFincas } from "@/components/MapaFincas";
import { Panel, Cargando } from "@/components/ui";
import { FilaTarea } from "@/components/FilaTarea";
import { BarraPantano } from "@/components/BarraPantano";
import { ListaAvisos } from "@/components/ListaAvisos";
import { LoQueViene } from "@/components/LoQueViene";
import { obtenerContexto } from "@/lib/sesion";
import {
  cargarAvisos,
  cargarFincas,
  cargarHitos,
  cargarIncidenciasAbiertas,
  cargarTareasDeHitos,
  cargarTareasAbiertas,
  cargarTratamientos,
} from "@/lib/datos";
import { construirAgenda } from "@/lib/agenda";
import { hoyISO, momentoDelDia, sumarDias } from "@/lib/texto";

// Página privada: se genera en cada petición (depende de la sesión).
export const instant = false;

export default function InicioPage() {
  return (
    <Marco>
      <Suspense fallback={<Cargando texto="Preparando el mapa…" />}>
        <Inicio />
      </Suspense>
    </Marco>
  );
}

async function Inicio() {
  const { supabase, puedeEditar } = await obtenerContexto();
  const hoy = hoyISO();
  const momento = momentoDelDia();

  const hasta = sumarDias(hoy, 14);

  const [{ fincas, error }, { tareas }, incidencias, avisos, { tratamientos }, { hitos, falta }, tareasDeHitos] =
    await Promise.all([
      cargarFincas(supabase),
      cargarTareasAbiertas(supabase),
      cargarIncidenciasAbiertas(supabase),
      cargarAvisos(supabase),
      cargarTratamientos(supabase),
      cargarHitos(supabase, hasta),
      cargarTareasDeHitos(supabase),
    ]);

  // Fechas clave de las próximas dos semanas (las tareas van en su propio panel)
  const agenda = construirAgenda({ hitos, tratamientos, tareasDeHitos, hoy, hasta });
  const cuentaAgenda = agenda.atrasados.length + agenda.proximos.length;

  const enCurso = tratamientos.filter((t) => t.estado === "en_curso");
  // En el mapa sale quien está trabajando: tareas en curso o de hoy con alguien asignado
  const tareasActivas = tareas.filter(
    (t) => t.estado === "en_curso" || (t.fecha_prevista === hoy && t.tareas_personas.length > 0),
  );
  const tareasHoy = tareas.filter((t) => !t.fecha_prevista || t.fecha_prevista <= hoy);
  const visibles = (tareasHoy.length ? tareasHoy : tareas)
    .slice()
    .sort((a, b) => Number(b.estado === "en_curso") - Number(a.estado === "en_curso"))
    .slice(0, 5);
  const pantanos = fincas.flatMap((f) => f.pantanos.map((p) => ({ ...p, finca: f.nombre })));
  const totalAvisos = avisos.length + incidencias.length;

  const props = { fincas, incidencias, tratamientosEnCurso: enCurso, tareasEnCurso: tareasActivas, momento };

  return (
    <div className="relative flex flex-1 flex-col lg:block lg:h-[calc(100dvh-56px)] lg:flex-none lg:overflow-hidden">
      {/* Mapa a escala real: se mueve y hace zoom; los paneles quedan fijos encima */}
      <div className="relative isolate h-[62vh] min-h-[380px] border-b-4 border-marco lg:absolute lg:inset-0 lg:h-auto lg:min-h-0 lg:border-0">
        <MapaFincas {...props} />
      </div>

      {error && (
        <p role="alert" className="m-4 border-2 border-aviso bg-papel p-3 text-sm lg:absolute lg:left-1/2 lg:top-4 lg:-translate-x-1/2">
          No se pudieron cargar las fincas: {error}
        </p>
      )}

      {/* Paneles */}
      <div className="flex flex-col gap-4 p-4 lg:contents">
        <Panel
          titulo={tareasHoy.length ? "Tareas de hoy" : "Próximas tareas"}
          extra={`${tareas.length} abierta${tareas.length === 1 ? "" : "s"}`}
          className="lg:absolute lg:left-5 lg:top-5 lg:max-h-[calc(100%-130px)] lg:w-[310px] lg:overflow-y-auto sin-barra"
        >
          {visibles.length === 0 ? (
            <p className="ficha-pendiente p-3 text-sm text-tinta-suave">
              No hay tareas apuntadas. Escribe la primera como lo dirías:
              «regar Los Nuevos mañana».
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibles.map((t) => (
                <li key={t.id}>
                  <FilaTarea tarea={t} hoy={hoy} puedeEditar={puedeEditar} compacta />
                </li>
              ))}
            </ul>
          )}
          <Link href="/tareas" className="boton">
            {puedeEditar ? "+ Nueva tarea" : "Ver tareas"}
          </Link>
        </Panel>

        <div className="flex flex-col gap-4 lg:absolute lg:right-5 lg:top-5 lg:max-h-[calc(100%-275px)] lg:w-[330px] lg:overflow-y-auto sin-barra">
          <Panel titulo="Fechas clave" extra={cuentaAgenda ? "2 semanas" : undefined}>
            <LoQueViene agenda={agenda} hoy={hoy} puedeEditar={puedeEditar} falta={falta} max={3} />
          </Panel>

          <Panel titulo="Avisos" extra={totalAvisos || undefined}>
            <ListaAvisos avisos={avisos} incidencias={incidencias} hoy={hoy} puedeEditar={puedeEditar} compacta />
          </Panel>

          <Panel titulo="Pantanos">
            {pantanos.length === 0 && <p className="text-sm text-tinta-suave">Sin pantanos dados de alta.</p>}
            {pantanos.map((p) => (
              <BarraPantano key={p.id} pantano={p} finca={p.finca} hoy={hoy} />
            ))}
            <Link href="/agua" className="text-sm font-bold text-hoja-oscura underline underline-offset-2">
              Anotar nivel o ver el agua
            </Link>
          </Panel>
        </div>

        {/* Leyenda (solo escritorio) */}
        <div className="hidden lg:absolute lg:bottom-4 lg:left-5 lg:flex lg:flex-col lg:gap-1 lg:border-[3px] lg:border-marco lg:bg-pergamino/95 lg:px-2.5 lg:py-1.5 lg:text-xs lg:font-bold">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 border-2 border-tinta bg-aviso" /> Aviso urgente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 border-2 border-tinta bg-[#e0a02a]" /> Por revisar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 border-2 border-dashed border-tinta" /> Por confirmar
          </span>
        </div>
      </div>
    </div>
  );
}
