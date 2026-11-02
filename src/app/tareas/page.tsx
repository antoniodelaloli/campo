import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Panel } from "@/components/ui";
import { FilaTarea } from "@/components/FilaTarea";
import { NuevaTarea } from "./NuevaTarea";
import { obtenerContexto } from "@/lib/sesion";
import {
  cargarFincas,
  cargarHitos,
  cargarPersonas,
  cargarTareasAbiertas,
  cargarTareasHechas,
  lugaresDe,
  type Tarea,
} from "@/lib/datos";
import { hoyISO, sumarDias } from "@/lib/texto";

export const instant = false;

const VISTAS = [
  { id: "hoy", label: "Hoy" },
  { id: "proximas", label: "Próximas" },
  { id: "hechas", label: "Hechas" },
] as const;

type Vista = (typeof VISTAS)[number]["id"];

export default function TareasPage({ searchParams }: PageProps<"/tareas">) {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Tareas searchParams={searchParams} />
      </Suspense>
    </Marco>
  );
}

async function Tareas({ searchParams }: { searchParams: PageProps<"/tareas">["searchParams"] }) {
  const { supabase, puedeEditar } = await obtenerContexto();
  const sp = await searchParams;
  const vista: Vista = VISTAS.some((v) => v.id === sp.vista) ? (sp.vista as Vista) : "hoy";
  const hoy = hoyISO();

  const [{ fincas }, personas, abiertas, hechas, { hitos }] = await Promise.all([
    cargarFincas(supabase),
    cargarPersonas(supabase),
    cargarTareasAbiertas(supabase),
    vista === "hechas" ? cargarTareasHechas(supabase) : Promise.resolve({ tareas: [] as Tarea[], error: null }),
    cargarHitos(supabase, sumarDias(hoy, 365)),
  ]);

  const deHoy = abiertas.tareas.filter((t) => !t.fecha_prevista || t.fecha_prevista <= hoy);
  const proximas = abiertas.tareas.filter((t) => t.fecha_prevista && t.fecha_prevista > hoy);
  const lista = vista === "hoy" ? deHoy : vista === "proximas" ? proximas : hechas.tareas;
  const cuenta: Record<Vista, number | null> = {
    hoy: deHoy.length,
    proximas: proximas.length,
    hechas: null,
  };
  const error = abiertas.error ?? hechas.error;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo="Tareas" subtitulo="Lo que hay que hacer en las fincas" />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr] lg:items-start">
        {puedeEditar ? (
          <NuevaTarea
            lugares={lugaresDe(fincas)}
            personas={personas.map((p) => ({ id: p.id, nombre: p.nombre }))}
            fechasClave={hitos.map((h) => ({ id: h.id, titulo: h.titulo, fecha: h.fecha }))}
            hoy={hoy}
          />
        ) : (
          <Panel>
            <p className="text-sm text-tinta-suave">Tu usuario puede consultar las tareas, pero no crearlas.</p>
          </Panel>
        )}

        <section className="flex flex-col gap-3">
          <nav aria-label="Filtrar tareas" className="flex gap-1.5">
            {VISTAS.map((v) => (
              <Link
                key={v.id}
                href={v.id === "hoy" ? "/tareas" : `/tareas?vista=${v.id}`}
                aria-current={vista === v.id ? "page" : undefined}
                className="pestana flex-1 px-2! whitespace-nowrap"
              >
                {v.label}
                {cuenta[v.id] != null && ` (${cuenta[v.id]})`}
              </Link>
            ))}
          </nav>

          {error && (
            <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
              No se pudieron cargar las tareas: {error}
            </p>
          )}

          {lista.length === 0 ? (
            <p className="ficha-pendiente p-4 text-sm text-tinta-suave">
              {vista === "hoy"
                ? "Nada pendiente para hoy."
                : vista === "proximas"
                  ? "No hay tareas con fecha futura."
                  : "Todavía no hay tareas hechas."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lista.map((t) => (
                <li key={t.id}>
                  <FilaTarea tarea={t} hoy={hoy} puedeEditar={puedeEditar} />
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-tinta-suave">
            Cada tarea guarda también cómo se dijo el sitio («finca 4», «Los Nuevos»), para poder
            resolverlo más tarde si aún no es un nombre conocido.
          </p>
          <Link href="/ideas" className="self-start text-xs font-bold text-tinta-suave underline-offset-2 hover:underline">
            Libreta de ideas y reflexiones →
          </Link>
        </section>
      </div>
    </main>
  );
}
