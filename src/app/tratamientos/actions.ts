"use server";

import { refresh } from "next/cache";
import { contextoEscritura } from "@/lib/sesion";
import { hoyISO } from "@/lib/texto";

export type EstadoFormTratamiento = { ok: boolean; mensaje: string | null; guardadoEn?: number };

const UNIDADES = ["L", "kg", "cc", "g", "mL"];
const ESTADOS = ["prevista", "en_curso", "realizada"];

function numero(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export async function crearTratamiento(
  _prev: EstadoFormTratamiento,
  formData: FormData,
): Promise<EstadoFormTratamiento> {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return { ok: false, mensaje: "Tu usuario solo puede consultar." };

  const fincaId = String(formData.get("finca") ?? "");
  const fechaTxt = String(formData.get("fecha") ?? "");
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaTxt) ? fechaTxt : hoyISO();
  const estado = String(formData.get("estado") ?? "en_curso");
  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;
  const aplicador = String(formData.get("aplicador") ?? "") || null;
  const litros = numero(formData.get("litros_cuba"));
  const cubas = numero(formData.get("n_cubas"));
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!fincaId) return { ok: false, mensaje: "Elige la finca." };
  if (!ESTADOS.includes(estado)) return { ok: false, mensaje: "Estado no válido." };
  if (Number.isNaN(litros) || Number.isNaN(cubas))
    return { ok: false, mensaje: "Litros y cubas, solo con números." };

  // Filas de productos: producto_0, dosis_0, unidad_0 …
  const productos: { producto_id: string; dosis_por_cuba: number | null; unidad: string | null }[] = [];
  for (let i = 0; i < 6; i++) {
    const id = String(formData.get(`producto_${i}`) ?? "");
    if (!id) continue;
    const dosis = numero(formData.get(`dosis_${i}`));
    if (Number.isNaN(dosis)) return { ok: false, mensaje: "La dosis va solo con números." };
    const unidad = String(formData.get(`unidad_${i}`) ?? "");
    productos.push({
      producto_id: id,
      dosis_por_cuba: dosis,
      unidad: UNIDADES.includes(unidad) ? unidad : null,
    });
  }

  const { data: t, error } = await supabase
    .from("tratamientos")
    .insert({
      finca_id: fincaId,
      fecha,
      estado,
      objetivo,
      aplicador_id: aplicador,
      litros_cuba: litros,
      n_cubas: cubas != null ? Math.round(cubas) : null,
      notas,
      origen: "app",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !t) return { ok: false, mensaje: `No se pudo guardar: ${error?.message ?? "error"}` };

  if (productos.length) {
    const { error: e2 } = await supabase
      .from("tratamiento_productos")
      .insert(productos.map((p) => ({ ...p, tratamiento_id: t.id })));
    if (e2) {
      refresh();
      return {
        ok: true,
        mensaje: `Tratamiento guardado, pero fallaron los productos: ${e2.message}`,
        guardadoEn: Date.now(),
      };
    }
  }

  refresh();
  return { ok: true, mensaje: "Tratamiento anotado.", guardadoEn: Date.now() };
}

export async function cambiarEstadoTratamiento(formData: FormData) {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return;
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !ESTADOS.includes(estado)) return;
  await supabase.from("tratamientos").update({ estado }).eq("id", id);
  refresh();
}
