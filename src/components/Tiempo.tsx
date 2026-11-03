"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
 * «Ver tiempo»: tiempo actual y próximos días de cada finca, con datos de Open-Meteo
 * (gratis, sin clave, licencia CC BY 4.0). Se pide a /api/tiempo al abrir la ventana: el
 * servidor consulta Open-Meteo y guarda la respuesta 15 minutos.
 */

export type PuntoTiempo = { id: string; nombre: string; lat: number; lon: number };

type Actual = {
  temperature_2m: number;
  relative_humidity_2m: number;
  precipitation: number;
  wind_speed_10m: number;
  wind_gusts_10m: number;
  weather_code: number;
};

type Diario = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  wind_gusts_10m_max: number[];
};

type DatosFinca = { current: Actual; daily: Diario };

const CACHE_MS = 15 * 60 * 1000;

// Códigos WMO → texto e icono
function describir(codigo: number): { texto: string; icono: "sol" | "nubes" | "lluvia" | "tormenta" | "niebla" | "nieve" } {
  if (codigo === 0) return { texto: "Despejado", icono: "sol" };
  if (codigo <= 2) return { texto: "Poco nuboso", icono: "nubes" };
  if (codigo === 3) return { texto: "Nublado", icono: "nubes" };
  if (codigo === 45 || codigo === 48) return { texto: "Niebla", icono: "niebla" };
  if (codigo >= 51 && codigo <= 57) return { texto: "Llovizna", icono: "lluvia" };
  if (codigo >= 61 && codigo <= 67) return { texto: "Lluvia", icono: "lluvia" };
  if (codigo >= 71 && codigo <= 77) return { texto: "Nieve", icono: "nieve" };
  if (codigo >= 80 && codigo <= 82) return { texto: "Chubascos", icono: "lluvia" };
  if (codigo >= 85 && codigo <= 86) return { texto: "Chubascos de nieve", icono: "nieve" };
  if (codigo >= 95) return { texto: "Tormenta", icono: "tormenta" };
  return { texto: "—", icono: "nubes" };
}

function Icono({ tipo, tam = 40 }: { tipo: ReturnType<typeof describir>["icono"]; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 16 16" className="pixel" aria-hidden="true">
      {tipo === "sol" && (
        <g fill="#f6d743" stroke="#b07a1a" strokeWidth={0.6}>
          <rect x="5" y="5" width="6" height="6" />
          <rect x="7.25" y="1" width="1.5" height="2.5" />
          <rect x="7.25" y="12.5" width="1.5" height="2.5" />
          <rect x="1" y="7.25" width="2.5" height="1.5" />
          <rect x="12.5" y="7.25" width="2.5" height="1.5" />
        </g>
      )}
      {(tipo === "nubes" || tipo === "lluvia" || tipo === "tormenta" || tipo === "nieve") && (
        <g>
          {tipo === "nubes" && <rect x="9" y="2" width="5" height="5" fill="#f6d743" stroke="#b07a1a" strokeWidth={0.6} />}
          <rect x="2" y="6" width="12" height="5" fill="#e8e6de" stroke="#7a7a80" strokeWidth={0.6} />
          <rect x="4" y="4" width="6" height="3" fill="#e8e6de" stroke="#7a7a80" strokeWidth={0.6} />
          <rect x="4.3" y="6" width="5.4" height="1" fill="#e8e6de" />
        </g>
      )}
      {tipo === "lluvia" && (
        <g fill="#2f7fb0">
          <rect x="4" y="12" width="1" height="2.5" />
          <rect x="7.5" y="12.5" width="1" height="2.5" />
          <rect x="11" y="12" width="1" height="2.5" />
        </g>
      )}
      {tipo === "tormenta" && <polygon points="8,11 6,14 8,14 7,16 10,12.5 8,12.5 9,11" fill="#f6d743" stroke="#b07a1a" strokeWidth={0.4} />}
      {tipo === "nieve" && (
        <g fill="#ffffff" stroke="#7fb8d8" strokeWidth={0.4}>
          <rect x="4" y="12.5" width="1.5" height="1.5" />
          <rect x="8" y="13" width="1.5" height="1.5" />
          <rect x="11" y="12.5" width="1.5" height="1.5" />
        </g>
      )}
      {tipo === "niebla" && (
        <g fill="#c9c5b8">
          <rect x="2" y="4" width="12" height="1.5" />
          <rect x="1" y="7.5" width="14" height="1.5" />
          <rect x="3" y="11" width="11" height="1.5" />
        </g>
      )}
    </svg>
  );
}

