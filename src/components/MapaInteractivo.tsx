"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  aMapa,
  FORMAS,
  GEO,
  metrosPorUnidad,
  SECTORES_CORVERA,
  type ClaveFinca,
} from "@/lib/geografia";
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

/*
 * Vista «de dron» (solo escritorio): al entrar, el plano del mapa se inclina como
 * el 3D de Google Maps, con cielo y sierra al fondo. Los carteles y bocadillos no
 * se deforman: se colocan donde cae su punto en el plano inclinado.
 * Al tocar el mapa (arrastrar, rueda, teclas) se aplana con una animación corta;
 * el botón «3D» la vuelve a poner.
 */
const ANGULO_3D = 40; // grados
const DUR_3D = 700; // ms
/** Distancia de la cámara (perspectiva) y punto de giro, según el alto del mapa. */
const camara = (tam: { w: number; h: number }) => ({ p: tam.h * 1.7, ox: tam.w / 2, oy: tam.h * 0.62 });


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

  // ---------- vista inclinada (3D) ----------
  const [inclinacion, setInclinacion] = useState(0);
  const inclinacionRef = useRef(0);
  const animInclinar = useRef<number | null>(null);
  const [puede3d, setPuede3d] = useState(false);

  const inclinarA = useCallback((destino: number, animado = true) => {
    if (animInclinar.current != null) cancelAnimationFrame(animInclinar.current);
    const origen = inclinacionRef.current;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animado || quieto || origen === destino) {
      inclinacionRef.current = destino;
      setInclinacion(destino);
      return;
    }
    const t0 = performance.now();
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / DUR_3D);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const v = origen + (destino - origen) * e;
      inclinacionRef.current = v;
      setInclinacion(v);
      animInclinar.current = p < 1 ? requestAnimationFrame(paso) : null;
    };
    animInclinar.current = requestAnimationFrame(paso);
  }, []);

  /** Al primer gesto sobre el mapa, se aplana (las cuentas de zoom y arrastre son en plano). */
  const aplanar = useCallback(() => {
    if (inclinacionRef.current > 0 && animInclinar.current == null) inclinarA(0);
  }, [inclinarA]);

  // Al entrar en escritorio, el mapa empieza inclinado (sin parpadeo en plano)
  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const aplicar = () => {
      setPuede3d(mq.matches);
      if (!mq.matches) inclinarA(0, false);
    };
    aplicar();
    if (mq.matches) inclinarA(ANGULO_3D, false);
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [inclinarA]);

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
      aplanar();
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
      aplanar();
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
  }, [zoomEn, aplanar]);

  // Arrastre con ratón o dedos (uno = mover, dos = pellizcar)
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const recorrido = useRef(0);
  const pinza = useRef<{ dist: number; mx: number; my: number } | null>(null);

  const alPulsar = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // los botones y carteles de encima no aplanan el mapa
    if (!(e.target as HTMLElement).closest("a,button")) aplanar();
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
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"].includes(e.key)) aplanar();
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
  const rad = (inclinacion * Math.PI) / 180;
  const cam = tam ? camara(tam) : null;
  /** Punto del plano (en px de pantalla sin inclinar) → donde se ve con la inclinación. */
  const inclinar = (px: number, py: number) => {
    if (!cam || inclinacion === 0) return { x: px, y: py };
    const dy = py - cam.oy;
    const z = dy * Math.sin(rad); // negativo = más lejos
    const k = cam.p / (cam.p - z);
    return { x: cam.ox + (px - cam.ox) * k, y: cam.oy + dy * Math.cos(rad) * k };
  };
  const aPantalla = (x: number, y: number) => {
    if (!vista || !tam) return { x: 0, y: 0 };
    return inclinar((x - vista.cx) / vista.mpp + tam.w / 2, (y - vista.cy) / vista.mpp + tam.h / 2);
  };
  const fraccion3d = inclinacion / ANGULO_3D; // 0 = plano, 1 = vista de dron
  /** Altura (px) donde acaba el plano inclinado: por encima solo hay cielo. */
  const yHorizonte = inclinar(0, 0).y;

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
      {/* cielo y sierra al fondo (solo se ven con el mapa inclinado) */}
      {fraccion3d > 0 && <Horizonte opacidad={fraccion3d} />}

      {/* plano del mapa: se inclina entero, como una mesa vista desde un dron */}
      <div
        className="absolute inset-0"
        style={
          cam && inclinacion > 0
            ? {
                transform: `perspective(${cam.p}px) rotateX(${inclinacion}deg)`,
                transformOrigin: `${cam.ox}px ${cam.oy}px`,
                willChange: "transform",
                // se corta por arriba en el borde del mapa: por encima queda el horizonte
                clipPath: "polygon(-60% 0, 160% 0, 160% 160%, -60% 160%)",
              }
            : undefined
        }
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
              {FORMAS[c.clave].contorno ? (
                <>
                  {/* finca calcada: el claro y la sombra siguen su contorno */}
                  <polygon
                    points={FORMAS[c.clave].contorno}
                    transform="translate(4 8)"
                    fill="#3b2a1a"
                    opacity={0.22}
                  />
                  <polygon
                    points={FORMAS[c.clave].contorno}
                    fill="#e6d7a6"
                    stroke="#fff4d6"
                    strokeWidth={22}
                    strokeLinejoin="round"
                  />
                </>
              ) : (
                <>
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
                </>
              )}
              {c.clave === "corvera" && <DibujoCorvera f={c} detalle={detalle} />}
              {c.clave === "valladolises" && <DibujoValladolises f={c} detalle={detalle} />}
              {c.clave === "lobosillo" && <DibujoLobosillo detalle={detalle} />}
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
      </div>

      {/* bruma hacia el horizonte (da profundidad a la vista inclinada) */}
      {fraccion3d > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: fraccion3d,
            background: "linear-gradient(180deg, rgba(226,232,226,.9) 0%, rgba(232,226,206,.55) 18%, rgba(232,226,206,0) 42%)",
          }}
        />
      )}

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
                className="absolute z-10 flex flex-col rounded-[5px] border-4 border-madera-oscura bg-madera-clara px-2.5 pt-1 pb-1.5 whitespace-nowrap shadow-[0_4px_0_#3b2412] hover:brightness-105"
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
              if (p.x < -200 || p.y < Math.max(-50, yHorizonte + 12) || p.x > tam.w + 200 || p.y > tam.h + 50) return null;
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
                className="burbuja-flota pointer-events-none absolute z-[5] rounded-[3px] border-2 border-tinta bg-white px-2 py-0.5 font-pixel text-[13px] font-semibold whitespace-nowrap text-tinta"
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
        <div className="flex items-center gap-2">
          {puede3d && (
            <button
              type="button"
              onClick={() => inclinarA(inclinacion > ANGULO_3D / 2 ? 0 : ANGULO_3D)}
              aria-pressed={inclinacion > ANGULO_3D / 2}
              title={inclinacion > ANGULO_3D / 2 ? "Ver el mapa en plano" : "Ver el mapa inclinado, como desde un dron"}
              className="rounded-[4px] border-[3px] border-madera-oscura bg-pergamino px-2.5 py-1 font-pixel text-sm text-tinta shadow-[0_3px_0_#3b2412] hover:bg-sol aria-pressed:bg-sol"
            >
              {inclinacion > ANGULO_3D / 2 ? "Vista 2D" : "Vista 3D"}
            </button>
          )}
          <BotonTiempo puntos={puntosTiempo} />
        </div>
        <div className="flex items-end gap-2">
          <div className="hidden flex-col items-end gap-1 sm:flex">
            {colocadas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => irA(c)}
                className="rounded-[3px] border-2 border-madera-oscura bg-pergamino px-2 py-0.5 font-pixel text-xs font-bold whitespace-nowrap text-tinta hover:bg-sol"
              >
                Ir a {c.nombre}
              </button>
            ))}
          </div>
          <div className="flex flex-col overflow-hidden rounded-[4px] border-[3px] border-madera-oscura bg-pergamino shadow-[0_3px_0_#3b2412]">
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
          <div className="flex flex-col items-end rounded-[3px] bg-pergamino/85 px-1.5 py-0.5 text-[11px] font-bold text-tinta">
            <span>{escala >= 1000 ? `${escala / 1000} km` : `${escala} m`}</span>
            <span className="h-1.5 border-x-2 border-b-2 border-tinta" style={{ width: escala / vista.mpp }} />
            <span className="mt-0.5 font-normal text-tinta-suave">Fincas a tamaño real · distancias acortadas</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Cielo y silueta de la Sierra de Carrascoy al fondo (al norte de las fincas),
 * que asoman por encima del plano inclinado. Estilo pixel, apagado.
 */
