"use client";

import { useState } from "react";
import Link from "next/link";
import { NuevaTarea, type OpcionFechaClave } from "@/app/tareas/NuevaTarea";
import { FormLectura, FormNivel } from "@/app/agua/FormulariosAgua";
import { NuevoHito } from "@/app/calendario/NuevoHito";
import type { Lugar } from "@/lib/texto";

/*
 * Botonera «Apuntar en esta finca», debajo del plano: tarea, nivel del pantano,
 * lectura de contador o fecha clave sin salir de la página. Los formularios son
 * los mismos de Tareas, Agua y Agenda, con solo lo de esta finca.
 * Las demás lecturas (cubetas, luz…) irán aquí cuando exista «Agua y lecturas».
 */

type Accion = "tarea" | "nivel" | "lectura" | "fecha";

const ICONO: Record<Accion, string> = {
  tarea: "M5 12l4 4 10-10",
  nivel: "M12 3c3 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6.5 6-11z",
  lectura: "M4 12a8 8 0 1 1 16 0M12 12l4-4M8 18h8",
  fecha: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
};

export function AccionesFinca({
  finca,
  lugares,
  personas,
  fechasClave,
  pantanos,
  contadores,
  hoy,
}: {
  finca: string;
  lugares: Lugar[];
  personas: { id: string; nombre: string }[];
  fechasClave: OpcionFechaClave[];
  pantanos: { id: string; etiqueta: string }[];
  contadores: { id: string; etiqueta: string }[];
  hoy: string;
}) {
  const [abierta, setAbierta] = useState<Accion | null>(null);

  const botones: { id: Accion; texto: string; visible: boolean }[] = [
    { id: "tarea", texto: "Tarea", visible: true },
    { id: "lectura", texto: "Lectura de contador", visible: contadores.length > 0 },
    { id: "nivel", texto: "Nivel del pantano", visible: pantanos.length > 0 },
    { id: "fecha", texto: "Fecha clave", visible: true },
  ];

  return (
    <section className="panel flex flex-col gap-3 p-3.5" aria-labelledby="apuntar-finca">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="apuntar-finca" className="titulo-pixel text-[22px]">
          Apuntar en {finca}
        </h2>
        <Link href="/agua" className="text-[13px] font-bold text-tinta-suave underline-offset-2 hover:underline">
          Agua y lecturas →
        </Link>
      </div>
      <div className="h-1 bg-borde-papel" />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {botones
          .filter((b) => b.visible)
          .map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setAbierta(abierta === b.id ? null : b.id)}
              aria-expanded={abierta === b.id}
              className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[3px] border-[3px] px-2 py-2 text-center font-pixel text-[15px] leading-tight shadow-[0_3px_0_#3b2412] ${
                abierta === b.id
                  ? "border-madera-oscura bg-sol text-tinta"
                  : "border-madera-oscura bg-pergamino text-tinta hover:bg-[#fff2c4]"
              }`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d={ICONO[b.id]} />
              </svg>
              {b.texto}
            </button>
          ))}
      </div>

      {abierta && (
        <div className="ficha p-3">
          {abierta === "tarea" && <NuevaTarea lugares={lugares} personas={personas} fechasClave={fechasClave} hoy={hoy} />}
          {abierta === "lectura" && <FormLectura contadores={contadores} hoy={hoy} />}
          {abierta === "nivel" && <FormNivel pantanos={pantanos} hoy={hoy} />}
          {abierta === "fecha" && <NuevoHito lugares={lugares} hoy={hoy} />}
        </div>
      )}
    </section>
  );
}
