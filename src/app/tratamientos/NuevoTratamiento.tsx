"use client";

import { useActionState, useState } from "react";
import { crearTratamiento, type EstadoFormTratamiento } from "./actions";

type Opcion = { id: string; nombre: string };

const inicial: EstadoFormTratamiento = { ok: false, mensaje: null };

export function NuevoTratamiento({
  fincas,
  personas,
  productos,
  hoy,
}: {
  fincas: Opcion[];
  personas: Opcion[];
  productos: (Opcion & { validado: boolean })[];
  hoy: string;
}) {
  const [estado, accion, pendiente] = useActionState(crearTratamiento, inicial);
  return (
    <Formulario
      key={estado.guardadoEn ?? 0}
      estado={estado}
      accion={accion}
      pendiente={pendiente}
      fincas={fincas}
      personas={personas}
      productos={productos}
      hoy={hoy}
    />
  );
}

function Formulario({
  estado,
  accion,
  pendiente,
  fincas,
  personas,
  productos,
  hoy,
}: {
  estado: EstadoFormTratamiento;
  accion: (fd: FormData) => void;
  pendiente: boolean;
  fincas: Opcion[];
  personas: Opcion[];
  productos: (Opcion & { validado: boolean })[];
  hoy: string;
}) {
  const [filas, setFilas] = useState(1);

  return (
    <form action={accion} className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Finca
          <select name="finca" required className="campo" defaultValue="">
            <option value="" disabled>
              Elige…
            </option>
            {fincas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Fecha
          <input type="date" name="fecha" defaultValue={hoy} className="campo" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-bold">
        Contra qué
        <input name="objetivo" placeholder="Piojo y araña roja" className="campo" maxLength={120} />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Quién
          <select name="aplicador" className="campo" defaultValue="">
            <option value="">Sin indicar</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Estado
          <select name="estado" className="campo" defaultValue="en_curso">
            <option value="prevista">Previsto</option>
            <option value="en_curso">En curso</option>
            <option value="realizada">Hecho</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Litros por cuba
          <input name="litros_cuba" inputMode="numeric" defaultValue="2000" className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Nº de cubas
          <input name="n_cubas" inputMode="numeric" className="campo" />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2 border-2 border-borde-papel p-2.5">
        <legend className="px-1 text-sm font-bold">Productos por cuba</legend>
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr_76px_70px] gap-1.5">
            <select name={`producto_${i}`} aria-label={`Producto ${i + 1}`} className="campo" defaultValue="">
              <option value="">Producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.validado ? "" : " (sin validar)"}
                </option>
              ))}
            </select>
            <input name={`dosis_${i}`} aria-label={`Dosis ${i + 1}`} inputMode="decimal" placeholder="Dosis" className="campo" />
            <select name={`unidad_${i}`} aria-label={`Unidad ${i + 1}`} className="campo" defaultValue="L">
              <option>L</option>
              <option>kg</option>
              <option>cc</option>
              <option>g</option>
              <option>mL</option>
            </select>
          </div>
        ))}
        {filas < 6 && (
          <button
            type="button"
            onClick={() => setFilas((n) => n + 1)}
            className="self-start text-sm font-bold text-hoja-oscura underline underline-offset-2"
          >
            + Otro producto
          </button>
        )}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-bold">
        Notas
        <input name="notas" placeholder="Viento, avería, sectores…" className="campo" maxLength={300} />
      </label>

      {estado.mensaje && (
        <p
          role={estado.ok ? "status" : "alert"}
          className={`border-2 px-3 py-2 text-sm font-semibold ${
            estado.ok ? "border-hoja bg-[#eaf5dc] text-hoja-oscura" : "border-aviso bg-papel text-[#7d1a10]"
          }`}
        >
          {estado.mensaje}
        </p>
      )}

      <button type="submit" disabled={pendiente} className="boton">
        {pendiente ? "Guardando…" : "Anotar tratamiento"}
      </button>
    </form>
  );
}
