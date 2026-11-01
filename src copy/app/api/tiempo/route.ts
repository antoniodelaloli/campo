import { cacheLife } from "next/cache";
import { connection } from "next/server";

/*
 * GET /api/tiempo?lat=37.81,37.77&lon=-1.14,-1.10
 *
 * Pide la previsión a Open-Meteo desde el servidor (no desde el navegador), así no la
 * bloquean extensiones ni cortafuegos del navegador, y se guarda 15 minutos para todos.
 * Solo responde a usuarios con sesión (el proxy redirige al resto a /login).
 */

const ACTUAL = "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code";
const DIARIO =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max";
const MAX_PUNTOS = 6;

// Solo coordenadas de la Región de Murcia y alrededores: no es un proxy abierto.
const dentro = (lat: number, lon: number) => lat > 37 && lat < 39 && lon > -2.6 && lon < -0.5;

function leerCoordenadas(url: URL): { lat: string; lon: string } | null {
  const lats = (url.searchParams.get("lat") ?? "").split(",").filter(Boolean).map(Number);
  const lons = (url.searchParams.get("lon") ?? "").split(",").filter(Boolean).map(Number);
  if (!lats.length || lats.length !== lons.length || lats.length > MAX_PUNTOS) return null;
  for (let i = 0; i < lats.length; i++) {
    if (!Number.isFinite(lats[i]) || !Number.isFinite(lons[i]) || !dentro(lats[i], lons[i])) return null;
  }
  // 4 decimales (~10 m): suficiente, y así la caché se reutiliza
  return { lat: lats.map((n) => n.toFixed(4)).join(","), lon: lons.map((n) => n.toFixed(4)).join(",") };
}

async function prevision(lat: string, lon: string): Promise<unknown[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });

  const qs = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: ACTUAL,
    daily: DIARIO,
    timezone: "Europe/Madrid",
    forecast_days: "4",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${qs}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const texto = await res.text();
  if (!res.ok) {
    let motivo = "";
    try {
      motivo = (JSON.parse(texto) as { reason?: string }).reason ?? "";
    } catch {}
    throw new Error(`Open-Meteo respondió ${res.status}${motivo ? ` (${motivo})` : ""}`);
  }
  if (!texto.trim()) throw new Error("Open-Meteo respondió vacío");
  const json: unknown = JSON.parse(texto);
  // con varias coordenadas devuelve una lista; con una sola, un objeto
  return Array.isArray(json) ? json : [json];
}

export async function GET(request: Request) {
  await connection();
  const coords = leerCoordenadas(new URL(request.url));
  if (!coords) {
    return Response.json({ error: "Coordenadas no válidas" }, { status: 400 });
  }
  try {
    const datos = await prevision(coords.lat, coords.lon);
    return Response.json({ datos });
  } catch (e) {
    const sinConexion = e instanceof Error && (e.name === "TimeoutError" || e.message === "fetch failed");
    const mensaje = sinConexion
      ? "el servidor no pudo conectar con Open-Meteo"
      : e instanceof Error
        ? e.message
        : "error desconocido";
    console.error("[api/tiempo]", e);
    return Response.json({ error: mensaje }, { status: 502 });
  }
}
