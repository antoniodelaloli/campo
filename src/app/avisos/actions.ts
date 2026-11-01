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
