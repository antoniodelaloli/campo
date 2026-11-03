// Consultas a Supabase. Reciben el cliente ya autenticado (RLS aplica siempre).
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizar, type Lugar, type TipoTarea } from "@/lib/texto";

type Cliente = SupabaseClient;
type Fiabilidad = "medido" | "declarado" | "pendiente";

// ------------------------------------------------------------------
// Fincas
// ------------------------------------------------------------------
export type Zona = {
  id: string;
  nombre: string;
  alias: string[];
  especie: string | null;
  variedad: string | null;
  edad_aprox_anios: number | null;
  n_arboles: number | null;
  /** de dónde sale n_arboles si puede estar desfasado (se enseña con asterisco) */
  arboles_nota?: string | null;
  superficie_ha: number | null;
  fiabilidad: Fiabilidad;
  notas: string | null;
};

export type Sector = {
  id: string;
  numero: number;
  nombre: string | null;
  alias: string[];
  notas: string | null;
};

export type Pantano = {
  id: string;
  nombre: string;
  capacidad_m3: number | null;
  capacidad_util_m3: number | null;
  fiabilidad: Fiabilidad;
  notas: string | null;
  niveles_pantano: {
    id: string;
    fecha: string;
    nivel_m3: number | null;
    metodo: "a_ojo" | "sensor" | "calculado";
    anulado: boolean;
  }[];
};

export type Finca = {
  id: string;
  nombre: string;
  alias: string[];
  regimen: "convencional" | "ecologico" | "por_confirmar";
  superficie_ha: number | null;
  superficie_fiabilidad: Fiabilidad;
  n_arboles_aprox: number | null;
  /** de dónde sale n_arboles_aprox si puede estar desfasado (se enseña con asterisco) */
  arboles_nota?: string | null;
  notas: string | null;
  zonas: Zona[];
  sectores_riego: Sector[];
  pantanos: Pantano[];
};

export async function cargarFincas(supabase: Cliente) {
  const consulta = (conNota: boolean) =>
    supabase
      .from("fincas")
      .select(
        `id, nombre, alias, regimen, superficie_ha, superficie_fiabilidad, n_arboles_aprox, notas${conNota ? ", arboles_nota" : ""},
         zonas(id, nombre, alias, especie, variedad, edad_aprox_anios, n_arboles, superficie_ha, fiabilidad, notas${conNota ? ", arboles_nota" : ""}),
         sectores_riego(id, numero, nombre, alias, notas),
         pantanos(id, nombre, capacidad_m3, capacidad_util_m3, fiabilidad, notas,
           niveles_pantano(id, fecha, nivel_m3, metodo, anulado))`,
      )
      .eq("activa", true)
      .order("nombre")
      .overrideTypes<Finca[], { merge: false }>();

  // Con la nota de los árboles (migración 0011); si aún no está aplicada, sin ella
  let { data, error } = await consulta(true);
  if (error && /arboles_nota/.test(error.message)) ({ data, error } = await consulta(false));
  return { fincas: data ?? [], error: error?.message ?? null };
}

/** Último nivel válido de un pantano (o null si nunca se anotó). */
export function ultimoNivel(p: Pantano) {
  return (
    [...p.niveles_pantano]
      .filter((n) => !n.anulado)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null
  );
}

/** Lista de lugares (fincas, zonas, sectores) para interpretar texto libre. */
export function lugaresDe(fincas: Finca[]): Lugar[] {
  const out: Lugar[] = [];
  for (const f of fincas) {
    out.push({
      tipo: "finca",
      id: f.id,
      finca_id: f.id,
      nombre: f.nombre,
      finca: f.nombre,
      claves: [f.nombre, ...f.alias].map(normalizar),
    });
    for (const z of f.zonas) {
      out.push({
        tipo: "zona",
        id: z.id,
        finca_id: f.id,
        nombre: z.nombre,
        finca: f.nombre,
        claves: [z.nombre, ...z.alias].map(normalizar),
      });
    }
    for (const s of f.sectores_riego) {
      out.push({
        tipo: "sector",
        id: s.id,
        finca_id: f.id,
        nombre: s.nombre ?? `Sector ${s.numero}`,
        finca: f.nombre,
        claves: [`sector ${s.numero}`, s.nombre ?? "", ...s.alias]
          .filter(Boolean)
          .map(normalizar),
      });
    }
  }
  return out;
}

// ------------------------------------------------------------------
// Tareas
// ------------------------------------------------------------------
export type EstadoTarea =
  | "prevista"
  | "en_curso"
  | "terminada"
  | "verificada"
  | "aplazada"
  | "cancelada";

