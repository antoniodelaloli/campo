import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Comprobación del token que manda ChatGPT o Claude al conector de Campo.
// El token lo emite el servidor OAuth de Supabase al iniciar sesión el usuario:
// es un JWT de Supabase con su user_id y el client_id del asistente.
// Con él se crea un cliente de Supabase «como ese usuario»: RLS se aplica igual
// que en la app (lector solo consulta; editor apunta).

export type ContextoAgente = {
  supabase: SupabaseClient;
  userId: string;
  nombre: string;
  puedeEditar: boolean;
};

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Emisor de los tokens (servidor de autorización). */
export const EMISOR = `${URL_SUPABASE.replace(/\/$/, "")}/auth/v1`;

/** Dirección pública del conector y de sus metadatos, según la petición. */
export function direcciones(request: Request) {
  const u = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? u.host;
  const proto = request.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const base = `${proto}://${host}`;
  return {
    recurso: `${base}/api/mcp`,
    metadatos: `${base}/.well-known/oauth-protected-resource/api/mcp`,
  };
}

/** 401 con la pista para que el asistente sepa dónde iniciar sesión. */
export function noAutorizado(request: Request, motivo: string) {
  const { metadatos } = direcciones(request);
  return Response.json(
    { error: "unauthorized", error_description: motivo },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${metadatos}", scope="openid email profile"`,
        "Access-Control-Expose-Headers": "WWW-Authenticate",
      },
    },
  );
}

/** Valida el token y devuelve el cliente del usuario, o una respuesta 401/403. */
export async function contextoAgente(request: Request): Promise<ContextoAgente | Response> {
  const cabecera = request.headers.get("authorization") ?? "";
  const token = cabecera.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return noAutorizado(request, "Falta iniciar sesión en Campo.");

  const supabase = createClient(URL_SUPABASE, CLAVE_PUBLICA, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  const claims = data?.claims as (Record<string, unknown> & { sub?: string; iss?: string }) | undefined;
  if (error || !claims?.sub) return noAutorizado(request, "La sesión no es válida o ha caducado.");
  if (claims.iss !== EMISOR) return noAutorizado(request, "Token de otro servidor.");
  // Solo tokens emitidos para un asistente (no la sesión normal de la web)
  if (typeof claims.client_id !== "string" || !claims.client_id) {
    return noAutorizado(request, "Este token no es de un asistente conectado.");
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, nombre, rol, activo")
    .eq("id", claims.sub)
    .maybeSingle<{ id: string; nombre: string | null; rol: string; activo: boolean }>();
  if (!perfil?.activo) {
    return Response.json(
      { error: "forbidden", error_description: "Tu usuario de Campo aún no está activado." },
      { status: 403 },
    );
  }

  return {
    supabase,
    userId: perfil.id,
    nombre: perfil.nombre ?? "",
    puedeEditar: perfil.rol === "admin" || perfil.rol === "editor",
  };
}
