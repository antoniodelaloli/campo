import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Claves de los atajos de Siri («Incidencia», «¿En qué finca estoy?»).
 * El atajo no puede iniciar sesión como la web, así que lleva dentro una clave
 * personal. En la base de datos solo se guarda su huella (sha-256).
 * Las respuestas son texto corto: Siri las lee en voz alta.
 */

export function nuevaClave() {
  const clave = `campo_${randomBytes(24).toString("base64url")}`;
  return { clave, hash: huella(clave), prefijo: clave.slice(0, 12) };
}

export function huella(clave: string) {
  return createHash("sha256").update(clave.trim()).digest("hex");
}

export type UsuarioAtajo = { admin: SupabaseClient; userId: string; nombre: string; puedeEditar: boolean };

/** Texto para Siri (y para quien lo vea en pantalla). */
export function texto(mensaje: string, status = 200) {
  return new Response(mensaje, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** La clave viene en «Authorization: Bearer …», o en «clave» del cuerpo o de la dirección. */
export async function usuarioDeAtajo(request: Request, cuerpo?: Record<string, unknown>): Promise<UsuarioAtajo | Response> {
  const cabecera = request.headers.get("authorization") ?? "";
  const clave =
    cabecera.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    (typeof cuerpo?.clave === "string" ? cuerpo.clave : "") ||
    new URL(request.url).searchParams.get("clave") ||
    "";
  if (!clave.startsWith("campo_")) {
    return texto("Falta la clave de Campo en el atajo. Créala en Campo, en la página Atajos.", 401);
  }

  const admin = createAdminClient();
  const { data: fila } = await admin
    .from("claves_atajo")
    .select("id, user_id, activa")
    .eq("hash", huella(clave))
    .maybeSingle<{ id: string; user_id: string; activa: boolean }>();
  if (!fila || !fila.activa) {
    return texto("La clave del atajo no vale o se ha anulado. Crea una nueva en Campo, en la página Atajos.", 401);
  }

  const { data: perfil } = await admin
    .from("profiles")
    .select("id, nombre, rol, activo")
    .eq("id", fila.user_id)
    .maybeSingle<{ id: string; nombre: string | null; rol: string; activo: boolean }>();
  if (!perfil?.activo) return texto("Tu usuario de Campo no está activado.", 403);

  await admin.from("claves_atajo").update({ ultimo_uso: new Date().toISOString() }).eq("id", fila.id);

  return {
    admin,
    userId: perfil.id,
    nombre: perfil.nombre ?? "",
    puedeEditar: perfil.rol === "admin" || perfil.rol === "editor",
  };
}

/** Lee latitud y longitud de un número o de un texto («37,7712»). */
export function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Cuerpo de la petición: JSON o formulario; si no hay, la dirección (?lat=&lon=). */
export async function leerCuerpo(request: Request): Promise<Record<string, unknown>> {
  const desdeUrl = Object.fromEntries(new URL(request.url).searchParams);
  if (request.method === "GET") return desdeUrl;
  const tipo = request.headers.get("content-type") ?? "";
  try {
    if (tipo.includes("application/json")) return { ...desdeUrl, ...((await request.json()) as Record<string, unknown>) };
    if (tipo.includes("form")) return { ...desdeUrl, ...Object.fromEntries(await request.formData()) };
    const crudo = await request.text();
    return crudo ? { ...desdeUrl, ...(JSON.parse(crudo) as Record<string, unknown>) } : desdeUrl;
  } catch {
    return desdeUrl;
  }
}
