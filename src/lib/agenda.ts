// Fechas clave: lo importante de la campaña, alrededor de lo que se organiza
// todo lo demás. Junta las fechas clave apuntadas (tabla «hitos») con las que
// la app calcula sola (tratamientos previstos y fin del plazo de seguridad).
// Las tareas del día a día NO son fechas clave: viven en Tareas y, como mucho,
// cuelgan de una fecha clave. Funciones puras: sirven en servidor y en cliente.
import type { Hito, TareaDeHito, TipoHito, Tratamiento } from "@/lib/datos";
import type { Tono } from "@/components/ui";
import { diasEntre, fechaCorta, normalizar, sumarDias, type TipoTarea } from "@/lib/texto";

export const NOMBRE_TIPO_HITO: Record<TipoHito, string> = {
  corte: "Corte",
  tratamiento: "Tratamiento",
  plazo: "Plazo",
  agua: "Agua",
  revision: "Revisión",
  compra: "Compra",
  otro: "Otra",
};

/** Color de cada tipo en la línea de la campaña. */
export const COLOR_TIPO_HITO: Record<TipoHito, string> = {
  corte: "#e0a02a",
  tratamiento: "#5b8c2a",
  plazo: "#a8321f",
  agua: "#2f7fb0",
  revision: "#7a5a3a",
  compra: "#8a6bb0",
  otro: "#3f8f7a",
};

export const TIPOS_HITO = Object.keys(NOMBRE_TIPO_HITO) as TipoHito[];

/** Opciones de aviso (días de antelación). La primera es la de por defecto. */
export const OPCIONES_AVISO = [
  { valor: "7,1,0", texto: "Una semana antes, el día antes y el mismo día" },
  { valor: "30,7,1", texto: "Un mes antes, una semana antes y el día antes" },
  { valor: "1,0", texto: "El día antes y el mismo día" },
  { valor: "0", texto: "Solo el mismo día" },
] as const;

/** Tipo de fecha clave a partir de lo escrito y del tipo de tarea detectado. */
export function tipoHitoDeTexto(texto: string, tipoTarea: TipoTarea | null): TipoHito {
  const t = normalizar(texto);
  if (/\b(plazo|papeles|presentar|renovar|seguro|pagar|pago|recibo|chs|declaracion|pac|carne|cuaderno)/.test(t))
    return "plazo";
  if (/\b(comprar|compra|pedir producto|encargar)/.test(t)) return "compra";
  switch (tipoTarea) {
    case "cosecha":
      return "corte";
    case "tratamiento":
      return "tratamiento";
    case "riego":
      return "agua";
    case "administrativa":
      return "plazo";
    case "revision":
    case "mantenimiento":
      return "revision";
    default:
      return "otro";
  }
}

/** Campaña citrícola que contiene una fecha: de octubre a septiembre. */
export function campanaDe(hoy: string) {
  const y = Number(hoy.slice(0, 4));
  const inicio = Number(hoy.slice(5, 7)) >= 10 ? y : y - 1;
  return {
    nombre: `${inicio}/${String(inicio + 1).slice(2)}`,
    desde: `${inicio}-10-01`,
    hasta: `${inicio + 1}-09-30`,
  };
}

export type ElementoAgenda = {
  clave: string;
  clase: "hito" | "tratamiento" | "plazo";
  titulo: string;
  detalle: string | null;
  /** null solo en los «por confirmar» */
  fecha: string | null;
  hora: string | null;
  aproximada: boolean;
  finca: string | null;
  etiqueta: string;
  tipo: TipoHito;
  href: string;
  importante: boolean;
  /** solo fechas clave apuntadas: para marcarlas como hechas */
  hitoId?: string;
  repetir?: "no" | "anual";
  /** tareas que cuelgan de esta fecha clave */
  tareas?: { id: string; titulo: string; hecha: boolean }[];
};

export type Agenda = {
  atrasados: ElementoAgenda[];
  proximos: ElementoAgenda[];
  porConfirmar: ElementoAgenda[];
};

const ESTADOS_TRATAMIENTO_HECHO = new Set(["realizada", "en_curso"]);
const TAREA_HECHA = new Set(["terminada", "verificada"]);

export function elementoDeHito(h: Hito, tareasDeHitos: TareaDeHito[] = []): ElementoAgenda {
  const tareas = tareasDeHitos
    .filter((t) => t.hito_id === h.id)
    .map((t) => ({ id: t.id, titulo: t.titulo, hecha: TAREA_HECHA.has(t.estado) }));
  return {
    clave: `h-${h.id}`,
    clase: "hito",
    titulo: h.titulo,
    detalle: h.texto,
    fecha: h.fecha,
    hora: h.hora ? h.hora.slice(0, 5) : null,
    aproximada: h.fecha_aproximada,
    finca: h.fincas?.nombre ?? null,
    etiqueta: NOMBRE_TIPO_HITO[h.tipo] ?? "Otra",
    tipo: h.tipo,
    href: `/calendario#h-${h.id}`,
    importante: h.tipo === "plazo",
    hitoId: h.id,
    repetir: h.repetir,
    tareas: tareas.length ? tareas : undefined,
  };
}

