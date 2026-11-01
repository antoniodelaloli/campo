"use server";

import { refresh } from "next/cache";
import { contextoEscritura } from "@/lib/sesion";
import { OPCIONES_AVISO, TIPOS_HITO } from "@/lib/agenda";
import { esFechaISO, tituloDeTexto } from "@/lib/texto";

export type EstadoFormHito = {
  ok: boolean;
  mensaje: string | null;
  /** cambia en cada guardado correcto para que el formulario se vacíe */
  guardadoEn?: number;
};

const FALTA_TABLA = "Falta crear la tabla de fechas clave: ejecuta 0003_hitos.sql en Supabase.";

function mensajeError(error: { code?: string; message: string }) {
  if (error.code === "PGRST205" || error.code === "42P01") return FALTA_TABLA;
  return `No se pudo guardar: ${error.message}`;
}

export async function crearHito(_prev: EstadoFormHito, formData: FormData): Promise<EstadoFormHito> {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return { ok: false, mensaje: "Tu usuario solo puede consultar." };

  const texto = String(formData.get("texto") ?? "").trim().replace(/\s+/g, " ");
  const fecha = String(formData.get("fecha") ?? "");
  const tipo = String(formData.get("tipo") ?? "otro");
  const fincaId = String(formData.get("finca") ?? "");
  const aviso = String(formData.get("aviso") ?? OPCIONES_AVISO[0].valor);
  const nota = String(formData.get("nota") ?? "").trim();
  const aproximada = formData.get("aproximada") === "on";
  const anual = formData.get("anual") === "on";

  if (texto.length < 3) return { ok: false, mensaje: "Escribe qué fecha clave es (p. ej. «primer corte de Corvera»)." };
  if (texto.length > 200) return { ok: false, mensaje: "Demasiado largo: resúmelo un poco." };
  if (!esFechaISO(fecha) || fecha < "2020-01-01" || fecha > "2100-12-31")
    return { ok: false, mensaje: "Elige el día en «Cuándo»." };
  if (!(TIPOS_HITO as string[]).includes(tipo)) return { ok: false, mensaje: "Tipo no válido." };
  if (!OPCIONES_AVISO.some((o) => o.valor === aviso)) return { ok: false, mensaje: "Aviso no válido." };
  if (nota.length > 500) return { ok: false, mensaje: "La nota es demasiado larga (máx. 500 letras)." };

  let finca: string | null = null;
  if (fincaId) {
    const { data } = await supabase.from("fincas").select("id").eq("id", fincaId).maybeSingle<{ id: string }>();
    if (!data) return { ok: false, mensaje: "La finca elegida no existe. Vuelve a elegirla." };
    finca = data.id;
  }

  const { error } = await supabase.from("hitos").insert({
    titulo: tituloDeTexto(texto),
    texto: nota || null,
    tipo,
    finca_id: finca,
    fecha,
    fecha_aproximada: aproximada,
    avisar_dias: aviso.split(",").map(Number),
    repetir: anual ? "anual" : "no",
    origen: "app",
  });
  if (error) return { ok: false, mensaje: mensajeError(error) };

  refresh();
  return { ok: true, mensaje: "Fecha clave apuntada.", guardadoEn: Date.now() };
}

type HitoParaRepetir = {
  id: string;
  titulo: string;
  texto: string | null;
  tipo: string;
  finca_id: string | null;
  fecha: string;
  hora: string | null;
  fecha_aproximada: boolean;
  avisar_dias: number[];
  repetir: "no" | "anual";
};

/** Hecho / anulado (nunca se borra). Si se repite cada año, crea el del año siguiente. */
export async function cambiarEstadoHito(formData: FormData) {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return;

  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !["hecho", "anulado"].includes(estado)) return;

  const { data: hito } = await supabase
    .from("hitos")
    .update({ estado, hecho_en: estado === "hecho" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("estado", "pendiente")
    .select("id, titulo, texto, tipo, finca_id, fecha, hora, fecha_aproximada, avisar_dias, repetir")
    .maybeSingle<HitoParaRepetir>();

  if (hito && estado === "hecho" && hito.repetir === "anual") {
    const [y, resto] = [Number(hito.fecha.slice(0, 4)), hito.fecha.slice(4)];
    // 29 de febrero → 28 si el año siguiente no es bisiesto
    let siguiente = `${y + 1}${resto}`;
    if (!esFechaISO(siguiente)) siguiente = `${y + 1}-02-28`;
    const { data: yaExiste } = await supabase
      .from("hitos")
      .select("id")
      .eq("viene_de", hito.id)
      .maybeSingle<{ id: string }>();
    if (!yaExiste) {
      await supabase.from("hitos").insert({
        titulo: hito.titulo,
        texto: hito.texto,
        tipo: hito.tipo,
        finca_id: hito.finca_id,
        fecha: siguiente,
        hora: hito.hora,
        fecha_aproximada: hito.fecha_aproximada,
        avisar_dias: hito.avisar_dias,
        repetir: "anual",
        viene_de: hito.id,
        origen: "app",
      });
    }
  }

  refresh();
}
