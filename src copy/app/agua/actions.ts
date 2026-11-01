"use server";

import { refresh } from "next/cache";
import { contextoEscritura } from "@/lib/sesion";
import { hoyISO } from "@/lib/texto";

export type EstadoFormAgua = { ok: boolean; mensaje: string | null; guardadoEn?: number };

function numero(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function fechaValida(v: FormDataEntryValue | null): string {
  const s = String(v ?? "");
  const hoy = hoyISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return hoy;
  return s > hoy ? hoy : s;
}

export async function anotarNivel(
  _prev: EstadoFormAgua,
  formData: FormData,
): Promise<EstadoFormAgua> {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return { ok: false, mensaje: "Tu usuario solo puede consultar." };

  const pantanoId = String(formData.get("pantano") ?? "");
  const metodo = String(formData.get("metodo") ?? "a_ojo");
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const porcentaje = numero(formData.get("porcentaje"));
  let nivel = numero(formData.get("nivel"));

  if (!pantanoId) return { ok: false, mensaje: "Elige el pantano." };
  if (!["a_ojo", "sensor", "calculado"].includes(metodo))
    return { ok: false, mensaje: "Método no válido." };
  if (Number.isNaN(nivel) || Number.isNaN(porcentaje))
    return { ok: false, mensaje: "Escribe el nivel solo con números." };

  // Si se da un porcentaje "a ojo", se pasa a m³ con la capacidad útil (o total).
  if (nivel == null && porcentaje != null) {
    if (porcentaje < 0 || porcentaje > 100)
      return { ok: false, mensaje: "El porcentaje va de 0 a 100." };
    const { data: p } = await supabase
      .from("pantanos")
      .select("capacidad_m3, capacidad_util_m3")
      .eq("id", pantanoId)
      .maybeSingle<{ capacidad_m3: number | null; capacidad_util_m3: number | null }>();
    const tope = Number(p?.capacidad_util_m3 ?? p?.capacidad_m3 ?? 0);
    if (!tope)
      return { ok: false, mensaje: "Este pantano no tiene capacidad registrada: escribe los m³." };
    nivel = Math.round((porcentaje / 100) * tope);
  }

  if (nivel == null) return { ok: false, mensaje: "Escribe el nivel en m³ o en %." };
  if (nivel < 0) return { ok: false, mensaje: "El nivel no puede ser negativo." };

  const { error } = await supabase.from("niveles_pantano").insert({
    pantano_id: pantanoId,
    fecha: fechaValida(formData.get("fecha")),
    nivel_m3: nivel,
    metodo,
    notas,
    origen: "app",
  });

  if (error) return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };
  refresh();
  return { ok: true, mensaje: "Nivel anotado.", guardadoEn: Date.now() };
}

export async function anotarLectura(
  _prev: EstadoFormAgua,
  formData: FormData,
): Promise<EstadoFormAgua> {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return { ok: false, mensaje: "Tu usuario solo puede consultar." };

  const contadorId = String(formData.get("contador") ?? "");
  const lectura = numero(formData.get("lectura"));
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!contadorId) return { ok: false, mensaje: "Elige el contador." };
  if (lectura == null || Number.isNaN(lectura) || lectura < 0)
    return { ok: false, mensaje: "Escribe la lectura del contador (solo números)." };

  const { error } = await supabase.from("lecturas_contador").insert({
    contador_id: contadorId,
    fecha: fechaValida(formData.get("fecha")),
    lectura_m3: lectura,
    notas,
    origen: "app",
  });

  if (error) return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };
  refresh();
  return { ok: true, mensaje: "Lectura anotada.", guardadoEn: Date.now() };
}
