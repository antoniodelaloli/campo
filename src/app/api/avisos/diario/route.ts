import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cargarHitos, cargarTareasAbiertas, cargarTratamientos } from "@/lib/datos";
import { enviarAUsuario } from "@/lib/push";
import { resumenDelDia } from "@/lib/resumen-avisos";
import { previsionFincas } from "@/lib/alertas-tiempo";
import { datoDelDia } from "@/lib/dato-del-dia";
import { hoyISO, sumarDias } from "@/lib/texto";

// Aviso de cada mañana. Lo llama el cron de Vercel (vercel.json) con la
// cabecera «Authorization: Bearer CRON_SECRET». Sin esa cabecera, 401.
// Se puede ejecutar más de una vez al día: cada persona recibe como mucho
// un aviso diario (lo controla la tabla envios_push).

export async function GET(request: Request) {
  await connection();

  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return Response.json({ error: "Falta CRON_SECRET en las variables de entorno." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const hoy = hoyISO();

    const [{ hitos, error: errorHitos }, { tratamientos, error: errorTrat }, { tareas, error: errorTareas }] =
      await Promise.all([cargarHitos(admin, sumarDias(hoy, 60)), cargarTratamientos(admin), cargarTareasAbiertas(admin)]);
    if (errorHitos || errorTrat || errorTareas)
      throw new Error(errorHitos ?? errorTrat ?? errorTareas ?? "Error al leer datos");

    const [{ alertas, viento }, dato] = await Promise.all([previsionFincas(), datoDelDia(admin, hoy)]);
    const resumen = resumenDelDia({ hitos, tratamientos, tareas, alertas, viento, dato, hoy });
    if (!resumen) return Response.json({ hoy, enviado: false, motivo: "Nada que avisar hoy" });

    // Personas activas con algún móvil apuntado
    const { data: subs, error: errorSubs } = await admin
      .from("suscripciones_push")
      .select("user_id, profiles!inner(activo)")
      .eq("activa", true)
      .eq("profiles.activo", true);
    if (errorSubs) throw new Error(errorSubs.message);
    const usuarios = [...new Set((subs ?? []).map((s) => s.user_id as string))];

    const resultado = [];
    for (const userId of usuarios) {
      // Primero se apunta el envío: si ya existe el de hoy, no se repite.
      const { data: envio, error: errorEnvio } = await admin
        .from("envios_push")
        .insert({ user_id: userId, fecha: hoy, tipo: resumen.tipo, titulo: resumen.titulo, cuerpo: resumen.cuerpo })
        .select("id")
        .single();
      if (errorEnvio) {
        if (errorEnvio.code === "23505") {
          resultado.push({ userId, ya: true });
          continue;
        }
        throw new Error(errorEnvio.message);
      }

      const r = await enviarAUsuario(admin, userId, {
        titulo: resumen.titulo,
        cuerpo: resumen.cuerpo,
        url: resumen.url,
        etiqueta: `campo-${hoy}`,
        importante: resumen.importante,
      });
      await admin.from("envios_push").update({ enviados: r.enviados, fallidos: r.fallidos }).eq("id", envio.id);
      resultado.push({ userId, ...r });
    }

    return Response.json({ hoy, enviado: true, tipo: resumen.tipo, titulo: resumen.titulo, resultado });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("[avisos/diario]", mensaje);
    return Response.json({ error: mensaje }, { status: 500 });
  }
}
