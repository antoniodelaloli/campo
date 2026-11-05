import type { Finca, Incidencia, Tarea, Tratamiento } from "@/lib/datos";
import { formatoNumero, normalizar } from "@/lib/texto";
import { GEO, type ClaveFinca } from "@/lib/geografia";
import { MapaInteractivo, type FincaEnMapa, type ActividadEnMapa } from "@/components/MapaInteractivo";

/*
 * Prepara los datos del mapa en el servidor y se los pasa al mapa interactivo (cliente).
 * - Situación y tamaño REALES: coordenadas UTM y superficie de cada finca (ver lib/geografia.ts).
 * - El terreno de alrededor (rambla, caminos, secano) es ilustración.
 */

type Props = {
  fincas: Finca[];
  incidencias: Incidencia[];
  tratamientosEnCurso: Tratamiento[];
  tareasEnCurso: Tarea[];
  momento: "dia" | "atardecer" | "noche";
  sobrio?: boolean;
};

function resumenFinca(f: Finca): string {
  const partes: string[] = [];
  if (f.superficie_ha != null) partes.push(`~${formatoNumero(Number(f.superficie_ha))} ha`);
  const especies = Array.from(
    new Set(
      f.zonas
        .map((z) => normalizar(z.especie ?? ""))
        .filter(Boolean)
        .map((e) => (e.startsWith("limon") ? "limón" : e.startsWith("mandarin") ? "mandarina" : e)),
    ),
  );
  if (especies.length) partes.push(especies.join(" y "));
  if (f.sectores_riego.length)
    partes.push(`${f.sectores_riego.length} sector${f.sectores_riego.length === 1 ? "" : "es"}`);
  if (!partes.length) partes.push(f.regimen === "ecologico" ? "Ecológica" : "Nueva · sin datos aún");
  return partes.join(" · ");
}

export function MapaFincas({ fincas, incidencias, tratamientosEnCurso, tareasEnCurso, momento, sobrio = false }: Props) {
  const enMapa: FincaEnMapa[] = [];
  for (const f of fincas) {
    const clave = normalizar(f.nombre) as ClaveFinca;
    const geo = GEO[clave];
    if (!geo) continue; // finca sin situación conocida: no se dibuja
    const areaHa = f.superficie_ha != null ? Number(f.superficie_ha) : geo.areaHaPorDefecto;
    enMapa.push({
      id: f.id,
      clave,
      nombre: f.nombre,
      subtitulo: resumenFinca(f).replace(/^Nueva · sin datos aún$/, `Nueva · ~${formatoNumero(areaHa, 2)} ha`),
      areaHa,
      avisos: incidencias.filter((i) => i.finca_id === f.id).length,
      piscina: incidencias.some((i) => i.finca_id === f.id && i.tipo === "piscina"),
      zonas: f.zonas.map((z) => ({ id: z.id, nombre: z.nombre, especie: z.especie })),
      sectores: f.sectores_riego.map((s) => ({ id: s.id, numero: s.numero })),
      pantano: f.pantanos[0]?.capacidad_m3 != null ? formatoNumero(Number(f.pantanos[0].capacidad_m3)) : null,
    });
  }

  // Lo que pasa hoy: un tractor por tratamiento en curso y una persona por tarea en curso con alguien asignado.
  const actividades: ActividadEnMapa[] = [];
  const usados = new Set<string>();
  for (const t of tratamientosEnCurso) {
    if (usados.has(`tractor-${t.finca_id}`) || !enMapa.some((f) => f.id === t.finca_id)) continue;
    usados.add(`tractor-${t.finca_id}`);
    actividades.push({
      id: `tr-${t.id}`,
      fincaId: t.finca_id,
      tipo: "tractor",
      texto: `${t.personas?.nombre ?? "Tratamiento"} · ${t.objetivo ? "tratando" : "en curso"}`,
    });
  }
  for (const t of tareasEnCurso) {
    const persona = t.tareas_personas[0]?.personas?.nombre;
    if (!persona || !t.finca_id) continue;
    // si esa persona ya sale en el tractor de esa finca, no se repite
    if (tratamientosEnCurso.some((tr) => tr.finca_id === t.finca_id && tr.personas?.nombre === persona)) continue;
    if (usados.has(`persona-${t.finca_id}`) || !enMapa.some((f) => f.id === t.finca_id)) continue;
    usados.add(`persona-${t.finca_id}`);
    actividades.push({
      id: `ta-${t.id}`,
      fincaId: t.finca_id,
      tipo: "persona",
      texto: `${persona} · ${t.titulo.toLowerCase()}`,
    });
  }

  return <MapaInteractivo fincas={enMapa} actividades={actividades} momento={momento} sobrio={sobrio} />;
}
