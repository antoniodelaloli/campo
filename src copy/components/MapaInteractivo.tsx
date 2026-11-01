"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  aMapa,
  FORMAS,
  GEO,
  HUECOS_VALLADOLISES,
  metrosPorUnidad,
  SECTORES_CORVERA,
  type ClaveFinca,
} from "@/lib/geografia";
import { normalizar } from "@/lib/texto";
import { LUGARES, Paisaje } from "@/components/Paisaje";
import { BotonTiempo } from "@/components/Tiempo";

/*
 * Mapa de las fincas a escala real, con zoom y arrastre (ratón, rueda, dedos y teclado).
 * Unidades del SVG = metros. Los carteles y bocadillos son HTML encima del mapa:
 * mantienen su tamaño al hacer zoom, como los marcadores de Google Maps.
 */

export type FincaEnMapa = {
  id: string;
  clave: ClaveFinca;
  nombre: string;
  subtitulo: string;
  areaHa: number;
  avisos: number;
  piscina: boolean;
  zonas: { id: string; nombre: string; especie: string | null }[];
  sectores: { id: string; numero: number }[];
  pantano: string | null;
};

export type ActividadEnMapa = {
  id: string;
  fincaId: string;
  tipo: "tractor" | "persona";
  texto: string;
};

type Vista = { cx: number; cy: number; mpp: number }; // centro (m) y metros por píxel
type Caja = { x0: number; y0: number; x1: number; y1: number };

const MPP_MIN = 0.15;
const MPP_MAX = 9;

const LUZ = {
  dia: { color: "transparent", opacidad: 0 },
  atardecer: { color: "#ff8a3d", opacidad: 0.2 },
  noche: { color: "#1b2a5e", opacidad: 0.42 },
} as const;

const limitar = (mpp: number) => Math.min(MPP_MAX, Math.max(MPP_MIN, mpp));

// ------------------------------------------------------------------
// Colocación de cada finca
// ------------------------------------------------------------------
type Colocada = FincaEnMapa & {
  k: number; // metros por unidad de dibujo
  tx: number;
  ty: number;
  caja: Caja;
};

function colocar(f: FincaEnMapa): Colocada {
  const geo = GEO[f.clave];
  const forma = FORMAS[f.clave];
  const k = metrosPorUnidad(f.clave, f.areaHa);
  const { x, y } = aMapa(geo.e, geo.n);
  const tx = x - forma.centro.x * k;
  const ty = y - forma.centro.y * k;
  return {
    ...f,
    k,
    tx,
    ty,
    caja: {
      x0: tx + forma.caja.x * k,
      y0: ty + forma.caja.y * k,
      x1: tx + (forma.caja.x + forma.caja.w) * k,
      y1: ty + (forma.caja.y + forma.caja.h) * k,
    },
  };
}

function unir(cajas: Caja[], margen: number): Caja {
  return {
    x0: Math.min(...cajas.map((c) => c.x0)) - margen,
    y0: Math.min(...cajas.map((c) => c.y0)) - margen,
    x1: Math.max(...cajas.map((c) => c.x1)) + margen,
    y1: Math.max(...cajas.map((c) => c.y1)) + margen,
  };
}

/** Huecos que dejan libres los paneles flotantes (para encuadrar). */
function margenes(ancho: number) {
  return ancho >= 1024
    ? { izq: 350, der: 360, arr: 70, aba: 110 }
    : { izq: 40, der: 90, arr: 70, aba: 150 };
}

function encuadrar(caja: Caja, w: number, h: number): Vista {
  const m = margenes(w);
  const libreW = Math.max(80, w - m.izq - m.der);
  const libreH = Math.max(80, h - m.arr - m.aba);
  const mpp = limitar(Math.max((caja.x1 - caja.x0) / libreW, (caja.y1 - caja.y0) / libreH));
  const ccx = (caja.x0 + caja.x1) / 2;
  const ccy = (caja.y0 + caja.y1) / 2;
  // el centro de la caja va al centro del hueco libre, no al de la pantalla
  const sx = (m.izq + w - m.der) / 2;
  const sy = (m.arr + h - m.aba) / 2;
  return { cx: ccx - (sx - w / 2) * mpp, cy: ccy - (sy - h / 2) * mpp, mpp };
}

function escalaBonita(mpp: number) {
  const opciones = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  return opciones.find((m) => m / mpp >= 70) ?? 10000;
}