export type Tarea = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoTarea;
  estado: EstadoTarea;
  prioridad: "baja" | "normal" | "alta";
  finca_id: string | null;
  fecha_prevista: string | null;
  ubicacion_texto: string | null;
  completada_en: string | null;
  /** fecha clave de la que cuelga (migración 0004) */
  hito_id?: string | null;
  hitos?: { titulo: string } | null;
  fincas: { nombre: string } | null;
  zonas: { nombre: string } | null;
  sectores_riego: { numero: number; nombre: string | null } | null;
  tareas_personas: { personas: { id: string; nombre: string } | null }[];
};

const SELECT_TAREA_BASE = `id, titulo, descripcion, tipo, estado, prioridad, finca_id, fecha_prevista, ubicacion_texto, completada_en,
  fincas(nombre), zonas(nombre), sectores_riego(numero, nombre),
  tareas_personas(personas(id, nombre))`;
// con la fecha clave de la que cuelga (si ya existe la columna de la migración 0004)
const SELECT_TAREA = `${SELECT_TAREA_BASE}, hito_id, hitos(titulo)`;

/** ¿El error es porque falta la columna hito_id (migración 0004 sin aplicar)? */
function faltaHitoId(error: { message: string } | null) {
  return !!error && /hito_id|hitos/.test(error.message);
}

export async function cargarTareasAbiertas(supabase: Cliente) {
  const consulta = (select: string) =>
    supabase
      .from("tareas")
      .select(select)
      .in("estado", ["prevista", "en_curso", "aplazada"])
      .order("fecha_prevista", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .overrideTypes<Tarea[], { merge: false }>();
  let { data, error } = await consulta(SELECT_TAREA);
  if (faltaHitoId(error)) ({ data, error } = await consulta(SELECT_TAREA_BASE));
  return { tareas: data ?? [], error: error?.message ?? null };
}

export async function cargarTareasHechas(supabase: Cliente, limite = 30) {
  const consulta = (select: string) =>
    supabase
      .from("tareas")
      .select(select)
      .in("estado", ["terminada", "verificada"])
      .order("completada_en", { ascending: false, nullsFirst: false })
      .limit(limite)
      .overrideTypes<Tarea[], { merge: false }>();
  let { data, error } = await consulta(SELECT_TAREA);
  if (faltaHitoId(error)) ({ data, error } = await consulta(SELECT_TAREA_BASE));
  return { tareas: data ?? [], error: error?.message ?? null };
}

export type TareaDeHito = { id: string; titulo: string; estado: EstadoTarea; hito_id: string };

/** Tareas (abiertas y hechas, no canceladas) que cuelgan de alguna fecha clave. */
export async function cargarTareasDeHitos(supabase: Cliente) {
  const { data, error } = await supabase
    .from("tareas")
    .select("id, titulo, estado, hito_id")
    .not("hito_id", "is", null)
    .neq("estado", "cancelada")
    .order("created_at", { ascending: true })
    .overrideTypes<TareaDeHito[], { merge: false }>();
  if (error) return [];
  return data ?? [];
}

export function lugarDeTarea(t: Tarea): string {
  if (t.zonas) return t.zonas.nombre;
  if (t.sectores_riego)
    return t.sectores_riego.nombre ?? `Sector ${t.sectores_riego.numero}`;
  if (t.fincas) return t.fincas.nombre;
  return t.ubicacion_texto ? `¿${t.ubicacion_texto}?` : "Sin lugar";
}

// ------------------------------------------------------------------
// Personas
// ------------------------------------------------------------------
export type Persona = { id: string; nombre: string; tipo: string };

export async function cargarPersonas(supabase: Cliente) {
  const { data } = await supabase
    .from("personas")
    .select("id, nombre, tipo")
    .eq("activa", true)
    .order("nombre")
    .overrideTypes<Persona[], { merge: false }>();
  return data ?? [];
}

// ------------------------------------------------------------------
// Avisos: incidencias abiertas + notas del diario
// ------------------------------------------------------------------
export type Incidencia = {
  id: string;
  finca_id: string;
  tipo: "fuga_riego" | "averia" | "plaga" | "piscina" | "arbol" | "otro";
  titulo: string;
  descripcion: string | null;
  severidad: "baja" | "media" | "alta";
  estado: "abierta" | "en_curso" | "resuelta" | "descartada";
  fecha: string;
  /** sitio exacto (atajo «Incidencia» de Siri), si lo tiene */
  lat?: number | null;
  lon?: number | null;
  fincas: { nombre: string } | null;
};

export async function cargarIncidenciasAbiertas(supabase: Cliente) {
  const campos = "id, finca_id, tipo, titulo, descripcion, severidad, estado, fecha, fincas(nombre)";
  const consulta = (select: string) =>
    supabase
      .from("incidencias")
      .select(select)
      .in("estado", ["abierta", "en_curso"])
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .overrideTypes<Incidencia[], { merge: false }>();
  // Con el sitio exacto (migración 0010); si aún no está aplicada, sin él
  const { data, error } = await consulta(`${campos}, lat, lon`);
  if (!error) return data ?? [];
  const { data: sinSitio } = await consulta(campos);
  return sinSitio ?? [];
}

export type NotaDiario = {
  id: string;
  fecha: string;
  texto: string;
  fincas: { nombre: string } | null;
};

export async function cargarDiario(supabase: Cliente, limite = 5) {
  const { data } = await supabase
    .from("diario")
    .select("id, fecha, texto, fincas(nombre)")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limite)
    .overrideTypes<NotaDiario[], { merge: false }>();
  return data ?? [];
}

