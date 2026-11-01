"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Contenedor que se desliza de lado. Al abrirse deja «hoy» a un cuarto del borde
 * izquierdo para que se vea lo que viene, y tiene flechas para moverse con el ratón
 * (con el dedo o el trackpad se desliza directamente).
 */
export function DeslizarAHoy({ xHoy, children }: { xHoy: number | null; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [puede, setPuede] = useState({ izq: false, der: false });

  const actualizar = () => {
    const el = ref.current;
    if (!el) return;
    setPuede({ izq: el.scrollLeft > 4, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (xHoy !== null && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = Math.max(0, (xHoy / 100) * el.scrollWidth - el.clientWidth / 4);
    }
    actualizar();
    const ro = new ResizeObserver(actualizar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [xHoy]);

  const mover = (sentido: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.6, behavior: "smooth" });
  };

  const flecha = (sentido: 1 | -1) => (
    <button
      type="button"
      onClick={() => mover(sentido)}
      aria-label={sentido === 1 ? "Ver meses siguientes" : "Ver meses anteriores"}
      className={`absolute top-1/2 z-40 hidden h-11 w-9 -translate-y-1/2 items-center justify-center border-[3px] border-madera-oscura bg-pergamino/95 text-tinta shadow-[0_3px_0_#3b2412] hover:bg-sol sm:flex ${
        sentido === 1 ? "right-0" : "left-0"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <path d={sentido === 1 ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} />
      </svg>
    </button>
  );

  return (
    <div className="relative min-h-0 flex-1">
      {puede.izq && flecha(-1)}
      <div ref={ref} onScroll={actualizar} className="sin-barra h-full overflow-x-auto overflow-y-hidden">
        {children}
      </div>
      {puede.der && flecha(1)}
    </div>
  );
}
