import Link from "next/link";
import { cambiarEstadoHito } from "@/app/calendario/actions";
import { Chip, ChipFinca } from "@/components/ui";
import { cuentaAtras, partesFecha, type Agenda, type ElementoAgenda } from "@/lib/agenda";

/** Calendarito de la fila: día grande y mes. */
function Dia({ fecha, atrasado, compacta }: { fecha: string | null; atrasado: boolean; compacta: boolean }) {
  const ancho = compacta ? "w-9" : "w-11";
  if (!fecha) {
    return (
      <div
        className={`flex ${compacta ? "h-10" : "h-12"} ${ancho} shrink-0 flex-col items-center justify-center border-[3px] border-dashed border-madera-oscura bg-papel font-pixel text-lg font-bold text-tinta-suave`}
        aria-hidden="true"
      >
        ?
      </div>
    );
  }
  const { dia, mes } = partesFecha(fecha);
  return (
    <div
      className={`flex ${ancho} shrink-0 flex-col items-stretch border-[3px] text-center ${
        atrasado ? "border-[#7d1a10]" : "border-madera-oscura"
      }`}
      aria-hidden="true"
    >
      <span
        className={`font-pixel ${compacta ? "text-[10px] leading-3.5" : "text-[11px] leading-4"} font-bold uppercase text-pergamino ${
          atrasado ? "bg-[#a8321f]" : "bg-madera"
        }`}
      >
        {mes}
      </span>
      <span className={`bg-papel font-pixel font-bold ${compacta ? "text-base leading-6" : "text-xl leading-7"}`}>{dia}</span>
    </div>
  );
}

export function FilaAgenda({
  e,
  hoy,
  puedeEditar,
  compacta = false,
}: {
  e: ElementoAgenda;
  hoy: string;
  puedeEditar: boolean;
  compacta?: boolean;
}) {
  const atrasado = !!e.fecha && e.fecha < hoy;
  const cuenta = e.fecha ? cuentaAtras(e.fecha, hoy, e.aproximada) : null;

  return (
    <div className={`flex items-start ${compacta ? "gap-2 p-2" : "gap-2.5 p-2.5"} ${e.fecha ? "ficha" : "ficha-pendiente"}`}>
      <Dia fecha={e.fecha} atrasado={atrasado} compacta={compacta} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={e.href}
          className={`font-bold hover:underline ${compacta ? "line-clamp-2 text-sm leading-tight" : "text-[15px] leading-snug"}`}
        >
          {e.titulo}
        </Link>
        <div className="flex flex-wrap gap-1">
          {cuenta ? (
            <Chip tono={cuenta.tono}>
              {cuenta.texto}
              {atrasado ? " · sin hacer" : ""}
              {e.hora ? ` · ${e.hora}` : ""}
            </Chip>
          ) : (
            <Chip tono="ambar">Por confirmar</Chip>
          )}
          {e.finca && <ChipFinca nombre={e.finca} />}
          {!compacta && <Chip tono="neutro">{e.etiqueta}</Chip>}
          {e.importante && !compacta && e.fecha && <Chip tono="rojo">Importante</Chip>}
          {e.repetir === "anual" && !compacta && <Chip tono="verde">Cada año</Chip>}
          {e.tareas && (
            <Chip tono={e.tareas.every((t) => t.hecha) ? "verde" : "neutro"}>
              {e.tareas.filter((t) => t.hecha).length} de {e.tareas.length} tarea{e.tareas.length === 1 ? "" : "s"}
            </Chip>
          )}
        </div>
        {e.detalle && !compacta && <p className="text-xs leading-snug text-tinta-suave">{e.detalle}</p>}
        {e.tareas && !compacta && (
          <ul className="flex flex-col gap-0.5 border-l-[3px] border-borde-papel pl-2 text-[13px]" aria-label="Tareas de esta fecha clave">
            {e.tareas.map((t) => (
              <li key={t.id} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center border-2 ${t.hecha ? "border-hoja-oscura bg-[#d5ebb8]" : "border-tinta bg-white"}`}
                >
                  {t.hecha && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#2f5a1c" strokeWidth="5">
                      <path d="M4 12l5 5L20 6" />
                    </svg>
                  )}
                </span>
                <span className={t.hecha ? "text-tinta-suave line-through" : "font-semibold"}>
                  {t.titulo}
                  <span className="sr-only">{t.hecha ? " (hecha)" : " (pendiente)"}</span>
                </span>
              </li>
            ))}
            <li>
              <Link href="/tareas?vista=proximas" className="text-xs font-bold text-hoja-oscura underline underline-offset-2">
                Ver en Tareas
              </Link>
            </li>
          </ul>
        )}
      </div>
      {puedeEditar && e.hitoId && compacta && (
        <form action={cambiarEstadoHito} className="shrink-0">
          <input type="hidden" name="id" value={e.hitoId} />
          <input type="hidden" name="estado" value="hecho" />
          <button
            type="submit"
            title="Marcar como hecha"
            aria-label={`Marcar como hecha: ${e.titulo}`}
            className="flex h-8 w-8 items-center justify-center border-[3px] border-hoja-oscura bg-[#d5ebb8] text-hoja-oscura hover:bg-[#c4e19f]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          </button>
        </form>
      )}
      {puedeEditar && e.hitoId && !compacta && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <form action={cambiarEstadoHito}>
            <input type="hidden" name="id" value={e.hitoId} />
            <input type="hidden" name="estado" value="hecho" />
            <button
              type="submit"
              className="border-[3px] border-hoja-oscura bg-[#d5ebb8] px-2 py-1 font-pixel text-[13px] font-bold text-hoja-oscura shadow-[0_2px_0_#2f5a1c] hover:bg-[#c4e19f]"
              aria-label={`Marcar como hecha: ${e.titulo}`}
            >
              Hecha
            </button>
          </form>
          <form action={cambiarEstadoHito}>
            <input type="hidden" name="id" value={e.hitoId} />
            <input type="hidden" name="estado" value="anulado" />
            <button
              type="submit"
              className="text-xs font-bold text-tinta-suave underline underline-offset-2 hover:text-[#7d1a10]"
              aria-label={`Anular: ${e.titulo}`}
            >
              Anular
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Panel del inicio: fechas clave atrasadas y de las próximas dos semanas. */
export function LoQueViene({
  agenda,
  hoy,
  puedeEditar,
  falta,
  max = 5,
}: {
  agenda: Agenda;
  hoy: string;
  puedeEditar: boolean;
  /** la tabla de fechas clave todavía no existe */
  falta: boolean;
  max?: number;
}) {
  const todos = [...agenda.atrasados, ...agenda.proximos, ...agenda.porConfirmar];
  const visibles = todos.slice(0, max);
  const resto = todos.length - visibles.length;

  return (
    <div className="flex flex-col gap-2">
      {visibles.length === 0 ? (
        <p className="ficha-pendiente p-3 text-sm text-tinta-suave">
          Ninguna fecha clave en las próximas dos semanas.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((e) => (
            <li key={e.clave}>
              <FilaAgenda e={e} hoy={hoy} puedeEditar={puedeEditar} compacta />
            </li>
          ))}
        </ul>
      )}
      {falta && (
        <p className="text-xs text-tinta-suave">
          Para apuntar fechas clave falta ejecutar <code>0003_hitos.sql</code> en Supabase.
        </p>
      )}
      <Link href="/calendario" className="text-sm font-bold text-hoja-oscura underline underline-offset-2">
        {resto > 0 ? `Ver ${resto} más en fechas clave` : "Ver todas las fechas clave"}
      </Link>
    </div>
  );
}
