"use server";

import { refresh } from "next/cache";
import { contextoEscritura } from "@/lib/sesion";
import { campanaDeFecha, CATEGORIAS_GASTO } from "@/lib/cuentas";

export type EstadoFormCuentas = { ok: boolean; mensaje: string | null; guardadoEn?: number };

/** «12.345,67» o «12345.67» → 12345.67 */
function importe(v: FormDataEntryValue | null): number | null {
  let s = String(v ?? "").trim().replace(/\s|€/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Guarda una factura de venta o de gasto. El archivo (foto o PDF) ya lo ha
 * subido el navegador al cajón «facturas»; aquí llega solo su ruta.
 */
export async function guardarFactura(_prev: EstadoFormCuentas, formData: FormData): Promise<EstadoFormCuentas> {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return { ok: false, mensaje: "Tu usuario solo puede consultar." };

  const tipo = formData.get("tipo") === "gasto" ? "gasto" : "venta";
  const titular = String(formData.get("titular") ?? "");
  const finca = String(formData.get("finca") ?? "") || null;
  const fecha = String(formData.get("fecha") ?? "");
  const estado = formData.get("estado") === "prevista" ? "prevista" : "emitida";
  const base = importe(formData.get("base"));
  const impuesto = importe(formData.get("impuesto")) ?? 0;
  const kg = importe(formData.get("kg"));
  const categoria = String(formData.get("categoria") ?? "") || null;
  const archivo = String(formData.get("archivo_path") ?? "") || null;
  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null;

  if (!titular)
    return { ok: false, mensaje: tipo === "venta" ? "Elige a nombre de quién va la factura." : "Elige quién paga la factura." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, mensaje: "Pon la fecha de la factura." };
  if (base == null || Number.isNaN(base) || base <= 0)
    return { ok: false, mensaje: "Escribe la base (sin IVA) solo con números." };
  if (Number.isNaN(impuesto) || impuesto < 0) return { ok: false, mensaje: "El IVA no es un número válido." };
  if (kg != null && (Number.isNaN(kg) || kg < 0)) return { ok: false, mensaje: "Los kilos no son un número válido." };
  if (tipo === "gasto" && (!categoria || !(categoria in CATEGORIAS_GASTO)))
    return { ok: false, mensaje: "Elige el tipo de gasto." };
  if (archivo && !/^\d{4}\/[\w.-]+$/.test(archivo)) return { ok: false, mensaje: "El archivo no se ha subido bien. Prueba otra vez." };

  const { error } = await supabase.from("facturas").insert({
    tipo,
    estado: tipo === "gasto" ? "emitida" : estado,
    titular_id: titular,
    finca_id: finca,
    campana: campanaDeFecha(fecha),
    fecha,
    numero: texto("numero"),
    contraparte: texto("contraparte"),
    concepto: texto("concepto"),
    kg: tipo === "venta" ? kg : null,
    base_eur: base,
    impuesto_eur: impuesto,
    categoria: tipo === "gasto" ? categoria : null,
    cuenta_limite: tipo === "venta",
    archivo_url: archivo,
    origen: "app",
  });
  if (error) {
    if (/categoria/.test(error.message))
      return { ok: false, mensaje: "Falta ejecutar la migración 0015 en Supabase para poder apuntar gastos." };
    return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };
  }
  refresh();
  return {
    ok: true,
    mensaje: tipo === "gasto" ? "Gasto apuntado." : estado === "prevista" ? "Venta prevista apuntada." : "Factura apuntada.",
    guardadoEn: Date.now(),
  };
}

export async function anularFactura(formData: FormData) {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("facturas").update({ anulado: true }).eq("id", id);
  refresh();
}

/** Una venta prevista ya se ha facturado: pasa a emitida. */
export async function marcarEmitida(formData: FormData) {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("facturas").update({ estado: "emitida" }).eq("id", id);
  refresh();
}
