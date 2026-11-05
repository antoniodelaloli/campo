"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { aMapa, AUMENTO_MAPA, DESPLAZAMIENTO_MAPA, FORMAS, GEO, metrosPorUnidad, type ClaveFinca } from "@/lib/geografia";
import { DibujoCorvera, DibujoLobosillo, DibujoValladolises, Patrones } from "@/components/DibujosFincas";
import { LUGARES, Paisaje, PaisajeSobrio } from "@/components/Paisaje";
import { BotonTiempo } from "@/components/Tiempo";
import { Avioneta } from "@/components/Avioneta";
import { useRouter } from "next/navigation";

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
const ANGULO_3D = 56; // grados (cuanto más, más rasante: como un dron volando bajo)
// Salvapantallas (escritorio): tras 1 minuto sin tocar nada, vuelve a la vista 3D
// con todas las fincas y la avioneta en bucle. Mientras dura, los datos se refrescan solos.
const INACTIVIDAD_MS = 60_000;
const REFRESCO_SALVAPANTALLAS_MS = 10 * 60_000;
const DUR_3D = 700; // ms
/** Distancia de la cámara (perspectiva) y punto de giro, según el alto del mapa. */
const camara = (tam: { w: number; h: number }) => ({ p: tam.h * 1.5, ox: tam.w / 2, oy: tam.h * 0.62 });


// ------------------------------------------------------------------
// Colocación de cada finca
// ------------------------------------------------------------------
type Colocada = FincaEnMapa & {
  k: number; // metros por unidad de dibujo
  tx: number;
  ty: number;
  caja: Caja;
};

/** En el mapa de inicio, algunas fincas enseñan solo un trozo (ver FormaDibujo.inicio). */
function cajaInicio(clave: ClaveFinca) {
  return FORMAS[clave].inicio?.caja ?? FORMAS[clave].caja;
}
function piezasInicio(clave: ClaveFinca): string[] | null {
  const f = FORMAS[clave];
  return f.inicio?.piezas ?? f.piezas ?? (f.contorno ? [f.contorno] : null);
}

