import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Albaran } from "@/lib/albaranes";

/*
 * Albaranes de báscula (migración 0020). Sin la migración, devuelve `falta`
 * y la app sigue funcionando con los documentos de antes. La foto de cada
 * albarán (migración 0027) se lee si la columna existe.
 */

const COLUMNAS =
  "id, campana, finca_id, corte, titular_id, hoja, albaran, fecha, cajas, bruto_kg, tara_camion_kg, tara_cajas_kg, kg_buenos, kg_citrica, importe_eur, notas";

const num = (v: unknown) => (v == null ? null : Number(v));

export async function cargarAlbaranes(supabase: SupabaseClient, campana?: string) {
  const consulta = (columnas: string) => {
    let q = supabase.from("albaranes").select(columnas).eq("anulado", false).order("fecha").limit(5000);
    if (campana) q = q.eq("campana", campana);
    return q;
  };
  // la foto (migración 0027) es opcional: sin ella, la app sigue igual
  let r = await consulta(`${COLUMNAS}, foto_url`);
  if (r.error && /foto_url/.test(r.error.message)) r = await consulta(COLUMNAS);
  const { data, error } = r;
  if (error) return { albaranes: [] as Albaran[], falta: true, error: error.message };
  const filas = (data ?? []) as unknown as (Omit<Albaran, "foto_url"> & { foto_url?: string | null })[];
  const albaranes: Albaran[] = filas.map((a) => ({
    ...a,
    foto_url: a.foto_url ?? null,
    cajas: num(a.cajas),
    bruto_kg: num(a.bruto_kg),
    tara_camion_kg: num(a.tara_camion_kg),
    tara_cajas_kg: num(a.tara_cajas_kg),
    kg_buenos: Number(a.kg_buenos),
    kg_citrica: Number(a.kg_citrica),
    importe_eur: num(a.importe_eur),
  }));
  return { albaranes, falta: false, error: null };
}