// ------------------------------------------------------------------
// Tratamientos
// ------------------------------------------------------------------
export type Tratamiento = {
  id: string;
  finca_id: string;
  fecha: string;
  fecha_aproximada: boolean;
  estado: "prevista" | "en_curso" | "realizada" | "anulada";
  objetivo: string | null;
  n_cubas: number | null;
  litros_cuba: number | null;
  maquina: string | null;
  condiciones: string | null;
  notas: string | null;
  fincas: { nombre: string } | null;
  personas: { nombre: string } | null;
  tratamiento_productos: {
    id: string;
    dosis_por_cuba: number | null;
    unidad: string | null;
    productos: {
      nombre: string;
      validado: boolean;
      plazo_seguridad_dias: number | null;
    } | null;
  }[];
};

export async function cargarTratamientos(supabase: Cliente) {
  const { data, error } = await supabase
    .from("tratamientos")
    .select(
      `id, finca_id, fecha, fecha_aproximada, estado, objetivo, n_cubas, litros_cuba, maquina, condiciones, notas,
       fincas(nombre), personas(nombre),
       tratamiento_productos(id, dosis_por_cuba, unidad, productos(nombre, validado, plazo_seguridad_dias))`,
    )
    .neq("estado", "anulada")
    .order("fecha", { ascending: false })
    .overrideTypes<Tratamiento[], { merge: false }>();
  return { tratamientos: data ?? [], error: error?.message ?? null };
}

export type Producto = {
  id: string;
  nombre: string;
  tipo: string;
  validado: boolean;
  plazo_seguridad_dias: number | null;
};

export async function cargarProductos(supabase: Cliente) {
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, tipo, validado, plazo_seguridad_dias")
    .eq("activo", true)
    .order("nombre")
    .overrideTypes<Producto[], { merge: false }>();
  return data ?? [];
}

// ------------------------------------------------------------------
// Agua: contadores y suministros
// ------------------------------------------------------------------
export type Contador = {
  id: string;
  finca_id: string;
  nombre: string;
  tipo: "entrada" | "salida";
  origen_agua: string | null;
  es_digital: boolean | null;
  es_contraste: boolean;
  notas: string | null;
  sectores_riego: { numero: number } | null;
  lecturas_contador: {
    id: string;
    fecha: string;
    lectura_m3: number;
    anulada: boolean;
    pendiente_conciliar: boolean;
    notas: string | null;
  }[];
};

export async function cargarContadores(supabase: Cliente) {
  const { data } = await supabase
    .from("contadores")
    .select(
      `id, finca_id, nombre, tipo, origen_agua, es_digital, es_contraste, notas,
       sectores_riego(numero),
       lecturas_contador(id, fecha, lectura_m3, anulada, pendiente_conciliar, notas)`,
    )
    .eq("activo", true)
    .order("nombre")
    .overrideTypes<Contador[], { merge: false }>();
  return data ?? [];
}

export function ultimaLectura(c: Contador) {
  return (
    [...c.lecturas_contador]
      .filter((l) => !l.anulada)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null
  );
}

export type Suministro = {
  id: string;
  finca_id: string;
  fecha: string;
  origen_agua: string | null;
  volumen_m3: number | null;
  coste_eur: number | null;
  proveedor: string | null;
  fiabilidad: Fiabilidad;
  pendiente_conciliar: boolean;
};

export async function cargarSuministros(supabase: Cliente, limite = 10) {
  const { data } = await supabase
    .from("suministros_agua")
    .select(
      "id, finca_id, fecha, origen_agua, volumen_m3, coste_eur, proveedor, fiabilidad, pendiente_conciliar",
    )
    .eq("anulado", false)
    .order("fecha", { ascending: false })
    .limit(limite)
    .overrideTypes<Suministro[], { merge: false }>();
  return data ?? [];
}

// ------------------------------------------------------------------
// Campaña actual (la de nombre más alto, p. ej. "2026/27")
// ------------------------------------------------------------------
export async function cargarCampanaActual(supabase: Cliente) {
  const { data } = await supabase
    .from("campanas")
    .select("id, nombre")
    .order("nombre", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; nombre: string }>();
  return data;
}

