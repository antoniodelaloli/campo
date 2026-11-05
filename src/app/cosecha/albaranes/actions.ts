"use server";

import { refresh } from "next/cache";
import { contextoEscritura } from "@/lib/sesion";
import { leerHoja } from "@/lib/albaranes";

export type EstadoImportar = { ok: boolean; mensaje: string | null; guardadoEn?: number };

/**
 * Guarda una hoja de albaranes copiada del Excel. El texto se vuelve a leer
 * aquí (no se fía de lo que manda el navegador); la campaña, la finca, el
 * titular, el corte y el título los elige quien importa.
 */
export async function guardarHoja(_prev: EstadoImportar, formData: FormData): Promise<EstadoImportar> {
  const { supabase, puedeAdministrar } = await contextoEscritura();
  if (!puedeAdministrar) return { ok: false, mensaje: "Tu usuario solo puede consultar." };

  const texto = String(formData.get("texto") ?? "");
  const campana = String(formData.get("campana") ?? "").trim();
  const finca = String(formData.get("finca") ?? "") || null;
  const titular = String(formData.get("titular") ?? "") || null;
  const corteTxt = String(formData.get("corte") ?? "").trim();
  const corte = corteTxt ? Number(corteTxt) : null;
  const hoja = String(formData.get("hoja") ?? "").trim().slice(0, 300);

  if (!texto.trim()) return { ok: false, mensaje: "Pega primero la hoja del Excel." };
  if (!/^\d{4}\/\d{2}$/.test(campana)) return { ok: false, mensaje: "Pon la campaña así: 2025/26." };
  if (corte != null && (!Number.isInteger(corte) || corte < 1 || corte > 9))
    return { ok: false, mensaje: "El corte tiene que ser un número del 1 al 9." };
  if (!hoja) return { ok: false, mensaje: "Ponle un nombre a la hoja (el título del Excel)." };

  const leida = leerHoja(texto, campana);
  if (leida.filas.length === 0) return { ok: false, mensaje: leida.avisos[0] ?? "No he encontrado ningún albarán en lo pegado." };

  // la misma hoja dos veces no
  const { data: ya, error: e1 } = await supabase
    .from("albaranes")
    .select("id")
    .eq("campana", campana)
    .eq("hoja", hoja)
    .eq("anulado", false)
    .limit(1);
  if (e1) {
    if (/albaranes/.test(e1.message)) return { ok: false, mensaje: "Falta ejecutar la migración 0020 en Supabase." };
    return { ok: false, mensaje: `No se pudo comprobar: ${e1.message}` };
  }
  if (ya && ya.length) return { ok: false, mensaje: `La hoja «${hoja}» de ${campana} ya está metida. Si quieres cambiarla, quítala primero.` };

  const { error } = await supabase.from("albaranes").insert(
    leida.filas.map((f) => ({ ...f, campana, finca_id: finca, titular_id: titular, corte, hoja, origen: "app" })),
  );
  if (error) return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };

  refresh();
  const kg = leida.filas.reduce((s, f) => s + f.kg_buenos, 0);
  return {
    ok: true,
    mensaje: `Guardados ${leida.filas.length} albaranes (${new Intl.NumberFormat("es-ES").format(Math.round(kg))} kg buenos).`,
    guardadoEn: Date.now(),
  };
}

/** Quita (anula) todos los albaranes de una hoja. No se borra nada. */
export async function quitarHoja(formData: FormData) {
  const { supabase, puedeAdministrar } = await contextoEscritura();
  if (!puedeAdministrar) return;
  const campana = String(formData.get("campana") ?? "");
  const hoja = String(formData.get("hoja") ?? "");
  if (!campana || !hoja) return;
  await supabase.from("albaranes").update({ anulado: true }).eq("campana", campana).eq("hoja", hoja).eq("anulado", false);
  refresh();
}

/** Cambia la finca, el titular o el corte de una hoja entera (p. ej. la finca por confirmar). */
export async function corregirHoja(formData: FormData) {
  const { supabase, puedeAdministrar } = await contextoEscritura();
  if (!puedeAdministrar) return;
  const campana = String(formData.get("campana") ?? "");
  const hoja = String(formData.get("hoja") ?? "");
  if (!campana || !hoja) return;
  const corteTxt = String(formData.get("corte") ?? "").trim();
  const corte = corteTxt ? Number(corteTxt) : null;
  await supabase
    .from("albaranes")
    .update({
      finca_id: String(formData.get("finca") ?? "") || null,
      titular_id: String(formData.get("titular") ?? "") || null,
      corte: corte != null && Number.isInteger(corte) && corte >= 1 && corte <= 9 ? corte : null,
    })
    .eq("campana", campana)
    .eq("hoja", hoja)
    .eq("anulado", false);
  refresh();
}
