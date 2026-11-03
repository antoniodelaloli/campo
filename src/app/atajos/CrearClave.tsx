"use client";

import { useActionState } from "react";
import { crearClaveAtajo, type EstadoClave } from "./actions";
import { PasosAtajos } from "./PasosAtajos";

const INICIAL: EstadoClave = { clave: null, error: null };

export function CrearClave({ base }: { base: string }) {
  const [estado, accion, enviando] = useActionState(crearClaveAtajo, INICIAL);

  return (
    <div className="flex flex-col gap-4">
      {!estado.clave && (
        <form action={accion} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm font-bold">
            Para qué móvil es
            <input name="nombre" className="campo" placeholder="iPhone de Carlos" maxLength={60} />
          </label>
          <button type="submit" className="boton min-h-[44px]" disabled={enviando}>
            {enviando ? "Creando…" : "Crear clave"}
          </button>
        </form>
      )}
      {estado.error && (
        <p role="alert" className="border-2 border-aviso bg-[#fbe1dc] px-3 py-2 text-sm">
          {estado.error}
        </p>
      )}
      {estado.clave && (
        <div className="flex flex-col gap-2 border-[3px] border-hoja bg-[#eaf5dc] p-3">
          <p className="text-sm font-bold">Esta es la clave. Cópiala ahora: no se vuelve a enseñar.</p>
          <code className="block select-all break-all border-2 border-tinta bg-white px-2 py-2 text-[13px]">
            {estado.clave}
          </code>
          <button
            type="button"
            className="boton-madera self-start text-sm"
            onClick={() => navigator.clipboard?.writeText(estado.clave!).catch(() => {})}
          >
            Copiar clave
          </button>
        </div>
      )}
      <PasosAtajos base={base} clave={estado.clave} />
    </div>
  );
}
