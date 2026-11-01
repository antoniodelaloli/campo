import { cerrarAviso } from "@/app/avisos/actions";
import type { Aviso, Incidencia } from "@/lib/datos";
import { fechaCorta } from "@/lib/texto";

const COLOR_NIVEL = {
  urgente: "#c8473a",
  atencion: "#e0a02a",
  info: "#7fb8d8",
} as const;

const COLOR_SEVERIDAD = {
  alta: "#c8473a",
  media: "#e0a02a",
  baja: "#7fb8d8",
} as const;

/**
 * Lista de avisos abiertos (y, si se pasan, incidencias del campo).
 * compacta = solo título y una línea (panel del mapa).
 */
export function ListaAvisos({
  avisos,
  incidencias = [],
  hoy,
  puedeEditar,
  compacta = false,
}: {
  avisos: Aviso[];
  incidencias?: Incidencia[];
  hoy: string;
  puedeEditar: boolean;
  compacta?: boolean;
}) {
  if (avisos.length === 0 && incidencias.length === 0) {
    return <p className="text-sm text-tinta-suave">Todo tranquilo.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {avisos.map((a) => (
        <li key={a.id} className="flex items-start gap-2.5 text-[13px] leading-snug">
          <span
            aria-hidden="true"
            className="mt-0.5 h-3 w-3 shrink-0 border-2 border-tinta"
            style={{ background: COLOR_NIVEL[a.nivel] }}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span>
              <b>{a.titulo}</b>
              {a.fincas && <span className="text-tinta-suave"> · {a.fincas.nombre}</span>}
            </span>
            {a.texto && (
              <span className={`text-tinta-suave ${compacta ? "line-clamp-2" : ""}`}>{a.texto}</span>
            )}
            {!compacta && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-tinta-suave">Desde el {fechaCorta(a.fecha, hoy)}</span>
                {puedeEditar && (
                  <form action={cerrarAviso}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="estado" value="resuelto" />
                    <button
                      type="submit"
                      className="min-h-[32px] border-2 border-hoja-oscura bg-[#eaf5dc] px-2 text-xs font-bold text-hoja-oscura hover:bg-[#d5ebb8]"
                    >
                      Marcar resuelto
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
      {incidencias.map((i) => (
        <li key={i.id} className="flex items-start gap-2.5 text-[13px] leading-snug">
          <span
            aria-hidden="true"
            className="mt-0.5 h-3 w-3 shrink-0 border-2 border-tinta"
            style={{ background: COLOR_SEVERIDAD[i.severidad] }}
          />
          <span>
            <b>{i.titulo}</b>
            {i.fincas && <span className="text-tinta-suave"> · {i.fincas.nombre}</span>}
            <span className="text-tinta-suave"> · desde el {fechaCorta(i.fecha, hoy)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
