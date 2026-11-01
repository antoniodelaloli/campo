"use client";

import { useActionState, useState } from "react";
import { crearHito, type EstadoFormHito } from "./actions";
import { NOMBRE_TIPO_HITO, OPCIONES_AVISO, TIPOS_HITO, tipoHitoDeTexto } from "@/lib/agenda";
import { fechaLarga, interpretarTarea, type Lugar } from "@/lib/texto";

const inicial: EstadoFormHito = { ok: false, mensaje: null };

/**
 * «Apuntar una fecha clave»: se escribe como se diría («cortar Corvera el 15 de diciembre»)
 * y se rellenan solos el día, la finca y el tipo. Todo se puede cambiar antes de guardar.
 */
export function NuevoHito({ lugares, hoy }: { lugares: Lugar[]; hoy: string }) {
  const [estado, accion, pendiente] = useActionState(crearHito, inicial);
  // La clave cambia tras cada guardado correcto y vacía el formulario.
  return (
    <Formulario key={estado.guardadoEn ?? 0} estado={estado} accion={accion} pendiente={pendiente} lugares={lugares} hoy={hoy} />
  );
}

function Formulario({
  estado,
  accion,
  pendiente,
  lugares,
  hoy,
}: {
  estado: EstadoFormHito;
  accion: (fd: FormData) => void;
  pendiente: boolean;
  lugares: Lugar[];
  hoy: string;
}) {
  const fincas = lugares.filter((l) => l.tipo === "finca");
  const [texto, setTexto] = useState("");
  // null = «lo que diga el texto»; un valor = elegido a mano
  const [fechaManual, setFechaManual] = useState<string | null>(null);
  const [fincaManual, setFincaManual] = useState<string | null>(null);
  const [tipoManual, setTipoManual] = useState<string | null>(null);

  const lectura = interpretarTarea(texto, lugares, hoy);
  const fincasLeidas = new Set(lectura?.candidatos.map((c) => c.finca_id) ?? []);
  const fincaLeida = fincasLeidas.size === 1 ? [...fincasLeidas][0] : "";

  const fecha = fechaManual ?? lectura?.fecha ?? "";
  const finca = fincaManual ?? fincaLeida;
  const tipo = tipoManual ?? (texto ? tipoHitoDeTexto(texto, lectura?.tipo ?? null) : "otro");

  return (
    <form action={accion} className="panel flex flex-col gap-3 p-3.5">
      <label htmlFor="texto-hito" className="titulo-pixel text-lg">
        Apuntar una fecha clave
      </label>
      <input
        id="texto-hito"
        name="texto"
        type="text"
        autoComplete="off"
        required
        maxLength={200}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="primer corte de Corvera el 15 de diciembre"
        className="campo"
        aria-describedby="ayuda-hito"
      />
      <p id="ayuda-hito" className="-mt-1 text-xs text-tinta-suave">
        Lo importante de la campaña: cortes, tratamientos, plazos de papeles… (el día a día va en Tareas). Si dices el día y la finca, se rellenan solos.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Cuándo
          <input
            type="date"
            name="fecha"
            required
            min="2020-01-01"
            max="2100-12-31"
            value={fecha}
            onChange={(e) => setFechaManual(e.target.value)}
            className="campo"
          />
          {fecha && <span className="text-xs font-semibold text-tinta-suave first-letter:uppercase">{fechaLarga(fecha)}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Finca
          <select name="finca" value={finca} onChange={(e) => setFincaManual(e.target.value)} className="campo">
            <option value="">Todas / ninguna</option>
            {fincas.map((f) => (
              <option key={f.id} value={f.finca_id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Tipo
          <select name="tipo" value={tipo} onChange={(e) => setTipoManual(e.target.value)} className="campo">
            {TIPOS_HITO.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO_HITO[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-2">
          Avisar
          <select name="aviso" defaultValue={OPCIONES_AVISO[0].valor} className="campo">
            {OPCIONES_AVISO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="aproximada" className="h-5 w-5 accent-[#5a3a1a]" />
          Fecha aproximada
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="anual" className="h-5 w-5 accent-[#5a3a1a]" />
          Se repite cada año
        </label>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer py-1 font-bold text-tinta-suave">Añadir una nota</summary>
        <textarea
          name="nota"
          maxLength={500}
          rows={3}
          placeholder="Lo que haga falta recordar (a quién llamar, papeles que llevar…)"
          className="campo mt-2 w-full"
        />
      </details>

      <p className="text-xs text-tinta-suave">
        Los avisos al móvil llegarán cuando la app esté publicada; mientras, las fechas clave salen en el inicio.
      </p>

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

      <button type="submit" className="boton" disabled={pendiente || !fecha}>
        {pendiente ? "Guardando…" : "Guardar fecha clave"}
      </button>
    </form>
  );
}
