import type { ReactNode } from "react";
import Link from "next/link";
import { normalizar } from "@/lib/texto";

/** Panel de pergamino con título pixel. */
export function Panel({
  titulo,
  extra,
  children,
  className = "",
}: {
  titulo?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex flex-col gap-2.5 p-3.5 ${className}`}>
      {titulo && (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="titulo-pixel text-[22px]">{titulo}</h2>
            {extra && <span className="text-[13px] font-bold text-tinta-suave">{extra}</span>}
          </div>
          <div className="h-1 bg-borde-papel" />
        </>
      )}
      {children}
    </section>
  );
}

/** Cabecera de una sección con vuelta al mapa. */
export function CabeceraSeccion({
  titulo,
  subtitulo,
  volver = "/",
  children,
}: {
  titulo: string;
  subtitulo?: string;
  volver?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Link
          href={volver}
          aria-label="Volver"
          className="flex h-11 w-11 items-center justify-center rounded-[4px] border-[3px] border-madera-oscura bg-madera-clara text-pergamino shadow-[0_3px_0_#3b2412]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div>
          <h1 className="titulo-pixel text-[28px]">{titulo}</h1>
          {subtitulo && <p className="text-sm text-tinta-suave">{subtitulo}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

const COLOR_FINCA: Record<string, [string, string]> = {
  corvera: ["#cfe5ff", "#1d4a80"],
  valladolises: ["#fde2a6", "#6b3800"],
  lobosillo: ["#e6d3a3", "#4d3216"],
};

/** Etiqueta de color de una finca. */
export function ChipFinca({ nombre }: { nombre: string | null | undefined }) {
  const [bg, fg] = COLOR_FINCA[normalizar(nombre ?? "")] ?? ["#ece0c0", "#5a3a1a"];
  return (
    <span className="chip" style={{ background: bg, color: fg }}>
      {nombre ?? "Sin finca"}
    </span>
  );
}

const TONOS = {
  verde: ["#d5ebb8", "#2f5a1c"],
  ambar: ["#fde2a6", "#6b3800"],
  rojo: ["#f6c7bf", "#7d1a10"],
  azul: ["#cfe5ff", "#1d4a80"],
  neutro: ["#ece0c0", "#5a3a1a"],
} as const;

export type Tono = keyof typeof TONOS;

export function Chip({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  const [bg, fg] = TONOS[tono];
  return (
    <span className="chip" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

/** Fila clave/valor con puntitos. */
export function Dato({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b-2 border-dotted border-borde-papel pb-1 text-sm">
      <span className="text-tinta-suave">{k}</span>
      <b className="text-right">{v}</b>
    </div>
  );
}

/** Texto de "por confirmar". */
export function PorConfirmar({ children = "por confirmar" }: { children?: ReactNode }) {
  return <span className="font-semibold text-tinta-suave italic">{children}</span>;
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <p className="titulo-pixel animate-pulse text-xl text-tinta-suave">{texto}</p>
    </div>
  );
}

export const FIABILIDAD: Record<string, string> = {
  medido: "medido",
  declarado: "declarado",
  pendiente: "pendiente",
};
