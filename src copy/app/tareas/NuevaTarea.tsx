"use client";

import { useActionState, useState } from "react";
import { crearTarea, type EstadoFormTarea } from "./actions";
import {
  cuandoAmable,
  interpretarTarea,
  NOMBRE_TIPO,
  type Lugar,
} from "@/lib/texto";

type Persona = { id: string; nombre: string };
export type OpcionFechaClave = { id: string; titulo: string; fecha: string };

const inicial: EstadoFormTarea = { ok: false, mensaje: null };

/**
 * "Apuntar algo": se escribe como se diría ("regar Los Nuevos mañana")
 * y se enseña cómo lo ha entendido antes de guardar.
 */
export function NuevaTarea({
  lugares,
  personas,
  fechasClave = [],
  hoy,
}: {
  lugares: Lugar[];
  personas: Persona[];
  /** fechas clave pendientes de las que puede colgar la tarea */
  fechasClave?: OpcionFechaClave[];
  hoy: string;
}) {
  const [estado, accion, pendiente] = useActionState(crearTarea, inicial);
  // La clave cambia tras cada guardado correcto y vacía el formulario.
  return (
    <Formulario
      key={estado.guardadoEn ?? 0}
      estado={estado}
      accion={accion}
      pendiente={pendiente}
      lugares={lugares}
      personas={personas}
      fechasClave={fechasClave}
      hoy={hoy}
    />
  );
}

function Formulario({
  estado,
  accion,
  pendiente,
  lugares,
  personas,
  fechasClave,
  hoy,
}: {
  estado: EstadoFormTarea;
  accion: (fd: FormData) => void;
  pendiente: boolean;
  lugares: Lugar[];
  personas: Persona[];
  fechasClave: OpcionFechaClave[];
  hoy: string;
}) {
  const [texto, setTexto] = useState("");
  const [eleccion, setEleccion] = useState("");
  const lectura = interpretarTarea(texto, lugares, hoy);

  const unico = lectura?.candidatos.length === 1 ? lectura.candidatos[0] : null;
  const ambiguo = (lectura?.candidatos.length ?? 0) > 1;
  const desconocido = !!lectura?.frase && lectura.candidatos.length === 0;
  const necesitaElegir = ambiguo || desconocido;
  const elegido = lugares.find((l) => `${l.tipo}:${l.id}` === eleccion);

  const opciones = ambiguo ? lectura!.candidatos : lugares;

  return (
    <form action={accion} className="panel flex flex-col gap-3 p-3.5">
      <label htmlFor="texto" className="titulo-pixel text-lg">
        Apuntar algo
      </label>
      <input
        id="texto"
        name="texto"
        type="text"
        autoComplete="off"
        required
        maxLength={300}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setEleccion("");
        }}
        placeholder="regar Los Nuevos mañana"
        className="campo"
        aria-describedby="lectura"
      />

      <div id="lectura" aria-live="polite" className="flex flex-col gap-2 text-[13px]">
        {lectura && (
          <>
            <span className="text-tinta-suave">Lo he entendido así:</span>
            <div className="flex flex-wrap gap-1.5">
              <span className="chip bg-[#d5ebb8] text-hoja-oscura">{NOMBRE_TIPO[lectura.tipo]}</span>
              <span className="chip bg-[#ece0c0] text-madera-oscura">
                {cuandoAmable(lectura.fecha, hoy)}
              </span>
              {elegido ? (
                <span className="chip bg-[#cfe5ff] text-agua-oscura">
                  {elegido.nombre}
                  {elegido.tipo !== "finca" ? ` · ${elegido.finca}` : ""}
                </span>
              ) : unico ? (
                <span className="chip bg-[#cfe5ff] text-agua-oscura">
                  {unico.nombre}
                  {unico.tipo !== "finca" ? ` · ${unico.finca}` : ""}
                </span>
              ) : lectura.frase ? (
                <span className="chip bg-[#f6c7bf] text-[#7d1a10]">¿{lectura.frase}?</span>
              ) : (
                <span className="chip bg-[#ece0c0] text-madera-oscura">Sin lugar</span>
              )}
            </div>
            {necesitaElegir && !elegido && (
              <span className="font-bold text-[#7d1a10]">
                {ambiguo
                  ? `«${lectura.frase}» está en varias fincas: elige cuál.`
                  : `«${lectura.frase}» todavía no es un nombre conocido: elige el sitio o guárdala sin lugar.`}
              </span>
            )}
          </>
        )}
      </div>

      {(necesitaElegir || eleccion) && (
        <label className="flex flex-col gap-1 text-sm font-bold">
          ¿Dónde?
          <select
            name="lugar"
            value={eleccion}
            onChange={(e) => setEleccion(e.target.value)}
            className="campo"
            required={ambiguo}
          >
            <option value="">Elige…</option>
            {!ambiguo && <option value="ninguno">Guardar sin lugar (resolver después)</option>}
            {opciones.map((l) => (
              <option key={`${l.tipo}:${l.id}`} value={`${l.tipo}:${l.id}`}>
                {l.tipo === "finca" ? l.nombre : `${l.nombre} · ${l.finca}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer py-1 font-bold text-tinta-suave">Más opciones</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 font-bold">
            Fecha exacta
            <input type="date" name="fecha" className="campo" min="2020-01-01" />
          </label>
          <label className="flex flex-col gap-1 font-bold">
            Quién
            <select name="persona" className="campo" defaultValue="">
              <option value="">Nadie en concreto</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          {fechasClave.length > 0 && (
            <label className="flex flex-col gap-1 font-bold sm:col-span-2">
              Para qué fecha clave
              <select name="hito" className="campo" defaultValue="">
                <option value="">Ninguna (tarea del día a día)</option>
                {fechasClave.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.titulo} · {cuandoAmable(h.fecha, hoy)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!necesitaElegir && !eleccion && (
            <label className="flex flex-col gap-1 font-bold sm:col-span-2">
              Lugar (si no lo has escrito)
              <select
                name="lugar"
                value={eleccion}
                onChange={(e) => setEleccion(e.target.value)}
                className="campo"
              >
                <option value="">El que diga el texto</option>
                {lugares.map((l) => (
                  <option key={`${l.tipo}:${l.id}`} value={`${l.tipo}:${l.id}`}>
                    {l.tipo === "finca" ? l.nombre : `${l.nombre} · ${l.finca}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </details>

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

      <button type="submit" className="boton" disabled={pendiente || (ambiguo && !eleccion)}>
        {pendiente ? "Guardando…" : "Guardar tarea"}
      </button>
    </form>
  );
}
