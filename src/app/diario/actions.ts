"use server";

import { refresh } from "next/cache";
import { contextoEscritura } from "@/lib/sesion";
import { esFechaISO, hoyISO } from "@/lib/texto";

export type EstadoFormDiario = {
  ok: boolean;
  mensaje: string | null;
  /** cambia en cada guardado correcto para que el formulario se vacíe */
  guardadoEn?: number;
};

// Apuntar una nota en el diario desde la web (lo que ya ha pasado). Nada se borra.
export async function apuntarEnDiario(_prev: EstadoFormDiario, formData: FormData): Promise<EstadoFormDiario> {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return { ok: false, mensaje: "Tu usuario solo puede consultar." };

  const texto = String(formData.get("texto") ?? "").trim();
  const fincaId = String(formData.get("finca") ?? "");
  const fecha = String(formData.get("fecha") ?? "") || hoyISO();

  if (texto.length < 3) return { ok: false, mensaje: "Escribe qué ha pasado." };
  if (texto.length > 2000) return { ok: false, mensaje: "Demasiado largo: resúmelo un poco." };
  if (!esFechaISO(fecha) || fecha > hoyISO()) return { ok: false, mensaje: "La fecha no puede ser de mañana en adelante." };

  const { error } = await supabase.from("diario").insert({
    texto,
    fecha,
    finca_id: fincaId || null,
    origen: "app",
  });
  if (error) return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };

  refresh();
  return { ok: true, mensaje: "Apuntado en el diario.", guardadoEn: Date.now() };
}
