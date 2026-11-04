"use server";

import { refresh } from "next/cache";
import { contextoEscritura } from "@/lib/sesion";
import { campanaDeFecha } from "@/lib/cuentas";

export type EstadoFormCuentas = { ok: boolean; mensaje: string | null; guardadoEn?: number };

/** «12.345,67» o «12345.67» → 12345.67 */
function importe(v: FormDataEntryValue | null): number | null {
  let s = String(v ?? "").trim().replace(/\s|€/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export async function guardarFactura(_prev: EstadoFormCuentas, formData: FormData): Promise<EstadoFormCuentas> {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return { ok: false, mensaje: "Tu usuario solo puede consultar." };

  const titular = String(formData.get("titular") ?? "");
  const finca = String(formData.get("finca") ?? "") || null;
  const fecha = String(formData.get("fecha") ?? "");
  const estado = formData.get("estado") === "prevista" ? "prevista" : "emitida";
  const base = importe(formData.get("base"));
  const impuesto = importe(formData.get("impuesto")) ?? 0;
  const kg = importe(formData.get("kg"));
  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null;

  if (!titular) return { ok: false, mensaje: "Elige a nombre de quién va la factura." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, mensaje: "Pon la fecha de la factura." };
  if (base == null || Number.isNaN(base) || base <= 0)
    return { ok: false, mensaje: "Escribe la base (sin IVA ni compensación) solo con números." };
  if (Number.isNaN(impuesto) || impuesto < 0) return { ok: false, mensaje: "El IVA o compensación no es un número válido." };
  if (kg != null && (Number.isNaN(kg) || kg < 0)) return { ok: false, mensaje: "Los kilos no son un número válido." };

  const { error } = await supabase.from("facturas").insert({
    tipo: "venta",
    estado,
    titular_id: titular,
    finca_id: finca,
    campana: campanaDeFecha(fecha),
    fecha,
    numero: texto("numero"),
    contraparte: texto("contraparte"),
    concepto: texto("concepto"),
    kg,
    base_eur: base,
    impuesto_eur: impuesto,
    notas: texto("notas"),
    origen: "app",
  });
  if (error) return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };
  refresh();
  return { ok: true, mensaje: estado === "prevista" ? "Venta prevista apuntada." : "Factura apuntada.", guardadoEn: Date.now() };
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
