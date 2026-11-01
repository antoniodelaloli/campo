import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

// Envío de avisos al móvil (Web Push). Las claves VAPID identifican a Campo
// ante Google, Apple y Mozilla; se generan una vez con
// `npx web-push generate-vapid-keys` y van en las variables de entorno.

export type CargaAviso = {
  titulo: string;
  cuerpo: string;
  /** ruta de la app que se abre al tocar el aviso */
  url: string;
  /** avisos con la misma etiqueta se sustituyen en vez de amontonarse */
  etiqueta?: string;
};

type Suscripcion = { id: string; endpoint: string; p256dh: string; auth: string; fallos: number };

let configurado = false;

function configurar() {
  if (configurado) return;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) {
    throw new Error("Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en las variables de entorno.");
  }
  webpush.setVapidDetails(process.env.VAPID_CONTACTO ?? "mailto:avisos@campo.invalid", publica, privada);
  configurado = true;
}

/**
 * Manda el aviso a todos los móviles activos de un usuario.
 * `admin` debe ser el cliente con clave secreta (lee y actualiza suscripciones).
 * Los móviles que ya no aceptan avisos (respuesta 404/410) se desactivan.
 */
export async function enviarAUsuario(admin: SupabaseClient, userId: string, carga: CargaAviso) {
  configurar();
  const { data, error } = await admin
    .from("suscripciones_push")
    .select("id, endpoint, p256dh, auth, fallos")
    .eq("user_id", userId)
    .eq("activa", true)
    .overrideTypes<Suscripcion[], { merge: false }>();
  if (error) throw new Error(`No se pudieron leer los móviles: ${error.message}`);

  const cuerpo = JSON.stringify({
    title: carga.titulo,
    body: carga.cuerpo,
    url: carga.url,
    tag: carga.etiqueta ?? "campo",
  });

  let enviados = 0;
  let fallidos = 0;
  await Promise.all(
    (data ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          cuerpo,
          { TTL: 60 * 60 * 12, urgency: "normal" },
        );
        enviados++;
        await admin
          .from("suscripciones_push")
          .update({ ultimo_envio: new Date().toISOString(), fallos: 0 })
          .eq("id", s.id);
      } catch (e) {
        fallidos++;
        const codigo = (e as { statusCode?: number }).statusCode;
        const caducada = codigo === 404 || codigo === 410;
        await admin
          .from("suscripciones_push")
          .update({ fallos: s.fallos + 1, activa: !(caducada || s.fallos + 1 >= 5) })
          .eq("id", s.id);
      }
    }),
  );

  return { moviles: data?.length ?? 0, enviados, fallidos };
}
