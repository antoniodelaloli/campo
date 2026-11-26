// Campo tiene dos versiones con el mismo código:
//   · «completa»: las fincas de la familia (Valladolises, Corvera, Lobosillo), con
//     mapa dibujado, agua, tratamientos, cosecha y cuentas.
//   · «sencilla»: para otra finca, con lo básico: tareas, fechas clave, diario,
//     ideas, avisos y el tiempo para fumigar. Va con su propio Supabase.
//
// Se elige en Vercel con variables de entorno (se leen al compilar):
//   NEXT_PUBLIC_EDICION=sencilla        → versión sencilla (si no está, completa)
//   NEXT_PUBLIC_NOMBRE_APP=El Olivar    → nombre que sale arriba (por defecto «Campo»)
//   FINCAS_TIEMPO=Mi finca:37.81,-1.14  → puntos para el tiempo (solo servidor).
//                                         Varios, separados por «;».
// Sirve en servidor y en cliente.

export const SENCILLA = process.env.NEXT_PUBLIC_EDICION === "sencilla";

export const NOMBRE_APP = process.env.NEXT_PUBLIC_NOMBRE_APP?.trim() || "Campo";

/** Secciones que solo existen en la versión completa. */
export const RUTAS_SOLO_COMPLETA = ["/agua", "/tratamientos", "/cosecha", "/cuentas", "/fincas", "/atajos"];

/** ¿Se puede abrir esta ruta en esta versión? */
export function rutaDisponible(ruta: string) {
  if (!SENCILLA) return true;
  return !RUTAS_SOLO_COMPLETA.some((r) => ruta === r || ruta.startsWith(`${r}/`));
}

/** Texto de ejemplo: el de las fincas de la familia o uno neutro para otra finca. */
export function ejemplo(completa: string, sencilla: string) {
  return SENCILLA ? sencilla : completa;
}

export type PuntoTiempoFinca = { nombre: string; lat: number; lon: number };

/**
 * Puntos para la previsión del tiempo en la versión sencilla, desde FINCAS_TIEMPO
 * («Nombre:lat,lon;Otro:lat,lon»). Lo que no se entienda se ignora.
 */
export function puntosTiempoSencilla(texto = process.env.FINCAS_TIEMPO ?? ""): PuntoTiempoFinca[] {
  return texto
    .split(";")
    .map((trozo) => {
      const [nombre, coords] = trozo.split(":");
      const [lat, lon] = (coords ?? "").split(",").map((n) => Number(n.trim()));
      if (!nombre?.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
      return { nombre: nombre.trim(), lat, lon };
    })
    .filter((p): p is PuntoTiempoFinca => p !== null);
}
