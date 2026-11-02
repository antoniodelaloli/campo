"use server";

import { refresh } from "next/cache";
import { contextoEscritura } from "@/lib/sesion";

// Cambiar el estado de una idea (nunca se borra: se descarta).
export async function cambiarEstadoIdea(formData: FormData) {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return;
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !["nueva", "revisada", "convertida", "descartada"].includes(estado)) return;
  await supabase.from("ideas").update({ estado }).eq("id", id);
  refresh();
}
