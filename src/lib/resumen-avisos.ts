// Texto del aviso que llega al móvil cada mañana. Función pura: recibe las
// fechas clave y los tratamientos ya cargados y decide qué contar.
//
// - Fechas clave apuntadas: se avisa los días que diga su «Avisar»
//   (por defecto una semana antes, el día antes y el mismo día).
// - Tratamientos previstos y fin del plazo de seguridad: el día antes y el mismo día.
// - Lunes: repaso de la semana (los próximos 7 días), aunque no haya nada.
// - Resto de días: si no toca avisar de nada, no se manda aviso.
import type { Hito, Tratamiento } from "@/lib/datos";
import { construirAgenda, type ElementoAgenda } from "@/lib/agenda";
import { diasEntre, normalizar, sumarDias } from "@/lib/texto";

export type ResumenAviso = {
  tipo: "diario" | "semanal";
  titulo: string;
  cuerpo: string;
  url: string;
};

const MAX_LINEAS = 4;

function cuando(d: number) {
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === 7) return "En una semana";
  if (d === 14) return "En dos semanas";
  if (d === 30) return "En un mes";
  return `En ${d} días`;
}

function linea(e: ElementoAgenda, hoy: string) {
  const d = diasEntre(hoy, e.fecha!);
  const aprox = e.aproximada ? "≈ " : "";
  // La finca solo si el título no la dice ya («Primer corte Valladolises»)
  const finca = e.finca && !normalizar(e.titulo).includes(normalizar(e.finca)) ? ` (${e.finca})` : "";
  return `${aprox}${cuando(d)} · ${e.titulo}${finca}`;
}

/** 0 = domingo … 1 = lunes, para una fecha "YYYY-MM-DD". */
export function diaSemana(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export function resumenDelDia({
  hitos,
  tratamientos,
  hoy,
}: {
  hitos: Hito[];
  tratamientos: Tratamiento[];
  hoy: string;
}): ResumenAviso | null {
  const agenda = construirAgenda({ hitos, tratamientos, hoy, hasta: sumarDias(hoy, 60) });
  const avisarDias = new Map(hitos.map((h) => [h.id, h.avisar_dias ?? [7, 1, 0]]));
  const atrasadas = agenda.atrasados.filter((e) => e.clase === "hito");
  const esLunes = diaSemana(hoy) === 1;

  let lista: ElementoAgenda[];
  if (esLunes) {
    const semana = sumarDias(hoy, 7);
    lista = agenda.proximos.filter((e) => e.fecha! <= semana);
  } else {
    lista = agenda.proximos.filter((e) => {
      const d = diasEntre(hoy, e.fecha!);
      if (e.clase === "hito") return (avisarDias.get(e.hitoId!) ?? [7, 1, 0]).includes(d);
      return d <= 1;
    });
  }

  if (!esLunes && lista.length === 0) return null;

  const lineas = lista.slice(0, MAX_LINEAS).map((e) => linea(e, hoy));
  if (lista.length > MAX_LINEAS) lineas.push(`y ${lista.length - MAX_LINEAS} más`);
  if (atrasadas.length > 0) {
    lineas.push(
      atrasadas.length === 1
        ? `Sin marcar como hecha: «${atrasadas[0].titulo}» (ya pasó)`
        : `${atrasadas.length} fechas clave ya pasaron sin marcar como hechas`,
    );
  }
  if (esLunes && lista.length === 0) {
    lineas.unshift("Semana tranquila: ninguna fecha clave en los próximos 7 días.");
  }

  const hoyHay = lista.some((e) => e.fecha === hoy);
  const titulo = esLunes
    ? "Campo · la semana"
    : hoyHay
      ? `Campo · hoy: ${lista.find((e) => e.fecha === hoy)!.titulo}`
      : "Campo · lo que viene";

  // Si solo hay una cosa, el aviso abre directamente esa fecha clave
  const url = lista.length === 1 && atrasadas.length === 0 ? lista[0].href : "/calendario";

  return {
    tipo: esLunes ? "semanal" : "diario",
    titulo: titulo.length > 60 ? `${titulo.slice(0, 57)}…` : titulo,
    cuerpo: lineas.join("\n"),
    url,
  };
}
