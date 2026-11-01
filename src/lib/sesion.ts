import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Rol = "admin" | "editor" | "lector";

export type Perfil = {
  id: string;
  nombre: string | null;
  rol: Rol;
  activo: boolean;
};

/**
 * Lee la sesión y el perfil UNA vez por petición (React cache).
 * - Sin sesión → /login
 * - Perfil inactivo → /pendiente
 * Siempre se llama dentro de un <Suspense>: depende de la petición.
 */
export const obtenerContexto = cache(async () => {
  // El JWT se valida con la hora actual: hay que esperar a la petición real.
  await connection();
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, nombre, rol, activo")
    .eq("id", userId)
    .maybeSingle<Perfil>();

  if (!perfil?.activo) redirect("/pendiente");

  return {
    supabase,
    perfil,
    puedeEditar: perfil.rol === "admin" || perfil.rol === "editor",
  };
});

/** Para server actions: comprueba sesión y permiso de escritura. */
export async function contextoEscritura() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, nombre, rol, activo")
    .eq("id", userId)
    .maybeSingle<Perfil>();

  const puedeEditar =
    !!perfil?.activo && (perfil.rol === "admin" || perfil.rol === "editor");

  return { supabase, perfil, puedeEditar };
}