export type ZonaSector = { zona_id: string; sector_id: string; porcentaje_aprox: number | null };

export async function cargarZonaSector(supabase: Cliente, fincaId: string) {
  const { data } = await supabase
    .from("zona_sector")
    .select("zona_id, sector_id, porcentaje_aprox")
    .eq("finca_id", fincaId)
    .overrideTypes<ZonaSector[], { merge: false }>();
  return data ?? [];
}

// ------------------------------------------------------------------
// Avisos (migración 0002). Si la tabla aún no existe, se devuelve vacío.
// ------------------------------------------------------------------
export type CategoriaAviso = "agua" | "riego" | "tratamientos" | "cosecha" | "administracion" | "otro";

export type Aviso = {
  id: string;
  titulo: string;
  texto: string | null;
  nivel: "urgente" | "atencion" | "info";
  categoria: CategoriaAviso;
  finca_id: string | null;
  estado: "abierto" | "resuelto" | "descartado";
  fecha: string;
  fincas: { nombre: string } | null;
};

const ORDEN_NIVEL = { urgente: 0, atencion: 1, info: 2 } as const;

export async function cargarAvisos(supabase: Cliente, categoria?: CategoriaAviso) {
  let q = supabase
    .from("avisos")
    .select("id, titulo, texto, nivel, categoria, finca_id, estado, fecha, fincas(nombre)")
    .eq("estado", "abierto");
  if (categoria) q = q.eq("categoria", categoria);
  const { data, error } = await q
    .order("fecha", { ascending: false })
    .overrideTypes<Aviso[], { merge: false }>();
  if (error) return [];
  return [...(data ?? [])].sort((a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel]);
}

// ------------------------------------------------------------------
// Fuentes de agua (migración 0002)
// ------------------------------------------------------------------
export type FuenteAgua = {
  id: string;
  finca_id: string;
  origen_agua: "trasvase" | "pozo" | "desaladora" | "pantano" | "otro";
  proveedor: string | null;
  precio_ref_eur_m3: number | null;
  anio_ref: number | null;
  fiabilidad: Fiabilidad;
  notas: string | null;
};

export async function cargarFuentesAgua(supabase: Cliente) {
  const { data, error } = await supabase
    .from("fuentes_agua")
    .select("id, finca_id, origen_agua, proveedor, precio_ref_eur_m3, anio_ref, fiabilidad, notas")
    .eq("activa", true)
    .overrideTypes<FuenteAgua[], { merge: false }>();
  if (error) return [];
  return data ?? [];
}

// ------------------------------------------------------------------
// Fechas clave (tabla «hitos», migración 0003). Si la tabla aún no existe,
// se devuelve vacío y `falta = true` para poder avisar.
// ------------------------------------------------------------------
export type TipoHito = "corte" | "tratamiento" | "plazo" | "agua" | "revision" | "compra" | "otro";

export type Hito = {
  id: string;
  titulo: string;
  texto: string | null;
  tipo: TipoHito;
  finca_id: string | null;
  fecha: string;
  hora: string | null;
  fecha_aproximada: boolean;
  avisar_dias: number[];
  repetir: "no" | "anual";
  estado: "pendiente" | "hecho" | "anulado";
  fincas: { nombre: string } | null;
};

/** Fechas clave pendientes y hechas entre dos fechas (para la línea de la campaña). */
export async function cargarHitosCampana(supabase: Cliente, desde: string, hasta: string) {
  const { data, error } = await supabase
    .from("hitos")
    .select("id, titulo, texto, tipo, finca_id, fecha, hora, fecha_aproximada, avisar_dias, repetir, estado, fincas(nombre)")
    .neq("estado", "anulado")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: true })
    .overrideTypes<Hito[], { merge: false }>();
  if (error) return [];
  return data ?? [];
}

/** Fechas clave pendientes hasta una fecha (incluye las atrasadas). */
export async function cargarHitos(supabase: Cliente, hasta: string) {
  const { data, error } = await supabase
    .from("hitos")
    .select("id, titulo, texto, tipo, finca_id, fecha, hora, fecha_aproximada, avisar_dias, repetir, estado, fincas(nombre)")
    .eq("estado", "pendiente")
    .lte("fecha", hasta)
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true, nullsFirst: true })
    .overrideTypes<Hito[], { merge: false }>();
  if (error) {
    const falta = error.code === "PGRST205" || error.code === "42P01" || /hitos/.test(error.message);
    return { hitos: [] as Hito[], error: falta ? null : error.message, falta };
  }
  return { hitos: data ?? [], error: null, falta: false };
}
