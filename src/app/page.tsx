import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/Marco";
import { MapaFincas } from "@/components/MapaFincas";
import { Panel, Cargando } from "@/components/ui";
import { FilaTarea } from "@/components/FilaTarea";
import { BarraPantano } from "@/components/BarraPantano";
import { ListaAvisos } from "@/components/ListaAvisos";
import { obtenerContexto } from "@/lib/sesion";
import {
  cargarAvisos,
  cargarFincas,
  cargarIncidenciasAbiertas,
  cargarTareasAbiertas,
  cargarTratamientos,
} from "@/lib/datos";
import { hoyISO, momentoDelDia } from "@/lib/texto";

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
  const { supabase, puedeEditar, perfil } = await obtenerContexto();
  const hoy = hoyISO();
  const momento = momentoDelDia();

  const [{ fincas, error }, { tareas }, incidencias, avisos, { tratamientos }] =
    await Promise.all([
      cargarFincas(supabase),
      cargarTareasAbiertas(supabase),
      cargarIncidenciasAbiertas(supabase),
      cargarAvisos(supabase),
      cargarTratamientos(supabase),
    ]);

  const enCurso = tratamientos.filter((t) => t.estado === "en_curso");
  // En el mapa sale quien está trabajando: tareas en curso o de hoy con alguien asignado
  const tareasActivas = tareas.filter(
    (t) => t.estado === "en_curso" || (t.fecha_prevista === hoy && t.tareas_personas.length > 0),
  );
  const tareasHoy = tareas.filter((t) => !t.fecha_prevista || t.fecha_prevista <= hoy);
  // Orden: primero las de hoy (las que están en curso, arriba), luego las atrasadas
  // (la más reciente primero) y al final las que no tienen fecha.
  const grupo = (t: (typeof tareas)[number]) =>
    t.fecha_prevista === hoy ? 0 : t.fecha_prevista && t.fecha_prevista < hoy ? 1 : t.fecha_prevista ? 3 : 2;
  const ordenadas = (tareasHoy.length ? tareasHoy : tareas).slice().sort(
    (a, b) =>
      grupo(a) - grupo(b) ||
      Number(b.estado === "en_curso") - Number(a.estado === "en_curso") ||
      (grupo(a) === 1 ? (b.fecha_prevista ?? "").localeCompare(a.fecha_prevista ?? "") : (a.fecha_prevista ?? "").localeCompare(b.fecha_prevista ?? "")),
  );
  const MAX_TAREAS = 5;
  const visibles = ordenadas.slice(0, MAX_TAREAS);
  const ocultas = ordenadas.length - visibles.length;
  const pantanos = fincas.flatMap((f) => f.pantanos.map((p) => ({ ...p, finca: f.nombre })));
  const totalAvisos = avisos.length + incidencias.length;

  const props = { fincas, incidencias, tratamientosEnCurso: enCurso, tareasEnCurso: tareasActivas, momento, sobrio: perfil.estilo === "sobrio" };

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
          {ocultas > 0 && (
            <Link
              href="/tareas"
              className="block rounded-[3px] border-2 border-dashed border-borde-papel px-3 py-2 text-center text-sm font-bold text-tinta hover:bg-[#fff2c4]"
            >
              Ver {ocultas} tarea{ocultas === 1 ? "" : "s"} más →
            </Link>
          )}
          <Link href="/tareas" className="boton">
            {puedeEditar ? "+ Nueva tarea" : "Ver tareas"}
          </Link>
        </Panel>

        <div className="flex flex-col gap-4 lg:absolute lg:right-5 lg:top-5 lg:max-h-[calc(100%-275px)] lg:w-[330px] lg:overflow-y-auto sin-barra">

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
