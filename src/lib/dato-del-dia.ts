import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarFincas, ultimoNivel, type Finca } from "@/lib/datos";
import { cargarRiegos, inicioCampana, resumenAgua, type Riego } from "@/lib/riegos";
import { cargarCuentas, situacion, type SituacionTitular } from "@/lib/cuentas";
import { diasEntre, formatoNumero, sumarDias } from "@/lib/texto";

/*
 * «El dato del día» para el aviso de cada mañana y para «resumen_del_dia» del
 * conector: una curiosidad o KPI corto sobre cómo va la campaña.
 *
 * Cada día toca uno distinto (se van turnando según el día del año), entre los
 * que tienen datos. Hay uno que se adelanta siempre: si algún titular pasa del
 * % de aviso del límite de ventas, se dice ese.
 *
 * Para añadir uno nuevo: una función más en CANDIDATOS que devuelva el texto
 * (o null si no hay datos para decirlo).
 */

export type DatosDelDia = {
  hoy: string;
  riegos: Riego[];
  fincas: Finca[];
  titulares: SituacionTitular[];
  ideasSemana: number;
};

const m3 = (n: number) => `${formatoNumero(Math.round(n))} m³`;
const eur = (n: number) => `${formatoNumero(Math.round(n))} €`;

function pct(a: number, b: number) {
  return Math.round(((a - b) / b) * 100);
}

/** «un 30 % menos» / «un 12 % más» / «lo mismo» */
function comparado(a: number, b: number) {
  const p = pct(a, b);
  if (Math.abs(p) < 2) return "prácticamente lo mismo";
  return `un ${Math.abs(p)} % ${p < 0 ? "menos" : "más"}`;
}

type Candidato = (d: DatosDelDia) => string | null;

const CANDIDATOS: Record<string, Candidato> = {
  // Agua de la campaña frente al año pasado a estas fechas
  agua_campana: ({ riegos, hoy }) => {
    const r = resumenAgua(riegos, hoy);
    const c = r.comparacion;
    if (!c || !c.anioPasado.m3 || !r.actual.m3) return null;
    return `💧 Agua de Valladolises: desde el ${Number(c.desde.slice(8, 10))}/${Number(c.desde.slice(5, 7))} llevamos ${m3(c.esteAnio.m3)}, ${comparado(c.esteAnio.m3, c.anioPasado.m3)} que el año pasado por estas fechas (${m3(c.anioPasado.m3)}).`;
  },

  // Agua de los últimos 30 días frente a los mismos días del año pasado
  agua_mes: ({ riegos, hoy }) => {
    const desde = sumarDias(hoy, -30);
    const desdeP = sumarDias(desde, -365);
    const hastaP = sumarDias(hoy, -365);
    if (!riegos.length || riegos[0].fecha > desdeP) return null;
    const suma = (a: string, b: string) => riegos.filter((x) => x.fecha > a && x.fecha <= b).reduce((s, x) => s + x.volumen_m3, 0);
    const ahora = suma(desde, hoy);
    const antes = suma(desdeP, hastaP);
    if (!ahora && !antes) return null;
    if (!antes) return `💧 En los últimos 30 días se han pedido ${m3(ahora)} de agua en Valladolises.`;
    return `💧 Últimos 30 días: ${m3(ahora)} de agua en Valladolises, ${comparado(ahora, antes)} que hace un año (${m3(antes)}).`;
  },

  // Lo que se ahorra por el precio del agua frente a la campaña anterior
  agua_precio: ({ riegos, hoy }) => {
    const ini = inicioCampana(hoy);
    const esta = riegos.filter((x) => x.fecha >= `${ini}-05-01`);
    const antes = riegos.filter((x) => x.fecha >= `${ini - 1}-05-01` && x.fecha < `${ini}-05-01`);
    const precio = (l: Riego[]) => {
      const v = l.reduce((s, x) => s + x.volumen_m3, 0);
      return v ? l.reduce((s, x) => s + x.coste_eur, 0) / v : 0;
    };
    const pa = precio(antes);
    const pe = precio(esta);
    if (!pa || !pe || Math.abs(pa - pe) < 0.005) return null;
    const v = esta.reduce((s, x) => s + x.volumen_m3, 0);
    const dif = (pa - pe) * v;
    return dif > 0
      ? `💶 El agua está más barata que la campaña pasada (${formatoNumero(pe, 2)} frente a ${formatoNumero(pa, 2)} €/m³): llevamos unos ${eur(dif)} ahorrados.`
      : `💶 El agua está más cara que la campaña pasada (${formatoNumero(pe, 2)} frente a ${formatoNumero(pa, 2)} €/m³): unos ${eur(-dif)} más esta campaña.`;
  },

  // Nivel de los pantanos, o cuánto hace que no se apunta
  pantanos: ({ fincas, hoy }) => {
    const partes: string[] = [];
    let viejo: { nombre: string; dias: number } | null = null;
    for (const f of fincas) {
      for (const p of f.pantanos) {
        const n = ultimoNivel(p);
        if (!n?.nivel_m3) continue;
        const dias = diasEntre(n.fecha, hoy);
        const tope = Number(p.capacidad_util_m3 ?? p.capacidad_m3 ?? 0);
        partes.push(`${f.nombre} ~${m3(Number(n.nivel_m3))}${tope ? ` (${Math.round((Number(n.nivel_m3) / tope) * 100)} %)` : ""}`);
        if (dias > 7 && (!viejo || dias > viejo.dias)) viejo = { nombre: f.nombre, dias };
      }
    }
    if (!partes.length) return null;
    return `🏞 Pantanos: ${partes.join(" · ")}.${viejo ? ` El de ${viejo.nombre} lleva ${viejo.dias} días sin apuntar: ¿cómo está?` : ""}`;
  },

  // Ventas del año de cada titular frente al límite
  ventas: ({ titulares }) => {
    const con = titulares.filter((t) => t.facturado > 0);
    if (!con.length) return null;
    return `📊 Ventas del año: ${con.map((t) => `${t.nombre} ${eur(t.facturado)} (${Math.round((t.facturado / t.limite_eur) * 100)} %)`).join(" · ")} del límite de ${eur(con[0].limite_eur)}.`;
  },

  // Ideas apuntadas en la libreta esta semana
  ideas: ({ ideasSemana }) =>
    ideasSemana > 0
      ? `📝 Esta semana se ${ideasSemana === 1 ? "ha apuntado 1 idea" : `han apuntado ${ideasSemana} ideas`} en la libreta. Se pueden ver en Campo → Tareas → Libreta de ideas.`
      : null,

  // En qué punto de la campaña estamos (mayo a abril)
  campana: ({ hoy }) => {
    const ini = inicioCampana(hoy);
    const dia = diasEntre(`${ini}-05-01`, hoy) + 1;
    const mes = Number(hoy.slice(5, 7));
    const fase =
      mes >= 10 || mes <= 1
        ? "toca primer corte y engorde del resto"
        : mes <= 4
          ? "segundo corte y final de la recogida"
          : mes <= 6
            ? "floración y cuajado: ojo al prays y al trips"
            : "el limón engorda: riego y vigilar piojo y araña";
    return `🍋 Día ${dia} de la campaña ${ini}/${String(ini + 1).slice(2)} (de mayo a abril): ${fase}.`;
  },
};

