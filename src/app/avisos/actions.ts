"use server";

import { refresh } from "next/cache";
import { contextoEscritura } from "@/lib/sesion";

/** Cierra un aviso (no se borra: queda como resuelto o descartado). */
export async function cerrarAviso(formData: FormData) {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return;

  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "resuelto");
  if (!id || !["resuelto", "descartado"].includes(estado)) return;

  await supabase
    .from("avisos")
    .update({ estado, resuelto_en: new Date().toISOString() })
    .eq("id", id);

  refresh();
}

/** Cierra una incidencia del campo (arreglada o descartada). No se borra. */
export async function cerrarIncidencia(formData: FormData) {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return;

  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "resuelta");
  if (!id || !["resuelta", "descartada"].includes(estado)) return;

  await supabase
    .from("incidencias")
    .update({ estado, resuelta_en: new Date().toISOString() })
    .eq("id", id);

  refresh();
}
