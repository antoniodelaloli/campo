import Link from "next/link";
import { cambiarEstadoTarea } from "@/app/tareas/actions";
import { lugarDeTarea, type Tarea } from "@/lib/datos";
import { cuandoAmable, NOMBRE_TIPO } from "@/lib/texto";
import { Chip, ChipFinca } from "@/components/ui";

/** Una tarea con su casilla para marcarla como hecha (o reabrirla). */
export function FilaTarea({
  tarea,
  hoy,
  puedeEditar,
  compacta = false,
}: {
  tarea: Tarea;
  hoy: string;
  puedeEditar: boolean;
  compacta?: boolean;
}) {
  const hecha = tarea.estado === "terminada" || tarea.estado === "verificada";
  const atrasada = !hecha && !!tarea.fecha_prevista && tarea.fecha_prevista < hoy;
  const personas = tarea.tareas_personas
    .map((tp) => tp.personas?.nombre)
    .filter(Boolean)
    .join(", ");
  const lugar = lugarDeTarea(tarea);
  const sinResolver = !tarea.finca_id && !!tarea.ubicacion_texto;

  return (
    <div className={`ficha flex items-start gap-2.5 ${compacta ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
      {puedeEditar ? (
        <form action={cambiarEstadoTarea}>
          <input type="hidden" name="id" value={tarea.id} />
          <input type="hidden" name="estado" value={hecha ? "prevista" : "terminada"} />
          <button
            type="submit"
            aria-label={hecha ? `Reabrir: ${tarea.titulo}` : `Marcar como hecha: ${tarea.titulo}`}
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-[3px] border-tinta bg-white hover:bg-sol/40"
          >
            {hecha && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f5a1c" strokeWidth="4" aria-hidden="true">
                <path d="M4 12l5 5L20 6" />
              </svg>
            )}
          </button>
        </form>
      ) : (
        <span aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 border-[3px] border-tinta/40 bg-white" />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`font-bold ${compacta ? "text-sm" : "text-[15px]"} ${hecha ? "text-tinta-suave line-through" : ""}`}>
          {tarea.titulo}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {tarea.fincas ? <ChipFinca nombre={tarea.fincas.nombre} /> : null}
          {(tarea.zonas || tarea.sectores_riego) && (
            <span className="text-xs text-tinta-suave">{lugar}</span>
          )}
          {sinResolver && <Chip tono="rojo">{lugar}</Chip>}
          {personas && <span className="text-xs text-tinta-suave">{personas}</span>}
          {tarea.estado === "en_curso" ? (
            <Chip tono="verde">En curso</Chip>
          ) : atrasada ? (
            <Chip tono="rojo">{cuandoAmable(tarea.fecha_prevista, hoy)} · atrasada</Chip>
          ) : (
            <Chip tono={tarea.fecha_prevista === hoy ? "ambar" : "neutro"}>
              {cuandoAmable(tarea.fecha_prevista, hoy)}
            </Chip>
          )}
          {tarea.prioridad === "alta" && !hecha && <Chip tono="rojo">Importante</Chip>}
          {!compacta && <Chip tono="azul">{NOMBRE_TIPO[tarea.tipo] ?? "Tarea"}</Chip>}
        </div>
        {tarea.hitos && tarea.hito_id && (
          <Link
            href={`/calendario#h-${tarea.hito_id}`}
            className="flex items-center gap-1 text-xs font-bold text-madera-oscura hover:underline"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M5 3v18 M5 4h12l-3 4 3 4H5" />
            </svg>
            <span className="sr-only">Fecha clave: </span>
            {tarea.hitos.titulo}
          </Link>
        )}
        {tarea.descripcion &&
          (tarea.descripcion.length > 140 || tarea.descripcion.includes("\n") ? (
            // descripción larga (por ejemplo, una idea convertida en tarea): dos líneas y «Ver más»
            <details className="group text-xs leading-snug text-tinta-suave">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="line-clamp-2 whitespace-pre-line group-open:line-clamp-none">{tarea.descripcion}</span>
                <span className="font-bold text-tinta underline underline-offset-2 group-open:hidden">Ver más</span>
                <span className="hidden font-bold text-tinta underline underline-offset-2 group-open:inline">Ver menos</span>
              </summary>
            </details>
          ) : (
            <p className={`text-xs leading-snug text-tinta-suave ${compacta ? "line-clamp-2" : ""}`}>{tarea.descripcion}</p>
          ))}
      </div>
    </div>
  );
}