/**
 * Días con un dato elegido a mano (para estrenar algo nuevo). Si ese día el dato
 * no tiene datos, se sigue con el turno normal.
 */
const DESTACADOS: Record<string, keyof typeof CANDIDATOS> = {
  "2026-11-05": "agua_campana", // estreno de los datos de agua de la Comunidad de Regantes
};

/** Elige el dato de hoy. */
export function elegirDato(d: DatosDelDia): string | null {
  // si alguien se acerca al límite, eso va primero siempre
  const cerca = d.titulares
    .filter((t) => t.facturado >= (t.aviso_pct / 100) * t.limite_eur)
    .sort((a, b) => b.facturado / b.limite_eur - a.facturado / a.limite_eur)[0];
  if (cerca) {
    return `⚠️ ${cerca.nombre} lleva ${eur(cerca.facturado)} de ventas este año (${Math.round((cerca.facturado / cerca.limite_eur) * 100)} % del límite de ${eur(cerca.limite_eur)}): mirar a nombre de quién va la próxima factura.`;
  }

  const destacado = DESTACADOS[d.hoy];
  if (destacado) {
    const t = CANDIDATOS[destacado](d);
    if (t) return destacado === "agua_campana" ? `${t} Ya tenemos en Campo los riegos pedidos a la Comunidad de Regantes.` : t;
  }

  const disponibles = Object.values(CANDIDATOS)
    .map((c) => c(d))
    .filter((t): t is string => !!t);
  if (!disponibles.length) return null;
  const diaDelAnio = diasEntre(`${d.hoy.slice(0, 4)}-01-01`, d.hoy);
  return disponibles[diaDelAnio % disponibles.length];
}

/** Carga lo necesario y devuelve el dato de hoy (o null). Nunca rompe el aviso. */
export async function datoDelDia(supabase: SupabaseClient, hoy: string): Promise<string | null> {
  try {
    const [{ fincas }, { riegos }, cuentas, ideas] = await Promise.all([
      cargarFincas(supabase),
      cargarRiegos(supabase),
      cargarCuentas(supabase, Number(hoy.slice(0, 4))),
      supabase
        .from("ideas")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${sumarDias(hoy, -7)}T00:00:00+01:00`)
        .neq("estado", "descartada"),
    ]);
    return elegirDato({
      hoy,
      riegos,
      fincas,
      titulares: cuentas.falta ? [] : situacion(cuentas.titulares, cuentas.facturas),
      ideasSemana: ideas.count ?? 0,
    });
  } catch (e) {
    console.error("[dato del día]", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Todos los datos que se pueden decir hoy (para revisarlos o enseñarlos juntos). */
export function todosLosDatos(d: DatosDelDia): { clave: string; texto: string }[] {
  return Object.entries(CANDIDATOS)
    .map(([clave, c]) => ({ clave, texto: c(d) }))
    .filter((x): x is { clave: string; texto: string } => !!x.texto);
}
