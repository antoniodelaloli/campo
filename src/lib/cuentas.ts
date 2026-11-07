import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enModulosPorDefecto, type Factura, type Socio, type Titular } from "@/lib/cuentas-calculo";
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

  const titularesCon = (columnas: string) => supabase.from("titulares").select(columnas).eq("activo", true).order("nombre");
  const BASE_T = "id, nombre, nombre_completo, tipo, limite_eur, tope_seguridad_eur, aviso_pct, notas";
  const [t0, f0, so] = await Promise.all([
    titularesCon(`${BASE_T}, en_modulos`),
    facturasDe(`${COLUMNAS}, categoria, archivo_url`),
    // socios de las sociedades (migración 0021); sin ella, lista vacía
    supabase.from("titular_socios").select("sociedad_id, socio_id, participacion"),
  ]);
  // sin la migración 0023 no hay «en_modulos»: se deduce (Chelo no está en módulos)
  let t = t0;
  let falta0023 = false;
  if (t0.error && /en_modulos/.test(t0.error.message)) {
    falta0023 = true;
    t = await titularesCon(BASE_T);
  }
  const socios: Socio[] = (so.data ?? []).map((x) => ({ ...x, participacion: Number(x.participacion) }));
  // sin la migración 0015 no hay «categoria» ni archivos: se lee lo de antes
  let f = f0;
  let falta0015 = false;
  if (f0.error && /categoria|archivo_url/.test(f0.error.message)) {
    falta0015 = true;
    f = await facturasDe(COLUMNAS);
  }

  const falta = !!t.error || !!f.error;
  const filasT = (t.data ?? []) as unknown as (Omit<Titular, "en_modulos"> & { en_modulos?: boolean | null })[];
  const titulares: Titular[] = filasT.map((x) => ({
    ...x,
    en_modulos: x.en_modulos ?? enModulosPorDefecto(x),
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
  return { titulares, facturas, socios, falta, falta0015, falta0021: !!so.error, falta0023, error: t.error?.message ?? f.error?.message ?? null };
}

/**
 * Titulares a cuyo nombre se puede facturar (para los desplegables de «Se
 * factura a»): todos menos los que no están en módulos (Chelo). Devuelve también
 * todos, para poner nombre a lo que ya esté apuntado.
 */
export async function cargarTitulares(supabase: SupabaseClient) {
  let r = await supabase.from("titulares").select("id, nombre, tipo, en_modulos").eq("activo", true).order("nombre");
  if (r.error && /en_modulos/.test(r.error.message)) {
    r = (await supabase.from("titulares").select("id, nombre, tipo").eq("activo", true).order("nombre")) as typeof r;
  }
  const todos = ((r.data ?? []) as { id: string; nombre: string; tipo: string; en_modulos?: boolean | null }[]).map((x) => ({
    id: x.id,
    nombre: x.nombre,
    en_modulos: x.en_modulos ?? enModulosPorDefecto(x),
  }));
  return {
    todos: todos.map(({ id, nombre }) => ({ id, nombre })),
    facturan: todos.filter((x) => x.en_modulos).map(({ id, nombre }) => ({ id, nombre })),
  };
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
