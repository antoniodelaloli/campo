"use client";

import { useActionState } from "react";
import { apuntarEnDiario, type EstadoFormDiario } from "./actions";

const inicial: EstadoFormDiario = { ok: false, mensaje: null };

type OpcionFinca = { id: string; nombre: string };

/** «Apuntar en el diario»: lo que ya ha pasado, escrito como se diría. */
export function ApuntarDiario({ fincas }: { fincas: OpcionFinca[] }) {
  const [estado, accion, pendiente] = useActionState(apuntarEnDiario, inicial);
  return (
    <form key={estado.guardadoEn ?? 0} action={accion} className="flex flex-col gap-2.5">
      <label htmlFor="texto-diario" className="sr-only">
        Qué ha pasado
      </label>
      <textarea
        id="texto-diario"
        name="texto"
        rows={3}
        required
        minLength={3}
        maxLength={2000}
        placeholder="hoy ha venido el técnico a ver los árboles"
        className="campo"
      />
      {fincas.length > 1 && (
        <label className="flex flex-col gap-1 text-sm font-bold">
          Finca
          <select name="finca" className="campo" defaultValue="">
            <option value="">Sin finca concreta</option>
            {fincas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {fincas.length === 1 && <input type="hidden" name="finca" value={fincas[0].id} />}
      <button type="submit" className="boton self-start" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Apuntar"}
      </button>
      {estado.mensaje && (
        <p
          role={estado.ok ? "status" : "alert"}
          className={`text-sm font-semibold ${estado.ok ? "text-hoja-oscura" : "text-[#7d1a10]"}`}
        >
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
