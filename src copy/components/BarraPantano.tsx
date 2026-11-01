import { ultimoNivel, type Pantano } from "@/lib/datos";
import { fechaCorta, formatoNumero } from "@/lib/texto";

/** Nivel de un pantano: barra llena si hay lectura, discontinua si no. */
export function BarraPantano({
  pantano,
  finca,
  hoy,
}: {
  pantano: Pantano;
  finca: string;
  hoy: string;
}) {
  const nivel = ultimoNivel(pantano);
  const tope = Number(pantano.capacidad_util_m3 ?? pantano.capacidad_m3 ?? 0);
  const pct =
    nivel?.nivel_m3 != null && tope > 0
      ? Math.max(0, Math.min(100, Math.round((Number(nivel.nivel_m3) / tope) * 100)))
      : null;

  const capacidad = pantano.capacidad_util_m3
    ? `~${formatoNumero(Number(pantano.capacidad_util_m3))} m³ útiles`
    : pantano.capacidad_m3
      ? `~${formatoNumero(Number(pantano.capacidad_m3))} m³`
      : "capacidad por confirmar";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-2 text-[13px]">
        <b>{finca}</b>
        <span className="text-tinta-suave">{capacidad}</span>
      </div>
      {pct != null ? (
        <div
          role="meter"
          aria-label={`Nivel del pantano de ${finca}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-4 border-2 border-tinta bg-white"
        >
          <div className="h-full bg-agua" style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="h-4 border-2 border-dashed border-tinta-suave bg-papel" />
      )}
      <span className="text-xs text-tinta-suave">
        {nivel
          ? `${pct != null ? `${pct}% · ` : ""}${nivel.nivel_m3 != null ? `${formatoNumero(Number(nivel.nivel_m3))} m³` : "sin cifra"} · ${nivel.metodo === "a_ojo" ? "a ojo" : nivel.metodo} · ${fechaCorta(nivel.fecha, hoy)}`
          : "Aún sin lectura: el nivel se valora a ojo."}
      </span>
    </div>
  );
}