function Horizonte({ opacidad }: { opacidad: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[26%]" style={{ opacity: opacidad }}>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#bcd6df_0%,#d9e4dc_55%,#e6e0c9_100%)]" />
      <svg className="pixel absolute inset-x-0 bottom-0 h-[70%] w-full" viewBox="0 0 400 60" preserveAspectRatio="none">
        <polygon
          fill="#a9b2a0"
          points="0,60 0,40 18,36 30,30 44,32 58,24 72,26 86,18 98,22 112,16 126,20 140,14 156,22 170,20 186,28 200,24 216,30 232,26 248,32 262,28 280,34 296,30 312,36 330,32 346,38 362,34 380,40 400,38 400,60"
        />
        <polygon
          fill="#bcc3ad"
          points="0,60 0,48 24,44 40,40 60,44 80,38 100,42 124,36 146,42 168,38 190,44 214,40 236,46 258,42 282,48 306,44 330,48 356,46 380,50 400,48 400,60"
        />
      </svg>
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
  // Calcada de la vista aérea: contorno real, filas en diagonal (unos 33° hacia el noreste),
  // caminos interiores y el pantano con su caseta.
  const contorno = FORMAS.corvera.contorno!;
  return (
    <g>
      <defs>
        <pattern id="u-limonero-diag" href="#u-limonero" patternTransform="rotate(-33)" />
        <clipPath id="recorte-corvera">
          <polygon points={contorno} />
        </clipPath>
      </defs>
      <polygon points={contorno} fill="#7a5230" stroke="#7a5230" strokeWidth={8} strokeLinejoin="round" />
      <polygon points={contorno} fill="url(#u-limonero-diag)" />
      {/* caminos interiores */}
      <g clipPath="url(#recorte-corvera)" stroke="#e0bd80" strokeWidth={7} strokeLinecap="square">
        <line x1={20} y1={279} x2={352} y2={65} />
        <line x1={55} y1={322} x2={370} y2={121} />
        <line x1={79} y1={178} x2={113} y2={220} />
        <line x1={235} y1={62} x2={273} y2={108} />
        <line x1={167} y1={230} x2={199} y2={278} />
      </g>
      {/* pantano */}
      <polygon points="214,224 243,207 274,247 244,267" fill="#8b6b3d" stroke="#8b6b3d" strokeWidth={6} strokeLinejoin="round" />
      <polygon points="217,225 242,211 270,247 244,263" fill="#4aa3d9" />
      <line x1={228} y1={226} x2={240} y2={219} stroke="#8fd0f2" strokeWidth={3} />
      <line x1={238} y1={238} x2={248} y2={232} stroke="#8fd0f2" strokeWidth={3} />
      {/* caseta del cabezal, junto al pantano */}
      <g transform="translate(240,196)">
        <rect x={0} y={5} width={15} height={11} fill="#d9c49a" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={-2} y={0} width={19} height={6} fill="#c0563a" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={6} y={10} width={4} height={6} fill="#6b4423" />
      </g>
      {detalle && f.pantano && <Etiqueta x={262} y={292} texto={`Pantano ~${f.pantano} m³`} />}
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
    </g>
  );
}

function DibujoValladolises({ f, detalle }: { f: FincaEnMapa; detalle: boolean }) {
  // Solo el trozo de la casa, la caseta y el pantano, calcado de la vista aérea.
  // El resto de la finca (todas sus zonas) va en su propio módulo.
  const contorno = FORMAS.valladolises.contorno!;
  return (
    <g>
      <defs>
        <pattern id="u-limonero-vall" href="#u-limonero" patternTransform="rotate(-42)" />
      </defs>
      <polygon points={contorno} fill="#7a5230" stroke="#7a5230" strokeWidth={8} strokeLinejoin="round" />
      <polygon points={contorno} fill="url(#u-limonero-vall)" />

      {/* claro de la casa: tierra y jardín */}
      <polygon points="118,88 150,74 220,122 206,152 160,170 136,160 112,124" fill="#d8c08a" />
      <polygon points="136,150 150,140 166,158 152,168" fill="#3f7a4a" />
      <polygon points="152,138 160,132 172,146 164,152" fill="#3f7a4a" />

      {/* pista de tenis con su valla */}
      <polygon points="164,116 177,100 211,127 198,144" fill="#8fbf8a" stroke="#f3f3f3" strokeWidth={2} />
      <polygon points="174,114 182,108 202,125 194,135" fill="#c97b7b" stroke="#ffffff" strokeWidth={1.2} />
      <line x1={192} y1={116.5} x2={184} y2={124.5} stroke="#ffffff" strokeWidth={1.5} />
      <line x1={178} y1={111} x2={198} y2={130} stroke="#ffffff" strokeWidth={0.6} />

      {/* piscina */}
      <polygon points="156,128 164,121 173,130 165,137" fill="#f3f3f3" stroke="#3b2a1a" strokeWidth={1} />
      <polygon points="158,128 164,123 171,130 165,135" fill="#4ac0e8" />
      {f.piscina && (
        <g>
          <circle cx={152} cy={124} r={7} fill="#c8473a" stroke="#ffffff" strokeWidth={1.5} />
          <text x={152} y={128} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ffffff">
            !
          </text>
        </g>
      )}

      {/* árboles grandes junto a la casa */}
      <g fill="#2f5a2c" stroke="#1f3d1d" strokeWidth={1}>
        <rect x={106} y={94} width={12} height={12} rx={5} />
        <rect x={110} y={108} width={13} height={13} rx={5} />
        <rect x={120} y={120} width={11} height={11} rx={5} />
      </g>

      {/* casa */}
      <g transform="translate(130,96)">
        <rect x={0} y={8} width={24} height={16} fill="#f3e6c8" stroke="#3b2a1a" strokeWidth={1.5} />
        <polygon points="-3,9 12,0 27,9" fill="#c0563a" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={10} y={15} width={5} height={9} fill="#6b4423" />
        <rect x={3} y={12} width={4} height={4} fill="#8fd0f2" />
        <rect x={17} y={12} width={4} height={4} fill="#8fd0f2" />
      </g>

      {/* pantano */}
      <polygon points="56,272 101,243 180,321 130,366" fill="#8b6b3d" stroke="#8b6b3d" strokeWidth={6} strokeLinejoin="round" />
      <polygon points="59,273 101,247 176,321 130,362" fill="#4aa3d9" />
      <line x1={80} y1={272} x2={98} y2={261} stroke="#8fd0f2" strokeWidth={3} />
      <line x1={104} y1={296} x2={120} y2={286} stroke="#8fd0f2" strokeWidth={3} />

      {/* caseta, junto al pantano */}
      <g transform="translate(52,249)">
        <rect x={0} y={4} width={14} height={10} fill="#e9e9e2" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={-2} y={0} width={18} height={5} fill="#cfcfc6" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={5} y={8} width={4} height={6} fill="#6b4423" />
      </g>

      {detalle && (
        <>
          <Etiqueta x={146} y={64} texto="La Casa" />
          <Etiqueta x={210} y={168} texto="Pista de tenis" />
          {f.pantano && <Etiqueta x={118} y={392} texto={`Pantano ~${f.pantano} m³`} />}
        </>
      )}
    </g>
  );
}

function DibujoLobosillo({ detalle }: { detalle: boolean }) {
  // Calcada de la vista aérea: filas de árboles casi de norte a sur, balsa con su caseta,
  // casa y pista de fútbol abajo.
  const contorno = FORMAS.lobosillo.contorno!;
  return (
    <g>
      <defs>
        <pattern id="u-arbol-lobosillo" href="#u-arbol" patternTransform="rotate(68)" />
      </defs>
      <polygon points={contorno} fill="#7a5230" stroke="#7a5230" strokeWidth={8} strokeLinejoin="round" />
      <polygon points={contorno} fill="url(#u-arbol-lobosillo)" />

      {/* explanada de abajo: tierra y hormigón */}
      <polygon points="104,274 200,250 300,262 304,310 288,318 256,332 224,338 184,342 152,342 136,332 126,318 116,294" fill="#d8c08a" />
      <polygon points="144,298 220,286 228,336 152,342" fill="#cfcac0" />

      {/* balsa con su talud */}
      <polygon points="202,228 256,215 274,268 216,284" fill="#e9dcc0" stroke="#b9a57a" strokeWidth={2} />
      <polygon points="209,233 251,222 267,265 220,277" fill="#3f5566" />
      <line x1={220} y1={244} x2={244} y2={238} stroke="#6f8797" strokeWidth={2} />

      {/* caseta junto a la balsa */}
      <g transform="translate(246,202)">
        <rect x={0} y={4} width={12} height={10} fill="#e9e9e2" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={-2} y={0} width={16} height={5} fill="#9a9a92" stroke="#3b2a1a" strokeWidth={1.5} />
      </g>

      {/* pista de fútbol */}
      <polygon points="220,284 298,273 305,312 229,334" fill="#2f6b43" stroke="#ffffff" strokeWidth={1.5} />
      <line x1={259} y1={278.5} x2={267} y2={323} stroke="#ffffff" strokeWidth={1.2} />
      <circle cx={263} cy={301} r={6} fill="none" stroke="#ffffff" strokeWidth={1.2} />
      <polygon points="222,296 232,294 236,316 226,319" fill="none" stroke="#ffffff" strokeWidth={1} />
      <polygon points="290,282 299,280 303,301 294,303" fill="none" stroke="#ffffff" strokeWidth={1} />

      {/* casa */}
      <g transform="translate(122,304)">
        <rect x={0} y={7} width={20} height={14} fill="#f3e6c8" stroke="#3b2a1a" strokeWidth={1.5} />
        <polygon points="-3,8 10,0 23,8" fill="#9a9a92" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={8} y={13} width={5} height={8} fill="#6b4423" />
      </g>

      {detalle && (
        <>
          <Etiqueta x={262} y={350} texto="Pista de fútbol" />
          <Etiqueta x={240} y={200} texto="Balsa" />
        </>
      )}
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