const NOMBRE_DIA = new Intl.DateTimeFormat("es-ES", { weekday: "short", timeZone: "UTC" });
function etiquetaDia(iso: string, i: number) {
  if (i === 0) return "Hoy";
  if (i === 1) return "Mañana";
  const [y, m, d] = iso.split("-").map(Number);
  const t = NOMBRE_DIA.format(new Date(Date.UTC(y, m - 1, d))).replace(".", "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const r = (n: number) => Math.round(n);

export function BotonTiempo({ puntos }: { puntos: PuntoTiempo[] }) {
  const [abierto, setAbierto] = useState(false);
  const [sel, setSel] = useState(0);
  const [datos, setDatos] = useState<DatosFinca[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const pedidoEn = useRef(0);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  const cargar = useCallback(async () => {
    if (datos && Date.now() - pedidoEn.current < CACHE_MS) return;
    setCargando(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        lat: puntos.map((p) => p.lat).join(","),
        lon: puntos.map((p) => p.lon).join(","),
      });
      // se pide a nuestro servidor, que consulta Open-Meteo y guarda la respuesta 15 min
      const res = await fetch(`/api/tiempo?${qs}`, { headers: { Accept: "application/json" } });
      const tipo = res.headers.get("content-type") ?? "";
      if (!tipo.includes("application/json")) {
        throw new Error(res.redirected ? "la sesión ha caducado, vuelve a entrar" : `respuesta inesperada (${res.status})`);
      }
      const json = (await res.json()) as { datos?: DatosFinca[]; error?: string };
      if (!res.ok || !json.datos) throw new Error(json.error ?? `error ${res.status}`);
      setDatos(json.datos);
      pedidoEn.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar el tiempo");
    } finally {
      setCargando(false);
    }
  }, [datos, puntos]);

  const abrir = () => {
    setAbierto(true);
    void cargar();
  };
  const cerrar = useCallback(() => {
    setAbierto(false);
    botonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (abierto) cerrarRef.current?.focus();
  }, [abierto]);

  const d = datos?.[sel];
  const actual = d ? describir(d.current.weather_code) : null;

  const modal = abierto ? (
    <div
      className="fixed inset-0 z-[2147483100] flex items-end justify-center bg-[#1b2414]/55 p-0 sm:items-center sm:p-4"
      // que los gestos dentro de la ventana no muevan el mapa de detrás
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) cerrar();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // las teclas no llegan al mapa (flechas, +, −), pero Escape cierra
        e.stopPropagation();
        if (e.key === "Escape") cerrar();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-tiempo"
        className="panel flex max-h-[92dvh] w-full max-w-[560px] flex-col gap-3 overflow-y-auto p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-tiempo" className="titulo-pixel text-2xl">
            El tiempo en las fincas
          </h2>
          <button
            ref={cerrarRef}
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border-[3px] border-madera-oscura bg-madera-clara text-pergamino"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>

        <div role="tablist" aria-label="Finca" className="flex gap-1.5">
          {puntos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={sel === i}
              onClick={() => setSel(i)}
              className="pestana flex-1 px-2!"
            >
              {p.nombre}
            </button>
          ))}
        </div>

        {cargando && !d && <p className="titulo-pixel animate-pulse py-8 text-center text-lg text-tinta-suave">Mirando el cielo…</p>}
        {error && (
          <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
            No se pudo consultar el tiempo: {error}.{" "}
            <button type="button" className="font-bold underline" onClick={() => void cargar()}>
              Reintentar
            </button>
          </p>
        )}

        {d && actual && (
          <>
            {/* ahora */}
            <div className="ficha flex items-center gap-4 p-3">
              <Icono tipo={actual.icono} tam={56} />
              <div className="flex flex-1 flex-col">
                <span className="titulo-pixel text-4xl">{r(d.current.temperature_2m)}°</span>
                <span className="text-sm font-bold">{actual.texto}</span>
              </div>
              <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-sm">
                <dt className="text-tinta-suave">Viento</dt>
                <dd className="text-right font-bold">{r(d.current.wind_speed_10m)} km/h</dd>
                <dt className="text-tinta-suave">Rachas</dt>
                <dd className={`text-right font-bold ${d.current.wind_gusts_10m >= 30 ? "text-[#7d1a10]" : ""}`}>
                  {r(d.current.wind_gusts_10m)} km/h
                </dd>
                <dt className="text-tinta-suave">Humedad</dt>
                <dd className="text-right font-bold">{r(d.current.relative_humidity_2m)} %</dd>
                <dt className="text-tinta-suave">Lluvia</dt>
                <dd className="text-right font-bold">{d.current.precipitation.toLocaleString("es-ES")} mm</dd>
              </dl>
            </div>
            {d.current.wind_gusts_10m >= 30 && (
              <p className="border-2 border-alerta bg-[#fdebd0] px-3 py-1.5 text-[13px] font-semibold">
                Rachas de viento fuertes ahora mismo ({r(d.current.wind_gusts_10m)} km/h).
              </p>
            )}

            {/* próximos días */}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {d.daily.time.map((dia, i) => {
                const info = describir(d.daily.weather_code[i]);
                return (
                  <li key={dia} className="ficha flex flex-col items-center gap-1 px-2 py-2 text-center">
                    <span className="font-pixel text-sm font-bold">{etiquetaDia(dia, i)}</span>
                    <Icono tipo={info.icono} tam={32} />
                    <span className="text-sm font-bold">
                      {r(d.daily.temperature_2m_max[i])}° <span className="font-normal text-tinta-suave">/ {r(d.daily.temperature_2m_min[i])}°</span>
                    </span>
                    <span className="text-xs text-tinta-suave">
                      Lluvia {d.daily.precipitation_probability_max[i] ?? 0} %
                      {d.daily.precipitation_sum[i] > 0 ? ` · ${d.daily.precipitation_sum[i].toLocaleString("es-ES")} mm` : ""}
                    </span>
                    <span className={`text-xs ${d.daily.wind_gusts_10m_max[i] >= 30 ? "font-bold text-[#7d1a10]" : "text-tinta-suave"}`}>
                      Rachas {r(d.daily.wind_gusts_10m_max[i])} km/h
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <p className="text-xs text-tinta-suave">
          Previsión de{" "}
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline">
            Open-Meteo.com
          </a>{" "}
          (CC BY 4.0) para el punto de cada finca. Se actualiza cada 15 minutos.
        </p>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={abrir}
        aria-label="Ver tiempo"
        title="Ver tiempo"
        className="flex items-center gap-1.5 rounded-[4px] border-[3px] border-madera-oscura bg-pergamino px-2.5 py-1 font-pixel text-sm font-bold text-tinta shadow-[0_3px_0_#3b2412] hover:bg-sol"
      >
        <Icono tipo="nubes" tam={20} />
        {/* en el móvil solo el icono, para no tapar los carteles de las fincas */}
        <span className="hidden sm:inline">Ver tiempo</span>
      </button>
      {modal && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </>
  );
}
