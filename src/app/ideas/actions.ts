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

/**
 * Convierte una idea en tarea: crea la tarea (mismo título, la idea completa en
 * la descripción y la misma finca y zona) y marca la idea como «convertida».
 */
export async function convertirIdeaEnTarea(formData: FormData) {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: idea } = await supabase
    .from("ideas")
    .select("id, titulo, texto, finca_id, zona_id, estado, created_at")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      titulo: string;
      texto: string;
      finca_id: string | null;
      zona_id: string | null;
      estado: string;
      created_at: string;
    }>();
  if (!idea || idea.estado === "convertida") return;

  const [y, m, d] = idea.created_at.slice(0, 10).split("-");
  const descripcion =
    (idea.texto !== idea.titulo ? `${idea.texto}\n\n` : "") + `De la libreta de ideas (${Number(d)}/${Number(m)}/${y}).`;

  const { error } = await supabase.from("tareas").insert({
    titulo: idea.titulo.slice(0, 300),
    descripcion,
    finca_id: idea.finca_id,
    zona_id: idea.finca_id ? idea.zona_id : null,
    origen: "app",
  });
  if (error) return;

  const hoy = new Date().toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
  await supabase
    .from("ideas")
    .update({ estado: "convertida", nota_revision: `Convertida en tarea el ${hoy}.` })
    .eq("id", id);
  refresh();
}
