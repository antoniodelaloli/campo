"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Cambia el aspecto de la app para el usuario (migración 0022). */
export async function cambiarEstilo(formData: FormData) {
  const nuevo = formData.get("estilo") === "sobrio" ? "sobrio" : "granja";
  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_mi_estilo", { nuevo });
  if (error) return;
  // la cookie deja pintar el estilo bueno desde el primer momento (sin parpadeo)
  (await cookies()).set("campo_estilo", nuevo, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}
