import "server-only";
import { GEO, type ClaveFinca } from "@/lib/geografia";
import type { AlertaTiempo, VientoDia } from "@/lib/resumen-avisos";

/*
 * Previsión del tiempo de las fincas (Open-Meteo: gratis, sin clave).
 *
 * 1) Granizo y tormentas en los próximos días, por código de tiempo de la OMM:
 *      96 = tormenta con granizo · 99 = tormenta con granizo fuerte · 95 = tormenta
 *    La previsión de granizo es poco precisa más allá de 2-3 días: se avisa como
 *    «posible» y conviene contrastarlo con los avisos de AEMET.
 *
 * 2) Viento para fumigar: con viento el caldo se lo lleva el aire (deriva), no
 *    llega bien al árbol y puede caer donde no debe. Se mira el viento a 10 m de
 *    altura en las horas en que se suele fumigar (HORA_DESDE a HORA_HASTA) y se
 *    marca el día como «no apto» si el viento medio o las rachas pasan del límite.
 *    Los límites están aquí abajo para ajustarlos con Juan Carlos.
 */

const DIAS = 6;
/** horas (de España) en que se suele fumigar */
const HORA_DESDE = 7;
const HORA_HASTA = 13;
/** viento sostenido máximo para fumigar (km/h) */
export const VIENTO_MAX_KMH = 15;
/** rachas máximas para fumigar (km/h) */
export const RACHA_MAX_KMH = 30;

const NOMBRE: Record<ClaveFinca, string> = { corvera: "Corvera", valladolises: "Valladolises", lobosillo: "Lobosillo" };

export type Prevision = { alertas: AlertaTiempo[]; viento: VientoDia[] };

type Respuesta = {
  daily?: { time: string[]; weather_code: (number | null)[] };
  hourly?: { time: string[]; wind_speed_10m: (number | null)[]; wind_gusts_10m: (number | null)[] };
};

export async function previsionFincas(): Promise<Prevision> {
  const claves = Object.keys(GEO) as ClaveFinca[];
  const qs = new URLSearchParams({
    latitude: claves.map((c) => GEO[c].lat.toFixed(4)).join(","),
    longitude: claves.map((c) => GEO[c].lon.toFixed(4)).join(","),
    daily: "weather_code",
    hourly: "wind_speed_10m,wind_gusts_10m",
    wind_speed_unit: "kmh",
    timezone: "Europe/Madrid",
    forecast_days: String(DIAS),
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${qs}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const json = (await res.json()) as Respuesta | Respuesta[];
    const lista = Array.isArray(json) ? json : [json];

    // Granizo y tormentas: fecha → { tipo más grave, fincas }
    const porDia = new Map<string, { grave: 0 | 1 | 2; fincas: Set<string> }>();
    // Viento: finca + fecha → máximos en horas de fumigar
    const viento: VientoDia[] = [];

    lista.forEach((d, i) => {
      const finca = NOMBRE[claves[i]];

      const dias = d.daily?.time ?? [];
      const codigos = d.daily?.weather_code ?? [];
      dias.forEach((fecha, j) => {
        const c = codigos[j];
        const grave = c === 96 || c === 99 ? 2 : c === 95 ? 1 : 0;
        if (!grave) return;
        const actual = porDia.get(fecha) ?? { grave: 0 as const, fincas: new Set<string>() };
        actual.grave = Math.max(actual.grave, grave) as 0 | 1 | 2;
        actual.fincas.add(finca);
        porDia.set(fecha, actual);
      });

      const horas = d.hourly?.time ?? [];
      const velocidad = d.hourly?.wind_speed_10m ?? [];
      const rachas = d.hourly?.wind_gusts_10m ?? [];
      const maximos = new Map<string, { kmh: number; rachas: number }>();
      horas.forEach((t, j) => {
        // t = "2026-11-03T08:00" en hora de España
        const hora = Number(t.slice(11, 13));
        if (hora < HORA_DESDE || hora > HORA_HASTA) return;
        const fecha = t.slice(0, 10);
        const m = maximos.get(fecha) ?? { kmh: 0, rachas: 0 };
        m.kmh = Math.max(m.kmh, velocidad[j] ?? 0);
        m.rachas = Math.max(m.rachas, rachas[j] ?? 0);
        maximos.set(fecha, m);
      });
      for (const [fecha, m] of maximos) {
        viento.push({
          fecha,
          finca,
          kmh: Math.round(m.kmh),
          rachas: Math.round(m.rachas),
          apto: m.kmh < VIENTO_MAX_KMH && m.rachas < RACHA_MAX_KMH,
        });
      }
    });

    const alertas = [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, v]) => ({
        fecha,
        tipo: v.grave === 2 ? ("granizo" as const) : ("tormenta" as const),
        fincas: [...v.fincas],
      }));
    viento.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.finca.localeCompare(b.finca));
    return { alertas, viento };
  } catch (e) {
    // Sin previsión no se bloquea el aviso del resto de cosas
    console.error("[previsión]", e instanceof Error ? e.message : e);
    return { alertas: [], viento: [] };
  }
}
