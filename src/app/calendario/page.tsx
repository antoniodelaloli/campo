import Link from "next/link";
import { Suspense } from "react";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Panel } from "@/components/ui";
import { FilaAgenda } from "@/components/LoQueViene";
import { LineaCampana, type PuntoLinea } from "@/components/LineaCampana";
import { NuevoHito } from "./NuevoHito";
import { AvisosMovil } from "@/components/AvisosMovil";
import { obtenerContexto } from "@/lib/sesion";
import {
  cargarFincas,
  cargarHitos,
  cargarHitosCampana,
  cargarTareasDeHitos,
  cargarTratamientos,
  lugaresDe,
} from "@/lib/datos";
import { campanaDe, construirAgenda, elementoDeHito, nombreMes, type ElementoAgenda } from "@/lib/agenda";
import { hoyISO, sumarDias } from "@/lib/texto";

export const instant = false;

export default function FechasClavePage() {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <FechasClave />
      </Suspense>
    </Marco>
  );
}

function porMes(lista: ElementoAgenda[]) {
  const grupos = new Map<string, ElementoAgenda[]>();
  for (const e of lista) {
    const mes = e.fecha!.slice(0, 7);
    grupos.set(mes, [...(grupos.get(mes) ?? []), e]);
  }
  return [...grupos.entries()];
}

async function FechasClave() {
  const { supabase, puedeEditar } = await obtenerContexto();
  const hoy = hoyISO();
  const campana = campanaDe(hoy);
  const hasta = sumarDias(hoy, 365) > campana.hasta ? sumarDias(hoy, 365) : campana.hasta;

  const [{ fincas }, { hitos, error, falta }, hitosCampana, tareasDeHitos, { tratamientos }] = await Promise.all([
    cargarFincas(supabase),
    cargarHitos(supabase, hasta),
    cargarHitosCampana(supabase, campana.desde, campana.hasta),
    cargarTareasDeHitos(supabase),
    cargarTratamientos(supabase),
  ]);

  const agenda = construirAgenda({ hitos, tratamientos, tareasDeHitos, hoy, hasta });
  const semana = sumarDias(hoy, 7);
  const estaSemana = agenda.proximos.filter((e) => e.fecha! <= semana);
  const despues = agenda.proximos.filter((e) => e.fecha! > semana);

  // Línea de la campaña: fechas clave apuntadas (también las hechas) y las calculadas
  const puntos: PuntoLinea[] = [
    ...hitosCampana.map((h) => ({ ...elementoDeHito(h), hecho: h.estado === "hecho" })),
    ...[...agenda.atrasados, ...agenda.proximos]
      .filter((e) => e.clase !== "hito")
      .map((e) => ({ ...e, hecho: false })),
  ];

  const fila = (e: ElementoAgenda) => (
    <li key={e.clave} id={e.clave} className="scroll-mt-24 target:outline-[3px] target:outline-offset-2 target:outline-sol">
      <FilaAgenda e={e} hoy={hoy} puedeEditar={puedeEditar} />
    </li>
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion
        titulo="Fechas clave"
        subtitulo="Lo importante de la campaña: cortes, tratamientos, plazos… El día a día va en Tareas."
      />

      {falta && (
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          Para apuntar fechas clave falta crear la tabla en Supabase: ejecuta <code>supabase/migrations/0003_hitos.sql</code> y
          después <code>supabase/datos_0003.sql</code>. Mientras, aquí salen los tratamientos previstos y los plazos de seguridad.
        </p>
      )}
      {error && (
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          No se pudieron cargar las fechas clave: {error}
        </p>
      )}

      <LineaCampana puntos={puntos} campana={campana} hoy={hoy} />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr] lg:items-start">
        <div className="flex flex-col gap-5">
          {puedeEditar && !falta ? (
            <NuevoHito lugares={lugaresDe(fincas)} hoy={hoy} />
          ) : (
            <Panel>
              <p className="text-sm text-tinta-suave">
                {falta
                  ? "Cuando exista la tabla de fechas clave, aquí podrás apuntarlas."
                  : "Tu usuario puede consultar las fechas clave, pero no apuntarlas."}
              </p>
            </Panel>
          )}
          <Panel titulo="Avisos en este móvil">
            <AvisosMovil />
          </Panel>
          <Link
            href="/atajos"
            className="ficha flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold hover:bg-[#f6e7c1]"
          >
            <span>
              Atajos de Siri: <span className="font-normal">«Oye Siri, incidencia»</span>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="flex flex-col gap-5">
          {agenda.atrasados.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="atrasado">
              <h2 id="atrasado" className="titulo-pixel text-xl text-[#7d1a10]">
                Se ha pasado la fecha
              </h2>
              <ul className="flex flex-col gap-2">{agenda.atrasados.map(fila)}</ul>
            </section>
          )}

          <section className="flex flex-col gap-2" aria-labelledby="semana">
            <h2 id="semana" className="titulo-pixel text-xl">
              Esta semana
            </h2>
            {estaSemana.length === 0 ? (
              <p className="ficha-pendiente p-3 text-sm text-tinta-suave">Ninguna fecha clave en los próximos 7 días.</p>
            ) : (
              <ul className="flex flex-col gap-2">{estaSemana.map(fila)}</ul>
            )}
          </section>

          {porMes(despues).map(([mes, lista]) => (
            <section key={mes} className="flex flex-col gap-2" aria-labelledby={`mes-${mes}`}>
              <h2 id={`mes-${mes}`} className="titulo-pixel text-xl">
                {nombreMes(`${mes}-01`)}
              </h2>
              <ul className="flex flex-col gap-2">{lista.map(fila)}</ul>
            </section>
          ))}

          {agenda.porConfirmar.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="por-confirmar">
              <h2 id="por-confirmar" className="titulo-pixel text-xl">
                Por confirmar
              </h2>
              <ul className="flex flex-col gap-2">{agenda.porConfirmar.map(fila)}</ul>
            </section>
          )}

          <p className="text-xs text-tinta-suave">
            Además de las fechas clave apuntadas, aquí salen solos los tratamientos previstos y el fin del plazo de
            seguridad de lo aplicado (cuando el plazo de cada producto está confirmado). Las tareas del día a día van en
            Tareas; al crear una tarea se puede elegir de qué fecha clave cuelga. Lo hecho o anulado no se borra.
          </p>
        </div>
      </div>
    </main>
  );
}
