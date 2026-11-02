"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cargarHitos, cargarTareasAbiertas, cargarTratamientos } from "@/lib/datos";
import { enviarAUsuario } from "@/lib/push";
import { resumenDelDia } from "@/lib/resumen-avisos";
import { previsionFincas } from "@/lib/alertas-tiempo";
import { hoyISO, sumarDias } from "@/lib/texto";

// Acciones del botón «Avisarme en este móvil» (componente AvisosMovil).

type Resultado = { ok: true; mensaje?: string } | { ok: false; error: string };

export type SuscripcionSerializada = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

async function usuarioActual() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

/** Apunta este móvil para recibir avisos, a nombre de quien ha entrado. */
export async function guardarSuscripcion(sub: SuscripcionSerializada, dispositivo: string): Promise<Resultado> {
  const { supabase, userId } = await usuarioActual();
  if (!userId) return { ok: false, error: "La sesión ha caducado. Vuelve a entrar." };

  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!sub?.endpoint || !p256dh || !auth) return { ok: false, error: "El navegador no dio los datos del aviso." };

  const { error } = await supabase.rpc("guardar_suscripcion_push", {
    p_endpoint: sub.endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_dispositivo: dispositivo.slice(0, 120),
  });
  if (error) {
    if (error.code === "PGRST202" || /guardar_suscripcion_push/.test(error.message)) {
      return { ok: false, error: "Falta crear la tabla de avisos en Supabase (migración 0005_avisos_push.sql)." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Deja de avisar en este móvil. */
export async function desactivarSuscripcion(endpoint: string): Promise<Resultado> {
  const { supabase, userId } = await usuarioActual();
  if (!userId) return { ok: false, error: "La sesión ha caducado. Vuelve a entrar." };
  const { error } = await supabase.rpc("desactivar_suscripcion_push", { p_endpoint: endpoint });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Manda ahora un aviso de prueba a los móviles de quien lo pide. */
export async function enviarPrueba(): Promise<Resultado> {
  const { userId } = await usuarioActual();
  if (!userId) return { ok: false, error: "La sesión ha caducado. Vuelve a entrar." };

  try {
    const admin = createAdminClient();
    const hoy = hoyISO();

    // Si hoy toca avisar de algo, la prueba enseña ese mismo aviso
    let titulo = "Campo · aviso de prueba";
    let cuerpo = "¡Funciona! Así te llegarán las fechas clave: una semana antes, el día antes y el mismo día.";
    let url = "/calendario";
    let importante = false;
    const [{ hitos }, { tratamientos }, { tareas }] = await Promise.all([
      cargarHitos(admin, sumarDias(hoy, 60)),
      cargarTratamientos(admin),
      cargarTareasAbiertas(admin),
    ]);
    const { alertas, viento } = await previsionFincas();
    const resumen = resumenDelDia({ hitos, tratamientos, tareas, alertas, viento, hoy });
    if (resumen) {
      titulo = `${resumen.titulo} (prueba)`;
      cuerpo = resumen.cuerpo;
      url = resumen.url;
      importante = !!resumen.importante;
    }

    const r = await enviarAUsuario(admin, userId, { titulo, cuerpo, url, etiqueta: "campo-prueba", importante });
    await admin.from("envios_push").insert({
      user_id: userId,
      fecha: hoy,
      tipo: "prueba",
      titulo,
      cuerpo,
      enviados: r.enviados,
      fallidos: r.fallidos,
    });

    if (r.moviles === 0) return { ok: false, error: "No hay ningún móvil apuntado a tu nombre." };
    if (r.enviados === 0) return { ok: false, error: "No se pudo entregar el aviso. Prueba a desactivar y activar de nuevo." };
    return {
      ok: true,
      mensaje: r.moviles === 1 ? "Aviso enviado. Debería llegar en unos segundos." : `Aviso enviado a ${r.enviados} de ${r.moviles} móviles.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
