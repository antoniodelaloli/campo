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

// ---------------------------------------------------------------- albarán a albarán

export type EstadoApuntar = { ok: boolean; mensaje: string | null; guardadoEn?: number };

const numeroForm = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return null;
  // «11.735» y «11735» son kilos; «1162,5» o «1162.5» llevan decimales
  const limpio = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Apunta un albarán (un camión) en una hoja de Campo, a mano, mientras se pasan
 * los papeles. Si trae pesada (bruto y taras), los kilos son bruto − tara del
 * camión − tara de las cajas, salvo que se escriban otros a mano.
 */
export async function apuntarAlbaran(_prev: EstadoApuntar, formData: FormData): Promise<EstadoApuntar> {
  const { supabase, puedeAdministrar } = await contextoEscritura();
  if (!puedeAdministrar) return { ok: false, mensaje: "Tu usuario solo puede consultar." };

  const campana = String(formData.get("campana") ?? "").trim();
  const hoja = String(formData.get("hoja") ?? "").trim().slice(0, 300);
  const finca = String(formData.get("finca") ?? "") || null;
  const titular = String(formData.get("titular") ?? "") || null;
  const corteTxt = String(formData.get("corte") ?? "").trim();
  const corte = corteTxt ? Number(corteTxt) : null;
  const albaran = String(formData.get("albaran") ?? "").trim().slice(0, 40);
  const fecha = String(formData.get("fecha") ?? "").trim();
  const cajas = numeroForm(formData.get("cajas"));
  const bruto = numeroForm(formData.get("bruto"));
  const taraCamion = numeroForm(formData.get("tara_camion"));
  let taraCajas = numeroForm(formData.get("tara_cajas"));
  let kgBuenos = numeroForm(formData.get("kg_buenos"));
  const kgCitrica = numeroForm(formData.get("kg_citrica")) ?? 0;
  const precio = numeroForm(formData.get("precio"));
  const notas = String(formData.get("notas") ?? "").trim().slice(0, 500) || null;

  if (!/^\d{4}\/\d{2}$/.test(campana) || !hoja) return { ok: false, mensaje: "Falta la hoja o la campaña." };
  if (!albaran) return { ok: false, mensaje: "Pon el nº de albarán (o «s/n» si no tiene)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, mensaje: "Pon la fecha del albarán." };
  const ini = Number(campana.slice(0, 4));
  if (fecha < `${ini}-05-01` || fecha > `${ini + 1}-04-30`) return { ok: false, mensaje: `La fecha no es de la campaña ${campana} (mayo a abril).` };
  for (const [nombre, v] of [["cajas", cajas], ["bruto", bruto], ["tara del camión", taraCamion], ["tara de las cajas", taraCajas], ["kilos buenos", kgBuenos], ["kilos de cítrica", kgCitrica], ["precio", precio]] as const)
    if (v != null && (Number.isNaN(v) || v < 0)) return { ok: false, mensaje: `Revisa «${nombre}»: tiene que ser un número.` };

  // pesada: si hay bruto y tara del camión, los kilos salen de la resta
  if (bruto && taraCamion != null) {
    if (taraCajas == null) taraCajas = (cajas ?? 0) * 2.5;
    const neto = bruto - taraCamion - taraCajas;
    if (neto <= 0) return { ok: false, mensaje: "Con esa pesada salen 0 kilos o menos: revisa el bruto y las taras." };
    if (kgBuenos == null) kgBuenos = neto;
  }
  if ((kgBuenos ?? 0) <= 0 && kgCitrica <= 0) return { ok: false, mensaje: "Faltan los kilos (buenos o de cítrica)." };

  const { error } = await supabase.from("albaranes").insert({
    campana,
    hoja,
    finca_id: finca,
    titular_id: titular,
    corte: corte != null && Number.isInteger(corte) && corte >= 1 && corte <= 9 ? corte : null,
    albaran,
    fecha,
    cajas: cajas ? Math.round(cajas) : null,
    bruto_kg: bruto || null,
    tara_camion_kg: bruto ? taraCamion : null,
    tara_cajas_kg: bruto ? taraCajas : null,
    kg_buenos: kgBuenos ?? 0,
    kg_citrica: kgCitrica,
    importe_eur: precio != null && (kgBuenos ?? 0) > 0 ? Math.round((kgBuenos ?? 0) * precio * 100) / 100 : null,
    notas,
    origen: "app",
  });
  if (error) return { ok: false, mensaje: `No se pudo guardar: ${error.message}` };
  refresh();
  return {
    ok: true,
    mensaje: `Albarán ${albaran} apuntado: ${new Intl.NumberFormat("es-ES").format(Math.round(kgBuenos ?? 0))} kg buenos${kgCitrica ? ` y ${new Intl.NumberFormat("es-ES").format(Math.round(kgCitrica))} de cítrica` : ""}.`,
    guardadoEn: Date.now(),
  };
}

/** Quita (anula) un albarán apuntado por error. */
export async function quitarAlbaran(formData: FormData) {
  const { supabase, puedeAdministrar } = await contextoEscritura();
  if (!puedeAdministrar) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("albaranes").update({ anulado: true }).eq("id", id);
  refresh();
}
