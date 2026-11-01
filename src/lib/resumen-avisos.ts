// Texto del aviso que llega al móvil cada mañana. Función pura: recibe las
// fechas clave, los tratamientos y las tareas ya cargados y decide qué contar.
//
// - Fechas clave apuntadas: se avisa los días que diga su «Avisar»
//   (por defecto una semana antes, el día antes y el mismo día).
// - Tratamientos previstos y fin del plazo de seguridad: el día antes y el mismo día.
// - Tareas con fecha: el mismo día (sirven de recordatorio). Las que se pasaron
//   sin hacer se cuentan en una línea.
// - Lunes: repaso de la semana (los próximos 7 días), aunque no haya nada.
// - Resto de días: si no toca avisar de nada, no se manda aviso.
import type { Hito, Tarea, Tratamiento } from "@/lib/datos";
import { construirAgenda, type ElementoAgenda } from "@/lib/agenda";
import { diasEntre, normalizar, sumarDias } from "@/lib/texto";

export type ResumenAviso = {
  tipo: "diario" | "semanal";
  titulo: string;
  cuerpo: string;
  url: string;
};

const MAX_LINEAS = 5;

function cuando(d: number) {
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === 7) return "En una semana";
  if (d === 14) return "En dos semanas";
  if (d === 30) return "En un mes";
  return `En ${d} días`;
}

function conFinca(titulo: string, finca: string | null | undefined) {
  // La finca solo si el título no la dice ya («Primer corte Valladolises»)
  return finca && !normalizar(titulo).includes(normalizar(finca)) ? `${titulo} (${finca})` : titulo;
}

function linea(e: ElementoAgenda, hoy: string) {
  const d = diasEntre(hoy, e.fecha!);
  const aprox = e.aproximada ? "≈ " : "";
  return `${aprox}${cuando(d)} · ${conFinca(e.titulo, e.finca)}`;
}

function lineaTarea(t: Tarea, hoy: string) {
  const d = diasEntre(hoy, t.fecha_prevista!);
  const quien = t.tareas_personas.map((p) => p.personas?.nombre).filter(Boolean);
  return `Tarea ${cuando(d).toLowerCase()} · ${conFinca(t.titulo, t.fincas?.nombre)}${quien.length ? ` · ${quien.join(", ")}` : ""}`;
}

/** 0 = domingo … 1 = lunes, para una fecha "YYYY-MM-DD". */
export function diaSemana(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export function resumenDelDia({
  hitos,
  tratamientos,
  tareas = [],
  hoy,
}: {
  hitos: Hito[];
  tratamientos: Tratamiento[];
  /** tareas abiertas (prevista, en curso, aplazada) */
  tareas?: Tarea[];
  hoy: string;
}): ResumenAviso | null {
  const agenda = construirAgenda({ hitos, tratamientos, hoy, hasta: sumarDias(hoy, 60) });
  const avisarDias = new Map(hitos.map((h) => [h.id, h.avisar_dias ?? [7, 1, 0]]));
  const atrasadas = agenda.atrasados.filter((e) => e.clase === "hito");
  const esLunes = diaSemana(hoy) === 1;
  const semana = sumarDias(hoy, 7);

  // Fechas clave y plazos
  let lista: ElementoAgenda[];
  if (esLunes) {
    lista = agenda.proximos.filter((e) => e.fecha! <= semana);
  } else {
    lista = agenda.proximos.filter((e) => {
      const d = diasEntre(hoy, e.fecha!);
      if (e.clase === "hito") return (avisarDias.get(e.hitoId!) ?? [7, 1, 0]).includes(d);
      return d <= 1;
    });
  }

  // Tareas con fecha: las de hoy (lunes: las de la semana) y las que se pasaron
  const conFecha = tareas.filter((t) => t.fecha_prevista);
  const tareasAviso = conFecha
    .filter((t) => (esLunes ? t.fecha_prevista! >= hoy && t.fecha_prevista! <= semana : t.fecha_prevista === hoy))
    .sort((a, b) => a.fecha_prevista!.localeCompare(b.fecha_prevista!));
  // «en curso» empezadas antes no cuentan como atrasadas: ya se están haciendo
  const tareasAtrasadas = conFecha.filter((t) => t.fecha_prevista! < hoy && t.estado !== "en_curso");

  const hayAlgo = lista.length > 0 || tareasAviso.length > 0;
  if (!esLunes && !hayAlgo) return null;

  const todas = [...lista.map((e) => linea(e, hoy)), ...tareasAviso.map((t) => lineaTarea(t, hoy))];
  const lineas = todas.slice(0, MAX_LINEAS);
  if (todas.length > MAX_LINEAS) lineas.push(`y ${todas.length - MAX_LINEAS} más`);
  if (atrasadas.length > 0) {
    lineas.push(
      atrasadas.length === 1
        ? `Sin marcar como hecha: «${atrasadas[0].titulo}» (ya pasó)`
        : `${atrasadas.length} fechas clave ya pasaron sin marcar como hechas`,
    );
  }
  if (tareasAtrasadas.length > 0) {
    lineas.push(
      tareasAtrasadas.length === 1
        ? `Tarea sin hacer de otro día: «${tareasAtrasadas[0].titulo}»`
        : `${tareasAtrasadas.length} tareas de otros días siguen sin hacer`,
    );
  }
  if (esLunes && !hayAlgo) {
    lineas.unshift("Semana tranquila: nada apuntado para los próximos 7 días.");
  }

  const claveHoy = lista.find((e) => e.fecha === hoy);
  const tareasHoy = tareasAviso.filter((t) => t.fecha_prevista === hoy);
  const titulo = esLunes
    ? "Campo · la semana"
    : claveHoy
      ? `Campo · hoy: ${claveHoy.titulo}`
      : tareasHoy.length === 1
        ? `Campo · hoy: ${tareasHoy[0].titulo}`
        : tareasHoy.length > 1
          ? `Campo · hoy: ${tareasHoy.length} tareas`
          : "Campo · lo que viene";

  // Adónde lleva el aviso: a esa fecha clave si es la única, a Tareas si solo hay tareas
  const url =
    lista.length === 1 && tareasAviso.length === 0 && atrasadas.length === 0
      ? lista[0].href
      : lista.length === 0 && tareasAviso.length > 0
        ? "/tareas"
        : "/calendario";

  return {
    tipo: esLunes ? "semanal" : "diario",
    titulo: titulo.length > 60 ? `${titulo.slice(0, 57)}…` : titulo,
    cuerpo: lineas.join("\n"),
    url,
  };
}
