import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Factura, Titular } from "@/lib/cuentas-calculo";
export * from "@/lib/cuentas-calculo";

/*
 * Cuentas (migración 0014): titulares que facturan y sus facturas.
 * El límite de ventas va por AÑO NATURAL (enero a diciembre) y se mira la base
 * (sin IVA ni compensación agraria) de las ventas que cuentan para el límite.
 */

const COLUMNAS =
  "id, tipo, estado, titular_id, finca_id, campana, fecha, numero, contraparte, concepto, kg, base_eur, impuesto_eur, total_eur, cuenta_limite, notas";

export async function cargarCuentas(supabase: SupabaseClient, anio: number) {
  const facturasDe = (columnas: string) =>
    supabase
      .from("facturas")
      .select(columnas)
      .eq("anulado", false)
      .gte("fecha", `${anio}-01-01`)
      .lte("fecha", `${anio}-12-31`)
      .order("fecha", { ascending: false })
      .limit(2000);

  const [t, f0] = await Promise.all([
    supabase
      .from("titulares")
      .select("id, nombre, nombre_completo, tipo, limite_eur, tope_seguridad_eur, aviso_pct, notas")
      .eq("activo", true)
      .order("nombre"),
    facturasDe(`${COLUMNAS}, categoria, archivo_url`),
  ]);
  // sin la migración 0015 no hay «categoria» ni archivos: se lee lo de antes
  let f = f0;
  let falta0015 = false;
  if (f0.error && /categoria|archivo_url/.test(f0.error.message)) {
    falta0015 = true;
    f = await facturasDe(COLUMNAS);
  }

  const falta = !!t.error || !!f.error;
  const titulares: Titular[] = (t.data ?? []).map((x) => ({
    ...x,
    limite_eur: Number(x.limite_eur),
    tope_seguridad_eur: Number(x.tope_seguridad_eur),
    aviso_pct: Number(x.aviso_pct),
  }));
  const filas = (f.data ?? []) as unknown as (Omit<Factura, "categoria" | "archivo_url"> & {
    categoria?: string | null;
    archivo_url?: string | null;
  })[];
  const facturas: Factura[] = filas.map((x) => ({
    ...x,
    kg: x.kg != null ? Number(x.kg) : null,
    base_eur: Number(x.base_eur),
    impuesto_eur: Number(x.impuesto_eur),
    total_eur: Number(x.total_eur),
    categoria: x.categoria ?? null,
    archivo_url: x.archivo_url ?? null,
  }));
  return { titulares, facturas, falta, falta0015, error: t.error?.message ?? f.error?.message ?? null };
}

/** Enlaces temporales (1 hora) para ver los archivos de las facturas. */
export async function enlacesArchivos(supabase: SupabaseClient, rutas: string[]) {
  const mapa = new Map<string, string>();
  if (rutas.length === 0) return mapa;
  const { data } = await supabase.storage.from("facturas").createSignedUrls(rutas, 3600);
  for (const d of data ?? []) if (d.path && d.signedUrl) mapa.set(d.path, d.signedUrl);
  return mapa;
}

/** Facturas (ventas y gastos) de una campaña, sea cual sea su año fiscal. */
export async function cargarFacturasCampana(supabase: SupabaseClient, campana: string) {
  const de = (columnas: string) =>
    supabase.from("facturas").select(columnas).eq("anulado", false).eq("campana", campana).limit(5000);
  let r = await de(`${COLUMNAS}, categoria, archivo_url`);
  if (r.error && /categoria|archivo_url/.test(r.error.message)) r = await de(COLUMNAS);
  if (r.error) return { facturas: [] as Factura[], falta: true };
  const filas = (r.data ?? []) as unknown as (Omit<Factura, "categoria" | "archivo_url"> & {
    categoria?: string | null;
    archivo_url?: string | null;
  })[];
  return {
    facturas: filas.map((x) => ({
      ...x,
      kg: x.kg != null ? Number(x.kg) : null,
      base_eur: Number(x.base_eur),
      impuesto_eur: Number(x.impuesto_eur),
      total_eur: Number(x.total_eur),
      categoria: x.categoria ?? null,
      archivo_url: x.archivo_url ?? null,
    })),
    falta: false,
  };
}
