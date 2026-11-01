import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave SECRETA de Supabase: se salta RLS.
 * Solo para el servidor (aviso diario). Nunca en el navegador ni con
 * prefijo NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secreta) {
    throw new Error("Falta SUPABASE_SECRET_KEY en las variables de entorno.");
  }
  return createClient(url, secreta, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
