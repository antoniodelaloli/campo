// Texto del aviso que llega al móvil cada mañana. Función pura: recibe las
// fechas clave, los tratamientos y las tareas ya cargados y decide qué contar.
//
// - Fechas clave apuntadas: se avisa los días que diga su «Avisar»
//   (por defecto una semana antes, el día antes y el mismo día).
// - Tratamientos previstos y fin del plazo de seguridad: el día antes y el mismo día.
// - Tareas con fecha: el mismo día (sirven de recordatorio). Las que se pasaron
//   sin hacer se cuentan en una línea.
// - Granizo o tormenta previstos en los próximos días: SIEMPRE, arriba y como
//   «MUY IMPORTANTE» (el aviso se queda en pantalla hasta que se toca).
// - Tratamiento previsto en los próximos días con viento ese día: aviso de que no
//   es buen día para fumigar y cuál es el siguiente día tranquilo.
// - Lunes: repaso de la semana (los próximos 7 días), aunque no haya nada.
// - «El dato del día» (lib/dato-del-dia.ts): una curiosidad o KPI de cómo va la
//   campaña, al final. Con él hay aviso todos los días aunque no haya nada más.
// - Sin dato y sin nada que avisar, no se manda aviso.
import type { Hito, Tarea, Tratamiento } from "@/lib/datos";
import { construirAgenda, type ElementoAgenda } from "@/lib/agenda";
import { diasEntre, normalizar, sumarDias } from "@/lib/texto";

export type ResumenAviso = {
  tipo: "diario" | "semanal";
  titulo: string;
  cuerpo: string;
  url: string;
  /** hay granizo o tormenta a la vista: el aviso no se quita solo */
  importante?: boolean;
};

/** Granizo o tormenta previstos para un día (ver lib/alertas-tiempo.ts). */
export type AlertaTiempo = { fecha: string; tipo: "granizo" | "tormenta"; fincas: string[] };

/** Viento previsto en una finca en las horas de fumigar (ver lib/alertas-tiempo.ts). */
export type VientoDia = { fecha: string; finca: string; kmh: number; rachas: number; apto: boolean };

/** Hasta cuántos días antes se avisa de viento para un tratamiento previsto. */
const DIAS_AVISO_VIENTO = 3;

function lineasViento(tratamientos: Tratamiento[], viento: VientoDia[], hoy: string) {
  const limite = sumarDias(hoy, DIAS_AVISO_VIENTO);
  const lineas: string[] = [];
  const vistos = new Set<string>();
  for (const t of tratamientos) {
    if (t.estado !== "prevista" && t.estado !== "en_curso") continue;
    // En curso: lo que importa es hoy. Previsto: el día que está puesto.
    const fecha = t.estado === "en_curso" ? hoy : t.fecha;
    const finca = t.fincas?.nombre;
    if (!finca || fecha < hoy || fecha > limite) continue;
    const clave = `${finca}|${fecha}`;
    if (vistos.has(clave)) continue;
    const dia = viento.find((v) => v.finca === finca && v.fecha === fecha);
    if (!dia || dia.apto) continue;
    vistos.add(clave);
    // El siguiente día tranquilo después del previsto; si no hay, el más cercano antes
    const tranquilos = viento.filter((v) => v.finca === finca && v.fecha >= hoy && v.fecha !== fecha && v.apto);
    const mejor = tranquilos.find((v) => v.fecha > fecha) ?? tranquilos.findLast((v) => v.fecha < fecha);
    lineas.push(
      `💨 Viento ${cuandoAlerta(fecha, hoy)} en ${finca} (${dia.kmh} km/h, rachas de ${dia.rachas}): no es buen día para fumigar` +
        (mejor ? ` · mejor ${cuandoAlerta(mejor.fecha, hoy).toLowerCase()}` : " · y los próximos días tampoco pinta bien"),
    );
  }
  return lineas;
}

const DIA_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function cuandoAlerta(fecha: string, hoy: string) {
  const d = diasEntre(hoy, fecha);
  if (d === 0) return "HOY";
  if (d === 1) return "MAÑANA";
  return `el ${DIA_SEMANA[diaSemana(fecha)]} ${Number(fecha.slice(8, 10))}`;
}

function lineaAlerta(a: AlertaTiempo, hoy: string) {
  const fincas = a.fincas.length === 3 ? "en las tres fincas" : `en ${a.fincas.join(" y ")}`;
  return a.tipo === "granizo"
    ? `⚠️ MUY IMPORTANTE: posible GRANIZO ${cuandoAlerta(a.fecha, hoy)} ${fincas}`
    : `⚠️ Tormenta ${cuandoAlerta(a.fecha, hoy)} ${fincas}: vigilar si trae granizo`;
}

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
  alertas = [],
  viento = [],
  dato = null,
  hoy,
}: {
  hitos: Hito[];
  tratamientos: Tratamiento[];
  /** tareas abiertas (prevista, en curso, aplazada) */
  tareas?: Tarea[];
  /** granizo y tormentas previstos (próximos días) */
  alertas?: AlertaTiempo[];
  /** viento en horas de fumigar por finca y día */
  viento?: VientoDia[];
  /** el dato del día (curiosidad o KPI), si lo hay */
  dato?: string | null;
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

  const alertasVigentes = alertas.filter((a) => a.fecha >= hoy).slice(0, 3);
  const granizo = alertasVigentes.filter((a) => a.tipo === "granizo");
  const hayAlgo = lista.length > 0 || tareasAviso.length > 0;
  const avisosViento = lineasViento(tratamientos, viento, hoy);
  const soloDato = !esLunes && !hayAlgo && alertasVigentes.length === 0 && avisosViento.length === 0;
  if (soloDato && !dato) return null;

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
  // El tiempo, siempre lo primero: granizo y tormentas, luego el viento para fumigar
  lineas.unshift(...alertasVigentes.map((a) => lineaAlerta(a, hoy)), ...avisosViento);
  // El dato del día, al final
  if (dato) lineas.push(dato);

  const claveHoy = lista.find((e) => e.fecha === hoy);
  const tareasHoy = tareasAviso.filter((t) => t.fecha_prevista === hoy);
  const titulo = granizo.length
    ? `⚠️ Campo · posible GRANIZO ${cuandoAlerta(granizo[0].fecha, hoy).toLowerCase()}`
    : avisosViento.length
    ? "Campo · viento: no es día de fumigar"
    : esLunes
    ? "Campo · la semana"
    : claveHoy
      ? `Campo · hoy: ${claveHoy.titulo}`
      : tareasHoy.length === 1
        ? `Campo · hoy: ${tareasHoy[0].titulo}`
        : tareasHoy.length > 1
          ? `Campo · hoy: ${tareasHoy.length} tareas`
          : soloDato
            ? "Campo · buenos días"
            : "Campo · lo que viene";

  // Adónde lleva el aviso: a esa fecha clave si es la única, a Tareas si solo hay tareas
  const url = soloDato
    ? "/"
    : avisosViento.length && alertasVigentes.length === 0
      ? "/tratamientos"
      : lista.length === 1 && tareasAviso.length === 0 && atrasadas.length === 0
      ? lista[0].href
      : lista.length === 0 && tareasAviso.length > 0
        ? "/tareas"
        : "/calendario";

  return {
    tipo: esLunes ? "semanal" : "diario",
    titulo: titulo.length > 60 ? `${titulo.slice(0, 57)}…` : titulo,
    cuerpo: lineas.join("\n"),
    url,
    importante: alertasVigentes.length > 0,
  };
}
