import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * admin y editor apuntan de todo; «administrativo» (oficina) lo ve todo pero solo
 * apunta lo de administración (facturas, compras y pagos); lector solo consulta.
 */
export type Rol = "admin" | "editor" | "administrativo" | "lector";

/** Puede apuntar facturas, compras y pagos (migración 0016). */
export function puedeAdministrarRol(rol: Rol | undefined) {
  return rol === "admin" || rol === "editor" || rol === "administrativo";
}

/** Aspecto de la app (migración 0022): «granja» (pixel art) o «sobrio» (realista). */
export type Estilo = "granja" | "sobrio";

export type Perfil = {
  id: string;
  nombre: string | null;
  rol: Rol;
  activo: boolean;
  estilo: Estilo;
};

/** Lee el perfil; sin la migración 0022 (no hay «estilo»), con el estilo de siempre. */
async function leerPerfil(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<Perfil | null> {
  const r = await supabase.from("profiles").select("id, nombre, rol, activo, estilo").eq("id", userId).maybeSingle<Perfil>();
  if (!r.error) return r.data ? { ...r.data, estilo: r.data.estilo === "sobrio" ? "sobrio" : "granja" } : null;
  const v = await supabase.from("profiles").select("id, nombre, rol, activo").eq("id", userId).maybeSingle<Omit<Perfil, "estilo">>();
  return v.data ? { ...v.data, estilo: "granja" } : null;
}

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

  const perfil = await leerPerfil(supabase, userId);

  if (!perfil?.activo) redirect("/pendiente");

  return {
    supabase,
    perfil,
    puedeEditar: perfil.rol === "admin" || perfil.rol === "editor",
    puedeAdministrar: puedeAdministrarRol(perfil.rol),
  };
});

/** Para server actions: comprueba sesión y permiso de escritura. */
export async function contextoEscritura() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const perfil = await leerPerfil(supabase, userId);

  const puedeEditar =
    !!perfil?.activo && (perfil.rol === "admin" || perfil.rol === "editor");
  const puedeAdministrar = !!perfil?.activo && puedeAdministrarRol(perfil.rol);

  return { supabase, perfil, puedeEditar, puedeAdministrar };
}
