"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nuevaClave } from "@/lib/atajos";

export type EstadoClave = { clave: string | null; error: string | null };

/** Crea una clave para el atajo de Siri. Se enseña UNA vez: luego solo queda su huella. */
export async function crearClaveAtajo(_prev: EstadoClave, formData: FormData): Promise<EstadoClave> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { clave: null, error: "Tienes que iniciar sesión." };

  const nombre = String(formData.get("nombre") ?? "").trim().slice(0, 60) || "iPhone";
  const { clave, hash, prefijo } = nuevaClave();
  const { error } = await supabase.from("claves_atajo").insert({ nombre, hash, prefijo });
  if (error) {
    if (/claves_atajo/.test(error.message) && /exist|schema cache/i.test(error.message)) {
      return { clave: null, error: "Falta aplicar la migración 0010 en Supabase." };
    }
    return { clave: null, error: `No se pudo crear: ${error.message}` };
  }
  refresh();
  return { clave, error: null };
}

/** Anula una clave: el atajo que la lleve deja de funcionar. */
export async function anularClaveAtajo(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("claves_atajo").update({ activa: false }).eq("id", id);
  refresh();
}
