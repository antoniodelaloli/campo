import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Factura, Titular } from "@/lib/cuentas-calculo";
export * from "@/lib/cuentas-calculo";

/*
 * Cuentas (migración 0014): titulares que facturan y sus facturas.
 * El límite de ventas va por AÑO NATURAL (enero a diciembre) y se mira la base
 * (sin IVA ni compensación agraria) de las ventas que cuentan para el límite.
 */

export async function cargarCuentas(supabase: SupabaseClient, anio: number) {
  const [t, f] = await Promise.all([
    supabase
      .from("titulares")
      .select("id, nombre, nombre_completo, tipo, limite_eur, tope_seguridad_eur, aviso_pct, notas")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("facturas")
      .select(
        "id, tipo, estado, titular_id, finca_id, campana, fecha, numero, contraparte, concepto, kg, base_eur, impuesto_eur, total_eur, cuenta_limite, notas",
      )
      .eq("anulado", false)
      .gte("fecha", `${anio}-01-01`)
      .lte("fecha", `${anio}-12-31`)
      .order("fecha", { ascending: false })
      .limit(2000),
  ]);
  const falta = !!t.error || !!f.error;
  const titulares: Titular[] = (t.data ?? []).map((x) => ({
    ...x,
    limite_eur: Number(x.limite_eur),
    tope_seguridad_eur: Number(x.tope_seguridad_eur),
    aviso_pct: Number(x.aviso_pct),
  }));
  const facturas: Factura[] = (f.data ?? []).map((x) => ({
    ...x,
    kg: x.kg != null ? Number(x.kg) : null,
    base_eur: Number(x.base_eur),
    impuesto_eur: Number(x.impuesto_eur),
    total_eur: Number(x.total_eur),
  }));
  return { titulares, facturas, falta, error: t.error?.message ?? f.error?.message ?? null };
}

