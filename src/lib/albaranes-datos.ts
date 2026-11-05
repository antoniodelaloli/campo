import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Albaran } from "@/lib/albaranes";

/*
 * Albaranes de báscula (migración 0020). Sin la migración, devuelve `falta`
 * y la app sigue funcionando con los documentos de antes.
 */

const COLUMNAS =
  "id, campana, finca_id, corte, titular_id, hoja, albaran, fecha, cajas, bruto_kg, tara_camion_kg, tara_cajas_kg, kg_buenos, kg_citrica, importe_eur, notas";

const num = (v: unknown) => (v == null ? null : Number(v));

export async function cargarAlbaranes(supabase: SupabaseClient, campana?: string) {
  let q = supabase.from("albaranes").select(COLUMNAS).eq("anulado", false).order("fecha").limit(5000);
  if (campana) q = q.eq("campana", campana);
  const { data, error } = await q;
  if (error) return { albaranes: [] as Albaran[], falta: true, error: error.message };
  const albaranes: Albaran[] = (data ?? []).map((a) => ({
    ...a,
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
