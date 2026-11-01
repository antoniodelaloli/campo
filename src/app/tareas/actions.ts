"use server";

import { refresh } from "next/cache";
import { contextoEscritura } from "@/lib/sesion";
import { cargarFincas, lugaresDe } from "@/lib/datos";
import { hoyISO, interpretarTarea, tituloDeTexto, type Lugar } from "@/lib/texto";

export type EstadoFormTarea = {
  ok: boolean;
  mensaje: string | null;
  /** cambia en cada guardado correcto para que el formulario se vacíe */
  guardadoEn?: number;
};

type FilaResolver = {
  tipo: "finca" | "zona" | "sector";
  id: string;
  finca_id: string;
  nombre: string;
};

export async function crearTarea(
  _prev: EstadoFormTarea,
  formData: FormData,
): Promise<EstadoFormTarea> {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return { ok: false, mensaje: "Tu usuario solo puede consultar." };

  const texto = String(formData.get("texto") ?? "").trim();
  if (texto.length < 3) return { ok: false, mensaje: "Escribe qué hay que hacer." };
  if (texto.length > 300) return { ok: false, mensaje: "Demasiado largo: resúmelo un poco." };

  const eleccion = String(formData.get("lugar") ?? ""); // "tipo:id" elegido a mano
  const fechaManual = String(formData.get("fecha") ?? "");
  const personaId = String(formData.get("persona") ?? "");
  const hitoId = String(formData.get("hito") ?? "");

  const hoy = hoyISO();
  const { fincas } = await cargarFincas(supabase);
  const lugares = lugaresDe(fincas);
  const lectura = interpretarTarea(texto, lugares, hoy);
  if (!lectura) return { ok: false, mensaje: "Escribe qué hay que hacer." };

  // 1) ¿Dónde? Primero lo elegido a mano; si no, lo que diga resolver_ubicacion().
  let lugar: Lugar | FilaResolver | null = null;
  if (eleccion && eleccion !== "ninguno") {
    const [tipo, id] = eleccion.split(":");
    lugar = lugares.find((l) => l.tipo === tipo && l.id === id) ?? null;
    if (!lugar) return { ok: false, mensaje: "El lugar elegido no existe. Vuelve a elegirlo." };
  } else if (lectura.frase && eleccion !== "ninguno") {
    const { data, error } = await supabase.rpc("resolver_ubicacion", { q: lectura.frase });
    if (error) return { ok: false, mensaje: `No se pudo comprobar el lugar: ${error.message}` };
    let filas = (data ?? []) as FilaResolver[];
    // si el texto ya señalaba una finca concreta, nos quedamos con sus filas
    const fincasPreview = new Set(lectura.candidatos.map((c) => c.finca_id));
    if (filas.length > 1 && fincasPreview.size === 1) {
      filas = filas.filter((f) => fincasPreview.has(f.finca_id));
    }
    if (filas.length === 1) lugar = filas[0];
    else if (filas.length > 1)
      return { ok: false, mensaje: `«${lectura.frase}» está en varias fincas: elige cuál.` };
  }

  // 2) ¿Cuándo?
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaManual) ? fechaManual : lectura.fecha;

  // 3) ¿Cuelga de una fecha clave?
  if (hitoId) {
    const { data: hito } = await supabase
      .from("hitos")
      .select("id")
      .eq("id", hitoId)
      .eq("estado", "pendiente")
      .maybeSingle<{ id: string }>();
    if (!hito) return { ok: false, mensaje: "La fecha clave elegida ya no está pendiente. Vuelve a elegirla." };
  }

  const { data: tarea, error } = await supabase
    .from("tareas")
    .insert({
      titulo: tituloDeTexto(texto),
      tipo: lectura.tipo,
      estado: "prevista",
      fecha_prevista: fecha,
      finca_id: lugar ? lugar.finca_id : null,
      zona_id: lugar?.tipo === "zona" ? lugar.id : null,
      sector_id: lugar?.tipo === "sector" ? lugar.id : null,
      // se guarda siempre cómo se dijo; si no se resolvió, sirve para resolverlo después
      ubicacion_texto: lectura.frase,
      origen: "app",
      ...(hitoId ? { hito_id: hitoId } : {}),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !tarea) {
    return { ok: false, mensaje: `No se pudo guardar: ${error?.message ?? "error desconocido"}` };
  }

  if (personaId) {
    const { error: errorPersona } = await supabase
      .from("tareas_personas")
      .insert({ tarea_id: tarea.id, persona_id: personaId });
    if (errorPersona) {
      refresh();
      return {
        ok: true,
        mensaje: "Tarea guardada, pero no se pudo asignar a la persona.",
        guardadoEn: Date.now(),
      };
    }
  }

  refresh();
  return { ok: true, mensaje: "Tarea guardada.", guardadoEn: Date.now() };
}

const ESTADOS_PERMITIDOS = ["prevista", "en_curso", "terminada", "aplazada"] as const;

export async function cambiarEstadoTarea(formData: FormData) {
  const { supabase, puedeEditar } = await contextoEscritura();
  if (!puedeEditar) return;

  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !(ESTADOS_PERMITIDOS as readonly string[]).includes(estado)) return;

  await supabase
    .from("tareas")
    .update({
      estado,
      completada_en: estado === "terminada" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  refresh();
}