export function construirAgenda({
  hitos,
  tratamientos,
  tareasDeHitos = [],
  hoy,
  hasta,
}: {
  hitos: Hito[];
  tratamientos: Tratamiento[];
  tareasDeHitos?: TareaDeHito[];
  hoy: string;
  /** última fecha incluida (YYYY-MM-DD) */
  hasta: string;
}): Agenda {
  const lista: ElementoAgenda[] = [];
  const porConfirmar: ElementoAgenda[] = [];

  for (const h of hitos) {
    if (h.estado !== "pendiente" || h.fecha > hasta) continue;
    lista.push(elementoDeHito(h, tareasDeHitos));
  }

  const hace60 = sumarDias(hoy, -60);
  for (const tr of tratamientos) {
    const finca = tr.fincas?.nombre ?? null;

    // Tratamientos previstos: también son fechas que no se pueden pasar
    if (tr.estado === "prevista") {
      if (tr.fecha > hasta) continue;
      lista.push({
        clave: `tp-${tr.id}`,
        clase: "tratamiento",
        titulo: tr.objetivo ? `Tratamiento: ${tr.objetivo}` : "Tratamiento previsto",
        detalle: null,
        fecha: tr.fecha,
        hora: null,
        aproximada: tr.fecha_aproximada,
        finca,
        etiqueta: "Tratamiento",
        tipo: "tratamiento",
        href: "/tratamientos",
        importante: false,
      });
      continue;
    }

    // Fin del plazo de seguridad de lo ya aplicado (últimos 60 días)
    if (!ESTADOS_TRATAMIENTO_HECHO.has(tr.estado) || tr.fecha < hace60) continue;
    const productos = tr.tratamiento_productos.map((p) => p.productos).filter((p) => p !== null);
    if (productos.length === 0) continue;

    const sinPlazo = productos.filter((p) => p.plazo_seguridad_dias == null);
    if (sinPlazo.length > 0) {
      porConfirmar.push({
        clave: `ps-${tr.id}`,
        clase: "plazo",
        titulo: "Plazo de seguridad sin confirmar",
        detalle: `Tratamiento del ${fechaCorta(tr.fecha, hoy)} (${sinPlazo.map((p) => p.nombre).join(", ")}). Hasta saberlo, no se puede calcular desde cuándo cortar.`,
        fecha: null,
        hora: null,
        aproximada: false,
        finca,
        etiqueta: "Plazo",
        tipo: "plazo",
        href: "/tratamientos",
        importante: true,
      });
      continue;
    }

    const plazo = Math.max(...productos.map((p) => p.plazo_seguridad_dias ?? 0));
    const fin = sumarDias(tr.fecha, plazo);
    if (fin < hoy || fin > hasta) continue;
    lista.push({
      clave: `ps-${tr.id}`,
      clase: "plazo",
      titulo: "Fin del plazo de seguridad",
      detalle: `No cortar antes del ${fechaCorta(fin, hoy)} (tratamiento del ${fechaCorta(tr.fecha, hoy)}, ${plazo} días${
        tr.estado === "en_curso" ? "; cuenta desde la última pasada" : ""
      }).`,
      fecha: fin,
      hora: null,
      aproximada: tr.estado === "en_curso" || tr.fecha_aproximada,
      finca,
      etiqueta: "Plazo",
      tipo: "plazo",
      href: "/tratamientos",
      importante: true,
    });
  }

  lista.sort(
    (a, b) =>
      (a.fecha ?? "").localeCompare(b.fecha ?? "") ||
      (a.hora ?? "").localeCompare(b.hora ?? "") ||
      Number(b.importante) - Number(a.importante),
  );

  return {
    atrasados: lista.filter((e) => e.fecha! < hoy),
    proximos: lista.filter((e) => e.fecha! >= hoy),
    porConfirmar,
  };
}

/** «Hoy», «Mañana», «Faltan 5 días», «Hace 2 días»… y el color que le toca. */
export function cuentaAtras(fecha: string, hoy: string, aproximada = false): { texto: string; tono: Tono } {
  const d = diasEntre(hoy, fecha);
  const pre = aproximada ? "≈ " : "";
  if (d < 0) {
    const n = -d;
    return { texto: n === 1 ? "Ayer" : `Hace ${n} días`, tono: "rojo" };
  }
  if (d === 0) return { texto: `${pre}Hoy`, tono: "ambar" };
  if (d === 1) return { texto: `${pre}Mañana`, tono: "ambar" };
  if (d < 14) return { texto: `${pre}Faltan ${d} días`, tono: d <= 7 ? "azul" : "neutro" };
  if (d < 60) return { texto: `${pre}Faltan ${Math.round(d / 7)} semanas`, tono: "neutro" };
  return { texto: `${pre}Faltan ${Math.round(d / 30)} meses`, tono: "neutro" };
}

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** { dia: "15", mes: "dic" } para el calendarito de cada fila. */
export function partesFecha(iso: string) {
  const [, m, d] = iso.split("-");
  return { dia: String(Number(d)), mes: MES_CORTO[Number(m) - 1] };
}

/** "Diciembre 2026" */
export function nombreMes(iso: string) {
  const [y, m] = iso.split("-");
  return `${MES_LARGO[Number(m) - 1]} ${y}`;
}

/** "dic" */
export function mesCorto(iso: string) {
  return MES_CORTO[Number(iso.slice(5, 7)) - 1];
}
