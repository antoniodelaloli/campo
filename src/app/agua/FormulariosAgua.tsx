"use client";

import { useActionState } from "react";
import { anotarLectura, anotarNivel, type EstadoFormAgua } from "./actions";

const inicial: EstadoFormAgua = { ok: false, mensaje: null };

function Mensaje({ estado }: { estado: EstadoFormAgua }) {
  if (!estado.mensaje) return null;
  return (
    <p
      role={estado.ok ? "status" : "alert"}
      className={`border-2 px-3 py-2 text-sm font-semibold ${
        estado.ok ? "border-hoja bg-[#eaf5dc] text-hoja-oscura" : "border-aviso bg-papel text-[#7d1a10]"
      }`}
    >
      {estado.mensaje}
    </p>
  );
}

export function FormNivel({
  pantanos,
  hoy,
}: {
  pantanos: { id: string; etiqueta: string }[];
  hoy: string;
}) {
  const [estado, accion, pendiente] = useActionState(anotarNivel, inicial);
  return (
    <form key={estado.guardadoEn ?? 0} action={accion} className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-1 text-sm font-bold">
        Pantano
        <select name="pantano" required className="campo" defaultValue={pantanos[0]?.id}>
          {pantanos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          A ojo (%)
          <input name="porcentaje" inputMode="numeric" placeholder="60" className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          o en m³
          <input name="nivel" inputMode="numeric" placeholder="15.000" className="campo" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Cómo
          <select name="metodo" className="campo" defaultValue="a_ojo">
            <option value="a_ojo">A ojo</option>
            <option value="calculado">Calculado</option>
            <option value="sensor">Sensor</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Fecha
          <input type="date" name="fecha" defaultValue={hoy} max={hoy} className="campo" />
        </label>
      </div>
      <Mensaje estado={estado} />
      <button type="submit" disabled={pendiente} className="boton bg-agua! border-agua-oscura! shadow-[0_3px_0_#1d4a80]! [text-shadow:0_2px_0_#1d4a80]!">
        {pendiente ? "Guardando…" : "Anotar nivel"}
      </button>
    </form>
  );
}

export function FormLectura({
  contadores,
  hoy,
}: {
  contadores: { id: string; etiqueta: string }[];
  hoy: string;
}) {
  const [estado, accion, pendiente] = useActionState(anotarLectura, inicial);
  return (
    <form key={estado.guardadoEn ?? 0} action={accion} className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-1 text-sm font-bold">
        Contador
        <select name="contador" required className="campo" defaultValue="">
          <option value="" disabled>
            Elige…
          </option>
          {contadores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Lectura (m³)
          <input name="lectura" inputMode="decimal" required placeholder="1.208.075" className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Fecha
          <input type="date" name="fecha" defaultValue={hoy} max={hoy} className="campo" />
        </label>
      </div>
      <Mensaje estado={estado} />
      <button type="submit" disabled={pendiente} className="boton-madera">
        {pendiente ? "Guardando…" : "Anotar lectura"}
      </button>
    </form>
  );
}