// ------------------------------------------------------------------
// Componente
// ------------------------------------------------------------------
export function MapaInteractivo({
  fincas,
  actividades,
  momento,
}: {
  fincas: FincaEnMapa[];
  actividades: ActividadEnMapa[];
  momento: "dia" | "atardecer" | "noche";
}) {
  const colocadas = useMemo(() => fincas.map(colocar), [fincas]);
  const puntosTiempo = useMemo(
    () => fincas.map((f) => ({ id: f.id, nombre: f.nombre, lat: GEO[f.clave].lat, lon: GEO[f.clave].lon })),
    [fincas],
  );
  const cajaTodas = useMemo(
    () =>
      colocadas.length
        ? unir(colocadas.map((c) => c.caja), 120)
        : { x0: 4000, y0: 4000, x1: 6500, y1: 7500 },
    [colocadas],
  );

  const contRef = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [vista, setVista] = useState<Vista | null>(null);
  // vista con la que está pintado el SVG (se actualiza al parar el gesto)
  const [vistaSvg, setVistaSvg] = useState<Vista | null>(null);
  useEffect(() => {
    if (!vista) return;
    const t = setTimeout(() => setVistaSvg(vista), 140);
    return () => clearTimeout(t);
  }, [vista]);
  const vistaRef = useRef<Vista | null>(null);
  const tamRef = useRef<{ w: number; h: number } | null>(null);
  const tocado = useRef(false); // si el usuario ya movió el mapa, no se reencuadra solo
  const animacion = useRef<number | null>(null);

  const ponerVista = useCallback((v: Vista) => {
    vistaRef.current = v;
    setVista(v);
  }, []);

  // Tamaño del contenedor
  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect;
      const t = { w: width, h: height };
      tamRef.current = t;
      setTam(t);
      if (!tocado.current || !vistaRef.current) ponerVista(encuadrar(cajaTodas, width, height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cajaTodas, ponerVista]);

  const pararAnimacion = () => {
    if (animacion.current != null) cancelAnimationFrame(animacion.current);
    animacion.current = null;
  };

  const animarA = useCallback(
    (destino: Vista) => {
      pararAnimacion();
      const origen = vistaRef.current;
      if (!origen) return ponerVista(destino);
      const t0 = performance.now();
      const dur = 380;
      const paso = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        ponerVista({
          cx: origen.cx + (destino.cx - origen.cx) * e,
          cy: origen.cy + (destino.cy - origen.cy) * e,
          mpp: Math.exp(Math.log(origen.mpp) + (Math.log(destino.mpp) - Math.log(origen.mpp)) * e),
        });
        animacion.current = p < 1 ? requestAnimationFrame(paso) : null;
      };
      animacion.current = requestAnimationFrame(paso);
    },
    [ponerVista],
  );

  /** Zoom manteniendo fijo el punto (px, py) de la pantalla. */
  const zoomEn = useCallback(
    (px: number, py: number, factor: number, animado = false) => {
      const v = vistaRef.current;
      const t = tamRef.current;
      if (!v || !t) return;
      tocado.current = true;
      const wx = v.cx + (px - t.w / 2) * v.mpp;
      const wy = v.cy + (py - t.h / 2) * v.mpp;
      const mpp = limitar(v.mpp * factor);
      const nueva = { cx: wx - (px - t.w / 2) * mpp, cy: wy - (py - t.h / 2) * mpp, mpp };
      if (animado) animarA(nueva);
      else ponerVista(nueva);
    },
    [animarA, ponerVista],
  );

  const mover = useCallback(
    (dx: number, dy: number) => {
      const v = vistaRef.current;
      if (!v) return;
      tocado.current = true;
      ponerVista({ ...v, cx: v.cx - dx * v.mpp, cy: v.cy - dy * v.mpp });
    },
    [ponerVista],
  );

  // Rueda del ratón y trackpad (oyentes no pasivos para bloquear el zoom/scroll del navegador)
  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const alGirar = (e: WheelEvent) => {
      e.preventDefault();
      pararAnimacion();
      const r = el.getBoundingClientRect();
      // píxeles, líneas o páginas → píxeles
      let delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      delta = Math.max(-120, Math.min(120, delta));
      // El pellizco del trackpad llega como "rueda + Ctrl" con valores pequeños: va más sensible.
      const sensibilidad = e.ctrlKey ? 0.012 : 0.003;
      zoomEn(e.clientX - r.left, e.clientY - r.top, Math.exp(delta * sensibilidad));
    };
    // Safari (Mac) manda el pellizco como "gesture*"
    type Gesto = Event & { scale: number; clientX: number; clientY: number };
    let escalaPrevia = 1;
    const alEmpezarGesto = (e: Event) => {
      e.preventDefault();
      escalaPrevia = 1;
    };
    const alCambiarGesto = (e: Event) => {
      e.preventDefault();
      const g = e as Gesto;
      const r = el.getBoundingClientRect();
      zoomEn(g.clientX - r.left, g.clientY - r.top, escalaPrevia / g.scale);
      escalaPrevia = g.scale;
    };
    el.addEventListener("wheel", alGirar, { passive: false });
    el.addEventListener("gesturestart", alEmpezarGesto, { passive: false } as AddEventListenerOptions);
    el.addEventListener("gesturechange", alCambiarGesto, { passive: false } as AddEventListenerOptions);
    return () => {
      el.removeEventListener("wheel", alGirar);
      el.removeEventListener("gesturestart", alEmpezarGesto);
      el.removeEventListener("gesturechange", alCambiarGesto);
    };
  }, [zoomEn]);

  // Arrastre con ratón o dedos (uno = mover, dos = pellizcar)
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const recorrido = useRef(0);
  const pinza = useRef<{ dist: number; mx: number; my: number } | null>(null);

  const alPulsar = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pararAnimacion();
    const el = contRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    punteros.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    if (punteros.current.size === 1) recorrido.current = 0;
    pinza.current = null;

    const alMover = (ev: PointerEvent) => {
      const previo = punteros.current.get(ev.pointerId);
      if (!previo) return;
      const actual = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      punteros.current.set(ev.pointerId, actual);
      const lista = [...punteros.current.values()];
      if (lista.length === 1) {
        const dx = actual.x - previo.x;
        const dy = actual.y - previo.y;
        recorrido.current += Math.abs(dx) + Math.abs(dy);
        if (recorrido.current > 4) mover(dx, dy);
      } else if (lista.length >= 2) {
        const [a, b] = lista;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        recorrido.current += 10;
        if (pinza.current) {
          mover(mx - pinza.current.mx, my - pinza.current.my);
          zoomEn(mx, my, pinza.current.dist / dist);
        }
        pinza.current = { dist, mx, my };
      }
    };
    const alSoltar = (ev: PointerEvent) => {
      punteros.current.delete(ev.pointerId);
      pinza.current = null;
      if (punteros.current.size === 0) {
        window.removeEventListener("pointermove", alMover);
        window.removeEventListener("pointerup", alSoltar);
        window.removeEventListener("pointercancel", alSoltar);
      }
    };
    window.addEventListener("pointermove", alMover);
    window.addEventListener("pointerup", alSoltar);
    window.addEventListener("pointercancel", alSoltar);
  };

  // Si se ha arrastrado, el clic que llega al soltar no abre ningún cartel
  const alClicCaptura = (e: React.MouseEvent) => {
    if (recorrido.current > 6) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const alDobleClic = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    const r = contRef.current!.getBoundingClientRect();
    zoomEn(e.clientX - r.left, e.clientY - r.top, e.shiftKey ? 2 : 0.5, true);
  };

  const alTeclear = (e: React.KeyboardEvent) => {
    const t = tamRef.current;
    if (!t) return;
    const pasos: Record<string, [number, number]> = {
      ArrowLeft: [80, 0],
      ArrowRight: [-80, 0],
      ArrowUp: [0, 80],
      ArrowDown: [0, -80],
    };
    if (pasos[e.key]) {
      e.preventDefault();
      mover(...pasos[e.key]);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomEn(t.w / 2, t.h / 2, 0.6, true);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomEn(t.w / 2, t.h / 2, 1 / 0.6, true);
    } else if (e.key === "0") {
      e.preventDefault();
      verTodas();
    }
  };

  const verTodas = () => {
    const t = tamRef.current;
    if (!t) return;
    tocado.current = false;
    animarA(encuadrar(cajaTodas, t.w, t.h));
  };

  const irA = (c: Colocada) => {
    const t = tamRef.current;
    if (!t) return;
    tocado.current = true;
    animarA(encuadrar(unir([c.caja], 40), t.w, t.h));
  };

  const centroZoom = (factor: number) => {
    const t = tamRef.current;
    if (t) zoomEn(t.w / 2, t.h / 2, factor, true);
  };

  // ---------- proyección mundo → pantalla ----------
  const aPantalla = (x: number, y: number) => {
    if (!vista || !tam) return { x: 0, y: 0 };
    return { x: (x - vista.cx) / vista.mpp + tam.w / 2, y: (y - vista.cy) / vista.mpp + tam.h / 2 };
  };

  /*
   * Fluidez: mientras arrastras o haces zoom, el dibujo NO se vuelve a pintar;
   * se mueve/escala la imagen ya pintada (transformación CSS, va por la tarjeta gráfica).
   * Cuando paras un instante, se repinta nítido con la vista nueva.
   * El SVG es más grande que la pantalla (MARGEN) para que al arrastrar no se vean bordes.
   */
  const MARGEN = 0.5;
  const vSvg = vistaSvg ?? vista;
  const svgW = tam ? tam.w * (1 + 2 * MARGEN) : 0;
  const svgH = tam ? tam.h * (1 + 2 * MARGEN) : 0;
  const viewBox =
    vSvg && tam
      ? `${vSvg.cx - (svgW * vSvg.mpp) / 2} ${vSvg.cy - (svgH * vSvg.mpp) / 2} ${svgW * vSvg.mpp} ${svgH * vSvg.mpp}`
      : `${cajaTodas.x0} ${cajaTodas.y0} ${cajaTodas.x1 - cajaTodas.x0} ${cajaTodas.y1 - cajaTodas.y0}`;
  const transformacion =
    vista && vSvg && tam
      ? `translate(${(vSvg.cx - vista.cx) / vista.mpp}px, ${(vSvg.cy - vista.cy) / vista.mpp}px) scale(${vSvg.mpp / vista.mpp})`
      : undefined;

  // el nivel de detalle del dibujo depende de la vista ya pintada (no cambia a mitad de gesto)
  const pxPorUnidad = (c: Colocada) => (vSvg ? c.k / vSvg.mpp : 0);
  const luz = LUZ[momento];
  const escala = vista ? escalaBonita(vista.mpp) : null;

  return (
    <div
      ref={contRef}
      className="relative h-full w-full cursor-grab touch-none overflow-hidden bg-[#cbbb90] outline-none select-none active:cursor-grabbing"
      role="application"
      aria-label="Mapa de las fincas. Arrastra para moverte, rueda o pellizca para hacer zoom. Teclas: flechas, + y −, 0 para verlas todas."
      tabIndex={0}
      onPointerDown={alPulsar}
      onClickCapture={alClicCaptura}
      onDoubleClick={alDobleClic}
      onKeyDown={alTeclear}
    >
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="pixel absolute"
        style={
          tam
            ? {
                left: -tam.w * MARGEN,
                top: -tam.h * MARGEN,
                width: svgW,
                height: svgH,
                transform: transformacion,
                transformOrigin: "50% 50%",
                willChange: "transform",
                fontFamily: "var(--font-pixel)",
              }
            : { inset: 0, width: "100%", height: "100%", fontFamily: "var(--font-pixel)" }
        }
        aria-hidden="true"
      >
        <Patrones />
        {/* paisaje del entorno (apagado, para que destaquen las fincas) */}
        <Paisaje />
        {colocadas.map((c) => {
          const detalle = pxPorUnidad(c) >= 0.75;
          return (
            <g key={c.id} transform={`translate(${c.tx} ${c.ty}) scale(${c.k})`}>
              {/* claro alrededor de la finca + sombra, para que resalte sobre el paisaje */}
              <rect
                x={FORMAS[c.clave].caja.x + 4}
                y={FORMAS[c.clave].caja.y + 8}
                width={FORMAS[c.clave].caja.w}
                height={FORMAS[c.clave].caja.h}
                fill="#3b2a1a"
                opacity={0.22}
              />
              <rect
                x={FORMAS[c.clave].caja.x - 6}
                y={FORMAS[c.clave].caja.y - 6}
                width={FORMAS[c.clave].caja.w + 12}
                height={FORMAS[c.clave].caja.h + 12}
                fill="#e6d7a6"
                stroke="#fff4d6"
                strokeWidth={5}
              />
              {c.clave === "corvera" && <DibujoCorvera f={c} detalle={detalle} />}
              {c.clave === "valladolises" && <DibujoValladolises f={c} detalle={detalle} />}
              {c.clave === "lobosillo" && <DibujoLobosillo />}
              {actividades
                .filter((a) => a.fincaId === c.id)
                .map((a) => {
                  const p = FORMAS[c.clave][a.tipo];
                  return a.tipo === "tractor" ? (
                    <Tractor key={a.id} x={p.x} y={p.y} />
                  ) : (
                    <Persona key={a.id} x={p.x} y={p.y} />
                  );
                })}
            </g>
          );
        })}
      </svg>

      {/* luz del momento del día */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: luz.color, opacity: luz.opacidad }}
      />

      {/* carteles y bocadillos (tamaño fijo en pantalla) */}
      {vista && tam && (
        <>
          {colocadas.map((c) => {
            const forma = FORMAS[c.clave];
            const p = aPantalla(c.tx + forma.centro.x * c.k, c.ty + forma.arriba * c.k);
            return (
              <Link
                key={c.id}
                href={`/fincas/${c.id}`}
                draggable={false}
                className="absolute z-10 flex flex-col border-4 border-madera-oscura bg-madera-clara px-2.5 pt-1 pb-1.5 whitespace-nowrap shadow-[0_4px_0_#3b2412] hover:brightness-105"
                style={{ left: p.x, top: p.y, transform: "translate(-50%, calc(-100% - 8px))" }}
                aria-label={`Abrir la finca ${c.nombre}: ${c.subtitulo}`}
              >
                <span className="font-pixel text-lg leading-tight font-bold text-[#fff4d6] [text-shadow:0_2px_0_#5a3a1a] sm:text-xl">
                  {c.nombre.toUpperCase()}
                </span>
                <span className="text-xs font-bold text-tinta">{c.subtitulo}</span>
                {/* piquito que señala la finca */}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-[10px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-r-4 border-b-4 border-madera-oscura bg-madera-clara"
                />
                {c.avisos > 0 && (
                  <span className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-aviso font-pixel text-sm font-bold text-white">
                    {c.avisos}
                  </span>
                )}
              </Link>
            );
          })}
          {/* nombres de pueblos y parajes (como en Google Maps) */}
          {vista.mpp < 7 &&
            LUGARES.map((l) => {
              const p = aPantalla(l.x, l.y);
              if (p.x < -200 || p.y < -50 || p.x > tam.w + 200 || p.y > tam.h + 50) return null;
              return (
                <span
                  key={l.id}
                  className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap [text-shadow:0_0_3px_#fff,0_0_3px_#fff,0_0_6px_#fff] ${
                    l.tipo === "paraje"
                      ? "font-pixel text-[15px] tracking-[0.2em] text-[#4f5a35] uppercase"
                      : l.tipo === "infra"
                        ? "text-xs font-bold text-[#4a4a52]"
                        : "text-[13px] font-bold text-[#5e4127] italic"
                  }`}
                  style={{ left: p.x, top: p.y }}
                >
                  {l.nombre}
                </span>
              );
            })}
          {/* cuando la finca se ve muy pequeña, un aro la señala */}
          {colocadas.map((c) => {
            if ((c.caja.x1 - c.caja.x0) / vista.mpp > 36) return null;
            const forma = FORMAS[c.clave];
            const p = aPantalla(c.tx + forma.centro.x * c.k, c.ty + forma.centro.y * c.k);
            return (
              <span
                key={`aro-${c.id}`}
                aria-hidden="true"
                className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-sol shadow-[0_0_0_2px_#3b2a1a]"
                style={{ left: p.x, top: p.y }}
              />
            );
          })}
          {actividades.map((a) => {
            const c = colocadas.find((x) => x.id === a.fincaId);
            if (!c || pxPorUnidad(c) < 0.45) return null;
            const s = FORMAS[c.clave][a.tipo];
            const p = aPantalla(c.tx + (s.x + 20) * c.k, c.ty + s.y * c.k);
            return (
              <span
                key={a.id}
                className="burbuja-flota pointer-events-none absolute z-[5] border-2 border-tinta bg-white px-2 py-0.5 font-pixel text-[13px] font-semibold whitespace-nowrap text-tinta"
                style={{ left: p.x, top: p.y, transform: "translate(-50%, calc(-100% - 10px))" }}
              >
                {a.texto.length > 32 ? `${a.texto.slice(0, 31)}…` : a.texto}
              </span>
            );
          })}
        </>
      )}

      {/* controles: atajos a cada finca, zoom y escala */}
      <div className="absolute right-3 bottom-3 z-20 flex flex-col items-end gap-2 lg:right-5 lg:bottom-6">
        <BotonTiempo puntos={puntosTiempo} />
        <div className="flex items-end gap-2">
          <div className="hidden flex-col items-end gap-1 sm:flex">
            {colocadas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => irA(c)}
                className="border-2 border-madera-oscura bg-pergamino px-2 py-0.5 font-pixel text-xs font-bold whitespace-nowrap text-tinta hover:bg-sol"
              >
                Ir a {c.nombre}
              </button>
            ))}
          </div>
          <div className="flex flex-col border-[3px] border-madera-oscura bg-pergamino shadow-[0_3px_0_#3b2412]">
            <BotonMapa etiqueta="Acercar" onClick={() => centroZoom(0.55)}>
              <path d="M12 5v14M5 12h14" />
            </BotonMapa>
            <span className="h-[2px] bg-madera-oscura" />
            <BotonMapa etiqueta="Alejar" onClick={() => centroZoom(1 / 0.55)}>
              <path d="M5 12h14" />
            </BotonMapa>
            <span className="h-[2px] bg-madera-oscura" />
            <BotonMapa etiqueta="Ver todas las fincas" onClick={verTodas}>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </BotonMapa>
          </div>
        </div>
        {escala && vista && (
          <div className="flex flex-col items-end bg-pergamino/85 px-1.5 py-0.5 text-[11px] font-bold text-tinta">
            <span>{escala >= 1000 ? `${escala / 1000} km` : `${escala} m`}</span>
            <span className="h-1.5 border-x-2 border-b-2 border-tinta" style={{ width: escala / vista.mpp }} />
            <span className="mt-0.5 font-normal text-tinta-suave">Fincas a tamaño real · distancias acortadas</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BotonMapa({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-10 w-10 items-center justify-center text-tinta hover:bg-sol"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

// ------------------------------------------------------------------
// Dibujos (pixel art)
// ------------------------------------------------------------------
function Patrones() {
  return (
    <defs>
      {/* en unidades de dibujo (fincas) */}
      <pattern id="u-limonero" width="28" height="24" patternUnits="userSpaceOnUse">
        <rect width="28" height="24" fill="#b98c5a" />
        <rect x="5" y="4" width="18" height="14" fill="#2f7a34" />
        <rect x="7" y="2" width="14" height="2" fill="#2f7a34" />
        <rect x="7" y="18" width="14" height="2" fill="#2f7a34" />
        <rect x="8" y="5" width="12" height="9" fill="#46a047" />
        <rect x="10" y="7" width="2" height="2" fill="#f6d743" />
        <rect x="16" y="10" width="2" height="2" fill="#f6d743" />
        <rect x="13" y="13" width="2" height="2" fill="#f6d743" />
        <rect x="12" y="20" width="4" height="3" fill="#5e3b1c" />
      </pattern>
      <pattern id="u-mandarino" width="28" height="24" patternUnits="userSpaceOnUse">
        <rect width="28" height="24" fill="#b98c5a" />
        <rect x="5" y="4" width="18" height="14" fill="#37803a" />
        <rect x="7" y="2" width="14" height="2" fill="#37803a" />
        <rect x="7" y="18" width="14" height="2" fill="#37803a" />
        <rect x="8" y="5" width="12" height="9" fill="#4fa54a" />
        <rect x="10" y="7" width="3" height="3" fill="#ef8a22" />
        <rect x="16" y="10" width="3" height="3" fill="#ef8a22" />
        <rect x="12" y="13" width="2" height="2" fill="#ef8a22" />
        <rect x="12" y="20" width="4" height="3" fill="#5e3b1c" />
      </pattern>
      <pattern id="u-arbol" width="28" height="24" patternUnits="userSpaceOnUse">
        <rect width="28" height="24" fill="#b98c5a" />
        <rect x="5" y="4" width="18" height="14" fill="#3d7a3a" />
        <rect x="7" y="2" width="14" height="2" fill="#3d7a3a" />
        <rect x="7" y="18" width="14" height="2" fill="#3d7a3a" />
        <rect x="8" y="5" width="12" height="9" fill="#5a9a50" />
        <rect x="12" y="20" width="4" height="3" fill="#5e3b1c" />
      </pattern>
    </defs>
  );
}

function patron(especie: string | null) {
  const e = normalizar(especie ?? "");
  if (e.startsWith("mandarin")) return "url(#u-mandarino)";
  if (e.startsWith("limon")) return "url(#u-limonero)";
  return "url(#u-arbol)";
}

function Etiqueta({ x, y, texto }: { x: number; y: number; texto: string }) {
  const ancho = Math.max(50, texto.length * 8 + 14);
  return (
    <g>
      <rect x={x - ancho / 2} y={y - 16} width={ancho} height={22} fill="#f6e7c1" stroke="#3b2a1a" strokeWidth={2} />
      <text x={x} y={y} textAnchor="middle" fontSize={13} fontWeight={600} fill="#3b2a1a">
        {texto}
      </text>
    </g>
  );
}

function DibujoCorvera({ f, detalle }: { f: FincaEnMapa; detalle: boolean }) {
  return (
    <g>
      {/* tubería Pozo Villalba → pantano y pozo */}
      <path d="M50 262 L314 262 L314 106 L294 106" fill="none" stroke="#6aa7c9" strokeWidth={3} strokeDasharray="8 6" />
      <g transform="translate(28,248)">
        <rect x={0} y={6} width={28} height={22} fill="#6b4423" />
        <rect x={3} y={9} width={22} height={16} fill="#4aa3d9" />
        <rect x={-2} y={0} width={32} height={6} fill="#c0563a" />
      </g>
      {detalle && (
        <g>
          <rect x={62} y={250} width={106} height={24} fill="#f6e7c1" stroke="#3b2a1a" strokeWidth={2} />
          <text x={115} y={267} textAnchor="middle" fontSize={14} fontWeight={600} fill="#3b2a1a">
            Pozo Villalba
          </text>
        </g>
      )}
      <rect x={-4} y={-4} width={236} height={248} fill="#7a5230" />
      <rect x={0} y={0} width={228} height={240} fill="url(#u-limonero)" />
      <rect x={108} y={0} width={12} height={240} fill="#e0bd80" />
      <rect x={0} y={114} width={312} height={12} fill="#e0bd80" />
      <rect x={232} y={146} width={72} height={98} fill="#7a5230" />
      <rect x={236} y={150} width={64} height={90} fill="url(#u-limonero)" />
      {f.sectores.map((s) => {
        const p = SECTORES_CORVERA[s.numero];
        if (!p) return null;
        return (
          <g key={s.id}>
            <rect x={p.x} y={p.y} width={34} height={22} rx={4} fill="#f6e7c1" stroke="#3b2a1a" strokeWidth={2} />
            <text x={p.x + 17} y={p.y + 16} textAnchor="middle" fontSize={14} fontWeight={700} fill="#3b2a1a">
              S{s.numero}
            </text>
          </g>
        );
      })}
      <rect x={236} y={4} width={62} height={104} rx={10} fill="#8b6b3d" />
      <rect x={240} y={8} width={54} height={96} rx={8} fill="#4aa3d9" />
      <rect x={246} y={14} width={22} height={4} fill="#8fd0f2" />
      <rect x={258} y={24} width={14} height={4} fill="#8fd0f2" />
      {f.pantano && (
        <>
          <text x={267} y={62} textAnchor="middle" fontSize={13} fontWeight={700} fill="#ffffff">
            {f.pantano}
          </text>
          <text x={267} y={78} textAnchor="middle" fontSize={13} fontWeight={700} fill="#ffffff">
            m³
          </text>
        </>
      )}
    </g>
  );
}

function DibujoValladolises({ f, detalle }: { f: FincaEnMapa; detalle: boolean }) {
  return (
    <g>
      {/* canal del trasvase → pantano */}
      <path d="M2000 60 L319 60 L319 106" fill="none" stroke="#2f7fb0" strokeWidth={10} />
      <path d="M2000 60 L319 60 L319 106" fill="none" stroke="#5db6ea" strokeWidth={6} />
      <path d="M2000 60 L319 60 L319 106" fill="none" stroke="#bfe6fa" strokeWidth={2} strokeDasharray="10 12" />
      {detalle && (
        <g>
          <rect x={420} y={44} width={152} height={24} fill="#f6e7c1" stroke="#3b2a1a" strokeWidth={2} />
          <text x={496} y={61} textAnchor="middle" fontSize={14} fontWeight={600} fill="#3b2a1a">
            Canal del trasvase
          </text>
        </g>
      )}
      <rect x={-4} y={-4} width={268} height={238} fill="#7a5230" />
      <rect x={0} y={0} width={260} height={230} fill="#a9b86a" />
      {f.zonas.map((z) => {
        const h = HUECOS_VALLADOLISES[normalizar(z.nombre)];
        if (!h) return null;
        return (
          <g key={z.id}>
            <rect x={h.x} y={h.y} width={h.w} height={h.h} fill={patron(z.especie)} />
            {h.bancales && (
              <g fill="#8d6238">
                <rect x={h.x} y={h.y + 18} width={h.w} height={4} />
                <rect x={h.x} y={h.y + 44} width={h.w} height={4} />
                <rect x={h.x} y={h.y + 70} width={h.w} height={4} />
              </g>
            )}
          </g>
        );
      })}
      {/* casa y piscina */}
      <rect x={14} y={12} width={46} height={34} fill="#f3e6c8" stroke="#3b2a1a" strokeWidth={2} />
      <polygon points="10,14 37,0 64,14" fill="#c0563a" stroke="#3b2a1a" strokeWidth={2} />
      <rect x={32} y={28} width={10} height={18} fill="#6b4423" />
      <rect x={18} y={22} width={8} height={8} fill="#8fd0f2" />
      <rect x={48} y={22} width={8} height={8} fill="#8fd0f2" />
      <rect x={64} y={56} width={44} height={30} fill="#f3f3f3" stroke="#3b2a1a" strokeWidth={2} />
      <rect x={68} y={60} width={36} height={22} fill="#4ac0e8" />
      <rect x={72} y={64} width={12} height={3} fill="#bfeefb" />
      {f.piscina && (
        <g>
          <circle cx={108} cy={54} r={11} fill="#c8473a" stroke="#ffffff" strokeWidth={2} />
          <text x={108} y={60} textAnchor="middle" fontSize={16} fontWeight={700} fill="#ffffff">
            !
          </text>
        </g>
      )}
      {/* pantano */}
      <rect x={276} y={106} width={86} height={92} rx={10} fill="#8b6b3d" />
      <rect x={280} y={110} width={78} height={84} rx={8} fill="#4aa3d9" />
      <rect x={288} y={118} width={26} height={4} fill="#8fd0f2" />
      <rect x={306} y={128} width={16} height={4} fill="#8fd0f2" />
      {f.pantano && (
        <>
          <text x={319} y={150} textAnchor="middle" fontSize={13} fontWeight={700} fill="#ffffff">
            {f.pantano}
          </text>
          <text x={319} y={166} textAnchor="middle" fontSize={13} fontWeight={700} fill="#ffffff">
            m³
          </text>
        </>
      )}
      <path d="M276 150 L264 150" stroke="#6aa7c9" strokeWidth={4} strokeDasharray="6 4" />
      {detalle &&
        f.zonas.map((z) => {
          const h = HUECOS_VALLADOLISES[normalizar(z.nombre)];
          return h ? <Etiqueta key={`e-${z.id}`} x={h.ex} y={h.ey} texto={z.nombre} /> : null;
        })}
    </g>
  );
}

function DibujoLobosillo() {
  return (
    <g>
      <rect x={-4} y={-4} width={144} height={138} fill="#7a5230" />
      <rect x={0} y={0} width={136} height={130} fill="#d9c28d" />
      <g fill="#c4ab72">
        <rect x={10} y={12} width={40} height={4} />
        <rect x={60} y={30} width={50} height={4} />
        <rect x={14} y={52} width={60} height={4} />
        <rect x={40} y={76} width={70} height={4} />
        <rect x={12} y={100} width={50} height={4} />
      </g>
      <g>
        <rect x={30} y={38} width={4} height={10} fill="#4fa54a" />
        <rect x={26} y={38} width={4} height={4} fill="#78c15f" />
        <rect x={34} y={34} width={4} height={4} fill="#78c15f" />
        <rect x={92} y={60} width={4} height={10} fill="#4fa54a" />
        <rect x={88} y={60} width={4} height={4} fill="#78c15f" />
        <rect x={96} y={56} width={4} height={4} fill="#78c15f" />
        <rect x={60} y={104} width={4} height={10} fill="#4fa54a" />
        <rect x={56} y={104} width={4} height={4} fill="#78c15f" />
        <rect x={64} y={100} width={4} height={4} fill="#78c15f" />
      </g>
      <rect x={62} y={62} width={4} height={26} fill="#6b4423" />
      <rect x={46} y={44} width={36} height={22} fill="#f6e7c1" stroke="#3b2a1a" strokeWidth={2} />
      <text x={64} y={61} textAnchor="middle" fontSize={16} fontWeight={700} fill="#3b2a1a">
        ?
      </text>
    </g>
  );
}

function Tractor({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={2} y={8} width={40} height={14} fill="#c0392b" stroke="#3b2a1a" strokeWidth={2} />
      <rect x={24} y={0} width={16} height={10} fill="#e8d5a0" stroke="#3b2a1a" strokeWidth={2} />
      <rect x={-2} y={14} width={12} height={12} fill="#2b2b2b" />
      <rect x={34} y={14} width={12} height={12} fill="#2b2b2b" />
      <rect x={-14} y={10} width={14} height={10} fill="#7a8a99" stroke="#3b2a1a" strokeWidth={2} />
      <g fill="#e9f6fb">
        <rect x={-26} y={14} width={8} height={8} />
        <rect x={-34} y={8} width={6} height={6} />
        <rect x={-36} y={20} width={6} height={6} />
        <rect x={-44} y={14} width={4} height={4} />
      </g>
    </g>
  );
}

function Persona({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={4} y={0} width={12} height={6} fill="#d6a23a" />
      <rect x={6} y={6} width={8} height={8} fill="#e0b48a" />
      <rect x={2} y={14} width={16} height={14} fill="#3f6fb5" />
      <rect x={4} y={28} width={5} height={8} fill="#3b2a1a" />
      <rect x={11} y={28} width={5} height={8} fill="#3b2a1a" />
      <rect x={22} y={8} width={3} height={28} fill="#6b4423" />
      <rect x={20} y={4} width={8} height={6} fill="#9aa3a8" />
    </g>
  );
}