function colocar(f: FincaEnMapa): Colocada {
  const geo = GEO[f.clave];
  const forma = FORMAS[f.clave];
  // agrandada para que se vea bien al entrar (ver AUMENTO_MAPA)
  const k = metrosPorUnidad(f.clave, f.areaHa) * AUMENTO_MAPA[f.clave];
  const base = aMapa(geo.e, geo.n);
  const x = base.x + DESPLAZAMIENTO_MAPA[f.clave].x;
  const y = base.y + DESPLAZAMIENTO_MAPA[f.clave].y;
  const tx = x - forma.centro.x * k;
  const ty = y - forma.centro.y * k;
  return {
    ...f,
    k,
    tx,
    ty,
    caja: {
      x0: tx + cajaInicio(f.clave).x * k,
      y0: ty + cajaInicio(f.clave).y * k,
      x1: tx + (cajaInicio(f.clave).x + cajaInicio(f.clave).w) * k,
      y1: ty + (cajaInicio(f.clave).y + cajaInicio(f.clave).h) * k,
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
function margenes(ancho: number, plano = false) {
  return ancho >= 1024
    ? { izq: 350, der: 360, arr: plano ? 120 : 70, aba: 110 } // en plano, sitio arriba para los carteles
    : { izq: 30, der: 70, arr: 110, aba: 150 }; // arriba, sitio para los carteles
}

function encuadrar(caja: Caja, w: number, h: number, plano = false): Vista {
  const m = margenes(w, plano);
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

/**
 * Encuadre de todas las fincas. En escritorio (vista 3D) se acerca más: con el plano
 * inclinado lo de arriba se aleja y encoge, así que sobra sitio para agrandarlas.
 */
const ACERCAR_3D = 0.78;
function encuadrarTodas(caja: Caja, w: number, h: number, plano = false): Vista {
  const v = encuadrar(caja, w, h, plano);
  // en plano (estilo sobrio) no hay perspectiva que compense: tal cual
  if (w < 1024 || plano) return v;
  // las fincas suben un poco: abajo, cerca de la «cámara», se ven más grandes
  return { mpp: limitar(v.mpp * ACERCAR_3D), cx: v.cx, cy: v.cy + h * 0.06 * v.mpp * ACERCAR_3D };
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
  sobrio = false,
}: {
  fincas: FincaEnMapa[];
  actividades: ActividadEnMapa[];
  momento: "dia" | "atardecer" | "noche";
  /** estilo «sobrio» (migración 0022): plano realista, sin 3D, sin cielo ni avioneta */
  sobrio?: boolean;
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
      setPuede3d(mq.matches && !sobrio);
      if (!mq.matches || sobrio) inclinarA(0, false);
    };
    aplicar();
    if (mq.matches && !sobrio) inclinarA(ANGULO_3D, false);
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [inclinarA, sobrio]);

  // ---------- salvapantallas ----------
  const [salvapantallas, setSalvapantallas] = useState(false);
  const router = useRouter();

  // Tamaño del contenedor
  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect;
      const t = { w: width, h: height };
      tamRef.current = t;
      setTam(t);
      if (!tocado.current || !vistaRef.current) ponerVista(encuadrarTodas(cajaTodas, width, height, sobrio));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cajaTodas, ponerVista, sobrio]);

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
    animarA(encuadrarTodas(cajaTodas, t.w, t.h, sobrio));
  };

  const irA = (c: Colocada) => {
    const t = tamRef.current;
    if (!t) return;
    tocado.current = true;
    animarA(encuadrar(unir([c.caja], 40), t.w, t.h, sobrio));
  };

  const centroZoom = (factor: number) => {
    const t = tamRef.current;
    if (t) zoomEn(t.w / 2, t.h / 2, factor, true);
  };

  // Salvapantallas: 1 minuto sin ratón, teclado ni dedos → todas las fincas en 3D.
  // Cualquier movimiento lo quita (el mapa se queda como está; el primer gesto lo aplana).
  useEffect(() => {
    if (!puede3d) return;
    let temporizador: number | undefined;
    const activar = () => {
      const t = tamRef.current;
      tocado.current = false;
      if (t) animarA(encuadrarTodas(cajaTodas, t.w, t.h));
      inclinarA(ANGULO_3D);
      setSalvapantallas(true);
    };
    const reiniciar = () => {
      setSalvapantallas(false);
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(activar, INACTIVIDAD_MS);
    };
    const eventos = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    for (const e of eventos) window.addEventListener(e, reiniciar, { passive: true, capture: true });
    reiniciar();
    return () => {
      window.clearTimeout(temporizador);
      for (const e of eventos) window.removeEventListener(e, reiniciar, { capture: true });
    };
  }, [puede3d, animarA, inclinarA, cajaTodas]);

  // Con el salvapantallas puesto (p. ej. toda la mañana en la oficina), los datos se refrescan solos
  useEffect(() => {
    if (!salvapantallas) return;
    const id = window.setInterval(() => router.refresh(), REFRESCO_SALVAPANTALLAS_MS);
    return () => window.clearInterval(id);
  }, [salvapantallas, router]);

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
  const luz = sobrio ? { color: "transparent", opacidad: 0 } : LUZ[momento];
  const escala = vista ? escalaBonita(vista.mpp) : null;

  return (
    <div
      ref={contRef}
      className={`relative h-full w-full cursor-grab touch-none overflow-hidden outline-none select-none active:cursor-grabbing ${sobrio ? "bg-[#e9ece4]" : "bg-[#cbbb90]"}`}
      role="application"
      aria-label="Mapa de las fincas. Arrastra para moverte, rueda o pellizca para hacer zoom. Teclas: flechas, + y −, 0 para verlas todas."
      tabIndex={0}
      onPointerDown={alPulsar}
      onClickCapture={alClicCaptura}
      onDoubleClick={alDobleClic}
      onKeyDown={alTeclear}
    >
      {/* cielo y sierra al fondo (solo se ven con el mapa inclinado) */}
      {fraccion3d > 0 && <Horizonte opacidad={fraccion3d} yBase={yHorizonte} />}

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
        className={sobrio ? "absolute" : "pixel absolute"}
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
        {sobrio ? <PatronesSobrios /> : <Patrones />}
        {/* paisaje del entorno (apagado, para que destaquen las fincas); en sobrio, campos lisos */}
        {sobrio ? <PaisajeSobrio /> : <Paisaje />}
        {colocadas.map((c) => {
          const detalle = pxPorUnidad(c) >= 0.75;
          if (sobrio) {
            const piezas = piezasInicio(c.clave);
            const caja = cajaInicio(c.clave);
            return (
              <g key={c.id} transform={`translate(${c.tx} ${c.ty}) scale(${c.k})`} className="cursor-pointer" onClick={() => router.push(`/fincas/${c.id}`)}>
                {/* halo blanco: la finca se despega de los campos de alrededor */}
                {piezas?.map((pz) => (
                  <polygon key={`h-${pz}`} points={pz} fill="none" stroke="#ffffff" strokeWidth={7} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                ))}
                {piezas ? (
                  piezas.map((pz, i) => (
                    <polygon
                      key={pz}
                      points={pz}
                      fill={`url(#sobrio-filas-${i % 2})`}
                      stroke="#2e6b4f"
                      strokeWidth={2}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))
                ) : (
                  <rect x={caja.x} y={caja.y} width={caja.w} height={caja.h} fill="url(#sobrio-filas-0)" stroke="#2e6b4f" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                )}
                {actividades
                  .filter((a) => a.fincaId === c.id)
                  .map((a) => {
                    const p = (FORMAS[c.clave].inicio ?? FORMAS[c.clave])[a.tipo];
                    return <circle key={a.id} cx={p.x} cy={p.y} r={6} fill={a.tipo === "tractor" ? "#c98a2a" : "#2e6b4f"} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
                  })}
              </g>
            );
          }
          return (
            // tocar el dibujo de la finca también abre su ficha (en el móvil el cartel puede quedar tapado)
            <g
              key={c.id}
              transform={`translate(${c.tx} ${c.ty}) scale(${c.k})`}
              className="cursor-pointer"
              onClick={() => router.push(`/fincas/${c.id}`)}
            >
              {/* claro alrededor de la finca + sombra, para que resalte sobre el paisaje */}
              {piezasInicio(c.clave) ? (
                <>
                  {/* finca calcada: el claro y la sombra siguen su contorno */}
                  {piezasInicio(c.clave)!.map((pz) => (
                    <polygon key={`s-${pz}`} points={pz} transform="translate(4 8)" fill="#3b2a1a" opacity={0.22} />
                  ))}
                  {piezasInicio(c.clave)!.map((pz) => (
                    <polygon
                      key={`c-${pz}`}
                      points={pz}
                      fill="#e6d7a6"
                      stroke="#fff4d6"
                      strokeWidth={22}
                      strokeLinejoin="round"
                    />
                  ))}
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
              {c.clave === "corvera" && <DibujoCorvera pantano={c.pantano} sectores={c.sectores} detalle={detalle} />}
              {c.clave === "valladolises" && <DibujoValladolises pantano={c.pantano} piscina={c.piscina} detalle={detalle} soloCasa />}
              {c.clave === "lobosillo" && <DibujoLobosillo detalle={detalle} />}
              {actividades
                .filter((a) => a.fincaId === c.id)
                .map((a) => {
                  const p = (FORMAS[c.clave].inicio ?? FORMAS[c.clave])[a.tipo];
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

      {/* bruma hacia el horizonte: funde la sierra con el campo (sin corte brusco) y da profundidad */}
      {fraccion3d > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: fraccion3d,
            background: `linear-gradient(180deg,
              rgba(214,200,168,0) 0px,
              rgba(214,200,168,0) ${Math.max(0, yHorizonte - 70)}px,
              rgba(206,192,156,.92) ${yHorizonte + 4}px,
              rgba(214,204,174,.55) ${yHorizonte + 60}px,
              rgba(226,220,198,.18) ${yHorizonte + 170}px,
              rgba(226,220,198,0) ${yHorizonte + 300}px)`,
          }}
        />
      )}

      {/* luz del momento del día */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: luz.color, opacity: luz.opacidad }}
      />

      {/* avioneta con la lona, por encima de la sierra (solo en vista 3D) */}
      {puede3d && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-[4] overflow-hidden [container-type:inline-size]"
          style={{ height: Math.max(90, yHorizonte) }}
        >
          <Avioneta activa={inclinacion >= ANGULO_3D - 0.5} />
        </div>
      )}

      {/* carteles y bocadillos (tamaño fijo en pantalla) */}
      {vista && tam && (
        <>
          {colocadas.map((c) => {
            const forma = FORMAS[c.clave];
            const p = aPantalla(c.tx + forma.centro.x * c.k, c.ty + (forma.inicio?.arriba ?? forma.arriba) * c.k);
            return (
              <Link
                key={c.id}
                href={`/fincas/${c.id}`}
                draggable={false}
                className={
                  sobrio
                    ? "absolute z-10 flex flex-col rounded-lg border border-[#d3d9cf] bg-white px-3 py-1.5 whitespace-nowrap hover:border-[#2e6b4f]"
                    : "absolute z-10 flex flex-col rounded-[5px] border-4 border-madera-oscura bg-madera-clara px-2.5 pt-1 pb-1.5 whitespace-nowrap shadow-[0_4px_0_#3b2412] hover:brightness-105"
                }
                style={{ left: p.x, top: p.y, transform: "translate(-50%, calc(-100% - 8px))" }}
                aria-label={`Abrir la finca ${c.nombre}: ${c.subtitulo}`}
              >
                {sobrio ? (
                  <>
                    <span className="text-[15px] leading-tight font-bold text-[#1f2a24]">{c.nombre}</span>
                    <span className="text-xs text-[#5b675f]">{c.subtitulo}</span>
                  </>
                ) : (
                  <>
                    <span className="font-pixel text-lg leading-tight font-bold text-[#fff4d6] [text-shadow:0_2px_0_#5a3a1a] sm:text-xl">
                      {c.nombre.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-tinta">{c.subtitulo}</span>
                    {/* piquito que señala la finca */}
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-[10px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-r-4 border-b-4 border-madera-oscura bg-madera-clara"
                    />
                  </>
                )}
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
                    sobrio
                      ? l.tipo === "paraje"
                        ? "text-[12px] tracking-[0.12em] text-[#6b7a6f] uppercase"
                        : "text-xs text-[#7a857d]"
                      : l.tipo === "paraje"
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
                className={
                  sobrio
                    ? "pointer-events-none absolute z-[5] rounded-md border border-[#d3d9cf] bg-white px-2 py-0.5 text-[13px] whitespace-nowrap text-[#1f2a24]"
                    : "burbuja-flota pointer-events-none absolute z-[5] rounded-[3px] border-2 border-tinta bg-white px-2 py-0.5 font-pixel text-[13px] font-semibold whitespace-nowrap text-tinta"
                }
                style={{ left: p.x, top: p.y, transform: "translate(-50%, calc(-100% - 10px))" }}
              >
                {a.texto.length > 32 ? `${a.texto.slice(0, 31)}…` : a.texto}
              </span>
            );
          })}
        </>
      )}

      {/* controles: atajos a cada finca, zoom y escala (la caja no tapa los carteles, solo sus botones) */}
      <div
        className={`pointer-events-none absolute right-3 bottom-3 z-20 flex flex-col items-end gap-2 transition-opacity *:pointer-events-auto duration-700 lg:right-5 lg:bottom-6 ${salvapantallas ? "opacity-30" : ""}`}
      >
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
            <span className="mt-0.5 font-normal text-tinta-suave">Fincas agrandadas · distancias acortadas</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Cielo y Sierra de Carrascoy al fondo (al norte de las fincas), que asoman por
 * encima del plano inclinado. Tres capas de sierra (la lejana más azulada por la
 * distancia), pinos sueltos y un pie de monte que se funde con el campo.
 * `yBase` = altura (px) a la que empieza el mapa inclinado.
 */
function Horizonte({ opacidad, yBase }: { opacidad: number; yBase: number }) {
  const alto = Math.max(60, yBase + 70);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0" style={{ opacity: opacidad, height: alto }}>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#a9c9dc_0%,#c9dbe0_45%,#e8dcc0_100%)]" />
      <svg
        className="pixel absolute inset-x-0 bottom-0 w-full"
        style={{ height: Math.max(40, alto * 0.62) }}
        viewBox="0 0 400 70"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
      >
        {/* sierra lejana: azulada por la distancia */}
        <polygon fill="#a39889" points="0,39 4,37 8,37 12,34 16,34 20,33 24,30 28,30 32,27 36,27 40,24 44,22 48,22 52,22 56,19 60,18 64,18 68,18 72,16 76,15 80,16 84,13 88,15 92,13 96,12 100,11 104,12 108,13 112,10 116,11 120,11 124,10 128,10 132,8 136,8 140,9 144,10 148,10 152,10 156,11 160,11 164,11 168,13 172,14 176,13 180,15 184,15 188,17 192,17 196,16 200,18 204,16 208,17 212,18 216,17 220,18 224,17 228,19 232,20 236,20 240,21 244,20 248,22 252,23 256,24 260,24 264,26 268,27 272,26 276,28 280,26 284,29 288,29 292,30 296,29 300,28 304,28 308,29 312,27 316,29 320,28 324,28 328,28 332,31 336,30 340,31 344,32 348,34 352,33 356,35 360,36 364,38 368,39 372,40 376,39 380,40 384,40 388,43 392,44 396,42 400,42 400,70 0,70" />
        {/* sierra media: la cresta de Carrascoy */}
        <polygon fill="#97704b" points="0,43 4,41 8,41 12,40 16,37 20,35 24,36 28,35 32,35 36,36 40,34 44,34 48,34 52,35 56,32 60,36 64,36 68,37 72,37 76,35 80,35 84,33 88,34 92,31 96,29 100,29 104,27 108,27 112,25 116,24 120,24 124,24 128,25 132,24 136,28 140,28 144,27 148,28 152,29 156,29 160,29 164,32 168,33 172,30 176,30 180,29 184,29 188,30 192,30 196,32 200,30 204,31 208,35 212,34 216,34 220,36 224,35 228,37 232,39 236,39 240,38 244,36 248,36 252,35 256,36 260,35 264,36 268,34 272,34 276,36 280,38 284,38 288,39 292,40 296,40 300,39 304,41 308,42 312,41 316,41 320,42 324,42 328,44 332,45 336,43 340,44 344,44 348,44 352,41 356,41 360,41 364,41 368,41 372,43 376,45 380,45 384,44 388,45 392,47 396,44 400,47 400,70 0,70" />
        {/* lomas cercanas */}
        <polygon fill="#ad8758" points="0,54 4,53 8,52 12,50 16,49 20,51 24,49 28,51 32,52 36,51 40,51 44,53 48,52 52,51 56,50 60,50 64,51 68,50 72,47 76,49 80,48 84,47 88,46 92,46 96,45 100,45 104,49 108,49 112,49 116,51 120,51 124,52 128,52 132,51 136,50 140,50 144,49 148,50 152,48 156,49 160,48 164,50 168,49 172,50 176,51 180,53 184,52 188,54 192,53 196,54 200,54 204,52 208,52 212,51 216,49 220,51 224,48 228,48 232,48 236,47 240,46 244,47 248,48 252,49 256,48 260,50 264,50 268,51 272,53 276,53 280,54 284,55 288,55 292,54 296,54 300,53 304,53 308,53 312,52 316,52 320,51 324,52 328,52 332,52 336,52 340,51 344,52 348,54 352,54 356,52 360,53 364,54 368,54 372,55 376,55 380,57 384,58 388,58 392,56 396,58 400,58 400,70 0,70" />
        <g fill="#5f6b3c" opacity="0.85">
          <rect x="75" y="45" width="1.5" height="2" />
          <rect x="72" y="53" width="1.5" height="2" />
          <rect x="114" y="33" width="1.5" height="2" />
          <rect x="205" y="64" width="1.5" height="2" />
          <rect x="85" y="49" width="1.5" height="2" />
          <rect x="84" y="62" width="1.5" height="2" />
          <rect x="265" y="50" width="1.5" height="2" />
          <rect x="175" y="58" width="1.5" height="2" />
          <rect x="102" y="53" width="1.5" height="2" />
          <rect x="165" y="39" width="1.5" height="2" />
          <rect x="371" y="56" width="1.5" height="2" />
          <rect x="11" y="52" width="1.5" height="2" />
          <rect x="285" y="54" width="1.5" height="2" />
          <rect x="227" y="61" width="1.5" height="2" />
          <rect x="11" y="54" width="1.5" height="2" />
          <rect x="171" y="65" width="1.5" height="2" />
          <rect x="321" y="53" width="1.5" height="2" />
          <rect x="264" y="40" width="1.5" height="2" />
          <rect x="59" y="63" width="1.5" height="2" />
          <rect x="119" y="32" width="1.5" height="2" />
          <rect x="45" y="44" width="1.5" height="2" />
          <rect x="141" y="32" width="1.5" height="2" />
          <rect x="94" y="50" width="1.5" height="2" />
          <rect x="388" y="51" width="1.5" height="2" />
          <rect x="218" y="63" width="1.5" height="2" />
          <rect x="348" y="54" width="1.5" height="2" />
          <rect x="209" y="41" width="1.5" height="2" />
          <rect x="276" y="54" width="1.5" height="2" />
          <rect x="294" y="57" width="1.5" height="2" />
          <rect x="360" y="53" width="1.5" height="2" />
          <rect x="47" y="44" width="1.5" height="2" />
          <rect x="31" y="62" width="1.5" height="2" />
          <rect x="354" y="48" width="1.5" height="2" />
          <rect x="219" y="66" width="1.5" height="2" />
          <rect x="39" y="44" width="1.5" height="2" />
          <rect x="10" y="63" width="1.5" height="2" />
          <rect x="47" y="61" width="1.5" height="2" />
          <rect x="135" y="35" width="1.5" height="2" />
          <rect x="313" y="50" width="1.5" height="2" />
          <rect x="36" y="46" width="1.5" height="2" />
          <rect x="64" y="52" width="1.5" height="2" />
          <rect x="7" y="53" width="1.5" height="2" />
          <rect x="285" y="53" width="1.5" height="2" />
          <rect x="139" y="38" width="1.5" height="2" />
          <rect x="24" y="54" width="1.5" height="2" />
          <rect x="365" y="50" width="1.5" height="2" />
          <rect x="58" y="44" width="1.5" height="2" />
          <rect x="136" y="33" width="1.5" height="2" />
          <rect x="94" y="45" width="1.5" height="2" />
          <rect x="161" y="50" width="1.5" height="2" />
          <rect x="273" y="60" width="1.5" height="2" />
          <rect x="107" y="47" width="1.5" height="2" />
          <rect x="230" y="55" width="1.5" height="2" />
          <rect x="346" y="51" width="1.5" height="2" />
          <rect x="140" y="52" width="1.5" height="2" />
          <rect x="11" y="50" width="1.5" height="2" />
          <rect x="20" y="37" width="1.5" height="2" />
          <rect x="11" y="65" width="1.5" height="2" />
          <rect x="260" y="54" width="1.5" height="2" />
          <rect x="99" y="63" width="1.5" height="2" />
          <rect x="245" y="45" width="1.5" height="2" />
          <rect x="230" y="42" width="1.5" height="2" />
          <rect x="339" y="66" width="1.5" height="2" />
          <rect x="223" y="58" width="1.5" height="2" />
          <rect x="255" y="55" width="1.5" height="2" />
          <rect x="203" y="65" width="1.5" height="2" />
          <rect x="159" y="44" width="1.5" height="2" />
          <rect x="119" y="47" width="1.5" height="2" />
          <rect x="103" y="37" width="1.5" height="2" />
          <rect x="209" y="48" width="1.5" height="2" />
        </g>
        {/* pie de monte: se funde con el color del campo */}
        <rect x="0" y="62" width="400" height="8" fill="#bba67a" />
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
// Estilo sobrio: campos lisos y filas de árboles (como el boceto realista)
// ------------------------------------------------------------------
function PatronesSobrios() {
  return (
    <defs>
      <pattern id="sobrio-filas-0" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
        <rect width="6" height="6" fill="#8fbf86" />
        <rect width="2.2" height="6" fill="#3f7a55" opacity="0.55" />
      </pattern>
      <pattern id="sobrio-filas-1" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
        <rect width="6" height="6" fill="#8fbf86" />
        <rect width="2.2" height="6" fill="#3f7a55" opacity="0.55" />
      </pattern>
    </defs>
  );
}

// ------------------------------------------------------------------
// Dibujos (pixel art)
// ------------------------------------------------------------------
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
