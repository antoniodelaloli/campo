import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Chip, Dato, Panel, PorConfirmar } from "@/components/ui";
import { FilaTarea } from "@/components/FilaTarea";
import { BarraPantano } from "@/components/BarraPantano";
import { PlanoFinca, tienePlano } from "@/components/PlanoFinca";
import { obtenerContexto } from "@/lib/sesion";
import {
  cargarFincas,
  cargarIncidenciasAbiertas,
  cargarTareasAbiertas,
  cargarZonaSector,
  type Zona,
} from "@/lib/datos";
import { formatoNumero, hoyISO, normalizar } from "@/lib/texto";

export const instant = false;

const REGIMEN = {
  convencional: "Convencional",
  ecologico: "Ecológica",
  por_confirmar: "Régimen por confirmar",
} as const;

export default function FincaPage({ params, searchParams }: PageProps<"/fincas/[id]">) {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <FincaDetalle params={params} searchParams={searchParams} />
      </Suspense>
    </Marco>
  );
}

function colorZona(especie: string | null) {
  const e = normalizar(especie ?? "");
  if (e.startsWith("mandarin")) return { hoja: "#4fa54a", fruta: "#ef8a22", nombre: "Mandarino" };
  if (e.startsWith("limon")) return { hoja: "#46a047", fruta: "#f6d743", nombre: "Limonero" };
  return { hoja: "#5a9a50", fruta: null, nombre: null };
}

/** Teselas de árboles en pixel art para una zona. */
function Arboleda({ zona, seleccionada }: { zona: Zona; seleccionada: boolean }) {
  const c = colorZona(zona.especie);
  const id = `z-${zona.id.slice(0, 8)}`;
  return (
    <svg viewBox="0 0 140 84" className="pixel block h-24 w-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id={id} width="28" height="24" patternUnits="userSpaceOnUse">
          <rect width="28" height="24" fill="#b98c5a" />
          <rect x="5" y="4" width="18" height="14" fill="#2f7a34" />
          <rect x="8" y="5" width="12" height="9" fill={c.hoja} />
          {c.fruta && (
            <>
              <rect x="10" y="7" width="3" height="3" fill={c.fruta} />
              <rect x="16" y="10" width="3" height="3" fill={c.fruta} />
            </>
          )}
          <rect x="12" y="20" width="4" height="3" fill="#5e3b1c" />
        </pattern>
      </defs>
      <rect width="140" height="84" fill={`url(#${id})`} />
      {seleccionada && <rect x="2" y="2" width="136" height="80" fill="none" stroke="#f6d743" strokeWidth="4" />}
    </svg>
  );
}

