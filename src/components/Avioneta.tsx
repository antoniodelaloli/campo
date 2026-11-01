"use client";

import { useEffect, useState } from "react";

/*
 * Avioneta fumigadora que cruza el cielo por encima de la Sierra de Carrascoy
 * arrastrando una lona con un mensaje. Sale cada 30-40 segundos mientras el
 * mapa está en vista 3D (y en bucle en el salvapantallas).
 * Si el sistema pide «reducir movimiento», no sale.
 */

const MENSAJE = "Mirad al cielo, nos fumigan";
const DURACION_S = 16; // lo que tarda en cruzar la pantalla
const PRIMERA_MS = 4_000;
const ENTRE_MIN_MS = 30_000;
const ENTRE_MAX_MS = 40_000;

export function Avioneta({ activa }: { activa: boolean }) {
  // cada pasada tiene su número: al cambiar, la animación vuelve a empezar
  const [pasada, setPasada] = useState(0);
  const [volando, setVolando] = useState(false);

  useEffect(() => {
    if (!activa) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- al salir de la vista 3D se recoge
      setVolando(false);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let temporizador: number;
    const siguiente = (espera: number) => {
      temporizador = window.setTimeout(() => {
        setPasada((n) => n + 1);
        setVolando(true);
        // al acabar de cruzar, se espera 30-40 s hasta la siguiente
        temporizador = window.setTimeout(() => {
          setVolando(false);
          siguiente(ENTRE_MIN_MS + Math.random() * (ENTRE_MAX_MS - ENTRE_MIN_MS));
        }, DURACION_S * 1000);
      }, espera);
    };
    siguiente(PRIMERA_MS);
    return () => window.clearTimeout(temporizador);
  }, [activa]);

  if (!volando) return null;

  return (
    <div
      key={pasada}
      aria-hidden="true"
      className="avioneta-cruza pointer-events-none absolute top-[14%] left-0 flex items-center"
      style={{ animationDuration: `${DURACION_S}s` }}
    >
      <div className="avioneta-balanceo flex items-center">
        {/* lona */}
        <div className="flex items-center">
          <div className="avioneta-ondea relative border-2 border-[#3b2a1a] bg-white px-3.5 py-1.5 font-pixel text-[18px] leading-none font-bold whitespace-nowrap text-[#3b2a1a] shadow-[2px_2px_0_rgba(59,42,26,.25)]">
            {MENSAJE}
            <span className="absolute top-0 -right-[2px] bottom-0 w-[3px] bg-[#c0392b]" />
          </div>
          {/* cuerda */}
          <svg width="54" height="14" viewBox="0 0 46 12" className="-ml-px">
            <path d="M0 6 Q 23 0 46 6" fill="none" stroke="#3b2a1a" strokeWidth="1.5" />
          </svg>
        </div>
        <Avion />
      </div>
    </div>
  );
}

/** Avioneta de fumigar en pixel art, mirando a la derecha. */
function Avion() {
  return (
    <svg width="105" height="52" viewBox="0 0 42 21" className="pixel -ml-1" shapeRendering="crispEdges">
      {/* nube de fumigación detrás */}
      <g className="avioneta-humo" fill="#e9f3ea">
        <rect x="0" y="12" width="3" height="3" />
        <rect x="3" y="14" width="2" height="2" />
        <rect x="1" y="16" width="2" height="2" />
      </g>
      {/* cola */}
      <rect x="6" y="5" width="3" height="6" fill="#c9a227" />
      <rect x="5" y="4" width="3" height="2" fill="#3b2a1a" />
      <rect x="6" y="11" width="6" height="2" fill="#c9a227" />
      {/* fuselaje */}
      <rect x="8" y="9" width="22" height="5" fill="#f6d743" />
      <rect x="8" y="13" width="22" height="1" fill="#c9a227" />
      <rect x="28" y="8" width="6" height="6" fill="#f6d743" />
      {/* cabina */}
      <rect x="21" y="6" width="6" height="3" fill="#8fd0f2" />
      <rect x="20" y="6" width="1" height="3" fill="#3b2a1a" />
      {/* ala */}
      <rect x="15" y="10" width="12" height="2" fill="#e0a02a" />
      <rect x="14" y="12" width="14" height="1" fill="#3b2a1a" />
      {/* depósito de fumigar y boquillas */}
      <rect x="16" y="14" width="9" height="2" fill="#7a8a99" />
      <rect x="17" y="16" width="1" height="1" fill="#3b2a1a" />
      <rect x="23" y="16" width="1" height="1" fill="#3b2a1a" />
      {/* tren de aterrizaje */}
      <rect x="27" y="14" width="1" height="3" fill="#3b2a1a" />
      <rect x="26" y="17" width="3" height="2" fill="#2b2b2b" />
      {/* morro y hélice */}
      <rect x="34" y="9" width="2" height="4" fill="#c0392b" />
      <g className="avioneta-helice">
        <rect x="36" y="4" width="1" height="13" fill="#3b2a1a" opacity="0.85" />
      </g>
      {/* rayita roja del fuselaje */}
      <rect x="10" y="11" width="16" height="1" fill="#c0392b" />
    </svg>
  );
}