async function FincaDetalle({
  params,
  searchParams,
}: {
  params: PageProps<"/fincas/[id]">["params"];
  searchParams: PageProps<"/fincas/[id]">["searchParams"];
}) {
  const { supabase, puedeEditar } = await obtenerContexto();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const vista = sp.vista === "sectores" ? "sectores" : "zonas";
  const hoy = hoyISO();

  const [{ fincas }, { tareas }, incidencias, zonaSector, programadores] = await Promise.all([
    cargarFincas(supabase),
    cargarTareasAbiertas(supabase),
    cargarIncidenciasAbiertas(supabase),
    cargarZonaSector(supabase, id),
    supabase
      .from("programadores")
      .select("id, nombre, marca, modelo, tiene_red, notas")
      .eq("finca_id", id)
      .then((r) => (r.data ?? []) as { id: string; nombre: string; marca: string | null; modelo: string | null; tiene_red: boolean; notas: string | null }[]),
  ]);

  const finca = fincas.find((f) => f.id === id);
  if (!finca) notFound();

  const zonas = [...finca.zonas].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const sectores = [...finca.sectores_riego].sort((a, b) => a.numero - b.numero);
  const zonaSel = zonas.find((z) => z.id === sp.zona) ?? zonas[0] ?? null;
  const tareasFinca = tareas.filter((t) => t.finca_id === finca.id);
  const avisos = incidencias.filter((i) => i.finca_id === finca.id);

  const sectoresDeZona = (zid: string) =>
    zonaSector
      .filter((zs) => zs.zona_id === zid)
      .map((zs) => sectores.find((s) => s.id === zs.sector_id))
      .filter(Boolean);
  const zonasDeSector = (sid: string) =>
    zonaSector
      .filter((zs) => zs.sector_id === sid)
      .map((zs) => zonas.find((z) => z.id === zs.zona_id))
      .filter(Boolean);
  const zonasSinSector = zonas.filter((z) => sectoresDeZona(z.id).length === 0);

  const sub = [
    finca.superficie_ha != null
      ? `~${formatoNumero(Number(finca.superficie_ha))} ha (${finca.superficie_fiabilidad})`
      : "Superficie por confirmar",
    finca.n_arboles_aprox ? `~${formatoNumero(finca.n_arboles_aprox)} árboles` : null,
    REGIMEN[finca.regimen],
  ]
    .filter(Boolean)
    .join(" · ");

  const base = `/fincas/${finca.id}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo={finca.nombre} subtitulo={sub}>
        <nav aria-label="Ver la finca por" className="flex gap-1.5">
          <Link href={base} aria-current={vista === "zonas" ? "page" : undefined} className="pestana">
            Zonas ({zonas.length})
          </Link>
          <Link href={`${base}?vista=sectores`} aria-current={vista === "sectores" ? "page" : undefined} className="pestana">
            Sectores de riego ({sectores.length})
          </Link>
        </nav>
      </CabeceraSeccion>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* ---------- Plano ---------- */}
        <section className="panel flex flex-col gap-3 bg-hierba! p-3">
          {tienePlano(finca) && (
            <>
              <PlanoFinca
                finca={finca}
                zonaSel={zonaSel?.id ?? null}
                vista={vista}
                zonaSector={zonaSector}
                base={base}
              />
              <p className="bg-pergamino/90 px-2 py-1 text-xs text-tinta-suave">
                {vista === "zonas"
                  ? "Pulsa una zona para ver su ficha. Las formas son orientativas."
                  : "Colores = sector que riega cada trozo. Rayado = reparto por confirmar. Formas orientativas."}
              </p>
            </>
          )}
          {tienePlano(finca) && vista === "zonas" ? null : vista === "zonas" ? (
            zonas.length === 0 ? (
              <p className="ficha-pendiente p-4 text-sm text-tinta-suave">
                Esta finca todavía no tiene zonas. Se añadirán cuando se confirmen superficie, cultivo y riego.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {zonas.map((z) => {
                  const sel = zonaSel?.id === z.id;
                  return (
                    <li key={z.id}>
                      <Link
                        href={`${base}?zona=${z.id}`}
                        scroll={false}
                        aria-current={sel ? "true" : undefined}
                        className="block border-4 border-[#7a5230] bg-[#7a5230] shadow-[0_3px_0_#3b2412]"
                      >
                        <Arboleda zona={z} seleccionada={sel} />
                        <span className={`block px-2 py-1.5 font-pixel text-[15px] font-bold ${sel ? "bg-sol text-tinta" : "bg-pergamino text-tinta"}`}>
                          {z.nombre}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )
          ) : sectores.length === 0 ? (
            <p className="ficha-pendiente p-4 text-sm text-tinta-suave">Sin sectores de riego dados de alta.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {sectores.map((s) => {
                const zs = zonasDeSector(s.id);
                return (
                  <div key={s.id} className="ficha flex flex-col gap-2 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="titulo-pixel flex items-center gap-2 text-lg">
                        {tienePlano(finca) && (
                          <span
                            aria-hidden="true"
                            className="h-4 w-4 border-2 border-tinta"
                            style={{ background: ["#2f7fb0", "#c98a2a", "#8e44ad", "#16a085"][sectores.indexOf(s) % 4], opacity: 0.75 }}
                          />
                        )}
                        Sector {s.numero}
                        {s.nombre ? ` · ${s.nombre}` : ""}
                      </h3>
                    </div>
                    {s.notas && <p className="text-[13px] text-tinta-suave">{s.notas}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {zs.length ? (
                        zs.map((z) => <Chip key={z!.id} tono="verde">{z!.nombre}</Chip>)
                      ) : (
                        <Chip tono="ambar">Qué zonas riega: por confirmar</Chip>
                      )}
                    </div>
                  </div>
                );
              })}
              {zonasSinSector.length > 0 && (
                <p className="ficha-pendiente p-3 text-[13px]">
                  <b>Zonas sin sector asignado:</b> {zonasSinSector.map((z) => z.nombre).join(", ")}.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ---------- Ficha lateral ---------- */}
        <div className="flex flex-col gap-4">
          {vista === "zonas" && zonaSel && (
            <Panel>
              <span className="text-xs font-bold tracking-wider text-tinta-suave uppercase">Zona</span>
              <h2 className="titulo-pixel text-[26px]">{zonaSel.nombre}</h2>
              {zonaSel.notas && <p className="text-sm leading-relaxed">{zonaSel.notas}</p>}
              <div className="flex flex-col gap-1.5">
                <Dato k="También llamada" v={zonaSel.alias.filter((a) => normalizar(a) !== normalizar(zonaSel.nombre)).join(", ") || "—"} />
                <Dato k="Especie" v={zonaSel.especie ?? <PorConfirmar />} />
                <Dato k="Variedad" v={zonaSel.variedad ?? <PorConfirmar />} />
                <Dato k="Edad" v={zonaSel.edad_aprox_anios ? `~${zonaSel.edad_aprox_anios} años` : <PorConfirmar />} />
                <Dato k="Árboles" v={zonaSel.n_arboles ? formatoNumero(zonaSel.n_arboles) : <PorConfirmar />} />
                <Dato k="Superficie" v={zonaSel.superficie_ha ? `${formatoNumero(Number(zonaSel.superficie_ha), 2)} ha` : <PorConfirmar>pendiente de medir</PorConfirmar>} />
                <Dato
                  k="Sector de riego"
                  v={
                    sectoresDeZona(zonaSel.id).length
                      ? sectoresDeZona(zonaSel.id).map((s) => `S${s!.numero}`).join(", ")
                      : <PorConfirmar />
                  }
                />
                <Dato k="Fiabilidad" v={zonaSel.fiabilidad} />
              </div>
            </Panel>
          )}

          {vista === "sectores" && (
            <Panel titulo="Riego">
              {finca.pantanos.map((p) => (
                <BarraPantano key={p.id} pantano={p} finca={p.nombre} hoy={hoy} />
              ))}
              {programadores.map((p) => (
                <div key={p.id} className="flex flex-col gap-1">
                  <Dato k="Programador" v={[p.marca, p.modelo].filter(Boolean).join(" ") || <PorConfirmar>por identificar</PorConfirmar>} />
                  <Dato k="Conectado a red" v={p.tiene_red ? "Sí" : "No"} />
                  {p.notas && <p className="text-xs text-tinta-suave">{p.notas}</p>}
                </div>
              ))}
            </Panel>
          )}

          {avisos.length > 0 && (
            <Panel titulo="Avisos" extra={avisos.length}>
              <ul className="flex flex-col gap-2 text-[13px]">
                {avisos.map((a) => (
                  <li key={a.id}>
                    <b>{a.titulo}</b>
                    {a.descripcion && <span className="text-tinta-suave"> · {a.descripcion}</span>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel titulo="Tareas abiertas" extra={tareasFinca.length}>
            {tareasFinca.length === 0 ? (
              <p className="text-sm text-tinta-suave">Nada pendiente en esta finca.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tareasFinca.slice(0, 6).map((t) => (
                  <li key={t.id}>
                    <FilaTarea tarea={t} hoy={hoy} puedeEditar={puedeEditar} compacta />
                  </li>
                ))}
              </ul>
            )}
            <Link href="/tareas" className="boton">
              + Tarea
            </Link>
          </Panel>

          {finca.notas && (
            <details className="ficha p-3 text-sm">
              <summary className="cursor-pointer font-bold">Notas de la finca</summary>
              <p className="mt-2 leading-relaxed text-tinta-suave">{finca.notas}</p>
            </details>
          )}
        </div>
      </div>
    </main>
  );
}
