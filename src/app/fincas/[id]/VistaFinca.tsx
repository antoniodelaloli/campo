"use client";

import { useState, type ReactNode } from "react";
import type { Finca, Incidencia, ZonaSector } from "@/lib/datos";
import { CabeceraSeccion, Chip, Dato, Panel, PorConfirmar } from "@/components/ui";
import { COLOR_SECTOR, notaPlano, PlanoFinca, tienePlano, zonasSinSituar } from "@/components/PlanoFinca";
import { formatoNumero, normalizar } from "@/lib/texto";

/*
 * Página de una finca, la parte que vive en el navegador: el plano interactivo y
 * la ficha de la zona. Pasar el ratón por una parcela enseña su ficha; pulsarla la
 * deja fija. Cambiar de zona o de vista NO recarga la página (la dirección se
 * actualiza para poder compartirla o volver a ella).
 */

type Vista = "zonas" | "sectores";

export function VistaFinca({
  finca,
  subtitulo,
  zonaSector,
  vistaInicial,
  zonaInicial,
  piscina,
  incidencias = [],
  riego,
  acciones,
  lateral,
}: {
  finca: Finca;
  subtitulo: string;
  zonaSector: ZonaSector[];
  vistaInicial: Vista;
  zonaInicial: string | null;
  piscina: boolean;
  /** incidencias abiertas (las que tienen sitio salen en el plano) */
  incidencias?: Incidencia[];
  /** panel de riego (pantanos y programadores), para la vista de sectores */
  riego: ReactNode;
  /** botonera «Apuntar en …», debajo del plano */
  acciones: ReactNode;
  /** avisos, tareas y notas de la finca (columna derecha) */
  lateral: ReactNode;
}) {
  const base = `/fincas/${finca.id}`;
  const zonas = [...finca.zonas].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const sectores = [...finca.sectores_riego].sort((a, b) => a.numero - b.numero);

  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [elegida, setElegida] = useState<string | null>(
    zonas.find((z) => z.id === zonaInicial)?.id ?? zonas[0]?.id ?? null,
  );
  const [sobre, setSobre] = useState<string | null>(null);

  // Cambia la dirección sin recargar (se puede compartir o recargar y sale igual)
  const actualizarDireccion = (v: Vista, zona: string | null) => {
    const q = new URLSearchParams();
    if (v === "sectores") q.set("vista", "sectores");
    else if (zona) q.set("zona", zona);
    window.history.replaceState(null, "", q.size ? `${base}?${q}` : base);
  };
  const elegir = (id: string) => {
    setElegida(id);
    actualizarDireccion(vista, id);
  };
  const cambiarVista = (v: Vista) => {
    setVista(v);
    setSobre(null);
    actualizarDireccion(v, elegida);
  };

  const zonaVista = zonas.find((z) => z.id === (sobre ?? elegida)) ?? null;
  const conPlano = tienePlano(finca);
  const sinSituar = zonasSinSituar(finca).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const sectoresDeZona = (zid: string) =>
    zonaSector
      .filter((zs) => zs.zona_id === zid)
      .map((zs) => sectores.find((s) => s.id === zs.sector_id))
      .filter((s) => s != null);
  const zonasDeSector = (sid: string) =>
    zonaSector
      .filter((zs) => zs.sector_id === sid)
      .map((zs) => zonas.find((z) => z.id === zs.zona_id))
      .filter((z) => z != null);
  const zonasSinSector = zonas.filter((z) => sectoresDeZona(z.id).length === 0);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo={finca.nombre} subtitulo={subtitulo}>
        <div role="tablist" aria-label="Ver la finca por" className="flex gap-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={vista === "zonas"}
            aria-current={vista === "zonas" ? "page" : undefined}
            onClick={() => cambiarVista("zonas")}
            className="pestana"
          >
            Zonas ({zonas.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={vista === "sectores"}
            aria-current={vista === "sectores" ? "page" : undefined}
            onClick={() => cambiarVista("sectores")}
            className="pestana"
          >
            Sectores de riego ({sectores.length})
          </button>
        </div>
      </CabeceraSeccion>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* ---------- Plano y botonera ---------- */}
        <div className="flex flex-col gap-5">
          <section className="panel flex flex-col gap-3 bg-hierba! p-3">
            {conPlano && (
              <PlanoFinca
                finca={finca}
                zonaSel={elegida}
                zonaSobre={sobre}
                vista={vista}
                zonaSector={zonaSector}
                base={base}
                piscina={piscina}
                incidencias={incidencias}
                onElegir={elegir}
                onSobre={setSobre}
              />
            )}
            <p className="bg-pergamino/90 px-2 py-1 text-xs text-tinta-suave">
              {vista === "zonas"
                ? zonas.length > sinSituar.length
                  ? "Pasa el ratón por una zona para ver su ficha; púlsala para dejarla fija. "
                  : ""
                : "Colores = sector que riega cada trozo. "}
              {notaPlano(finca)}
            </p>

            {vista === "zonas" &&
              (zonas.length === 0 ? (
                <p className="ficha-pendiente p-3 text-sm text-tinta-suave">
                  Esta finca todavía no tiene zonas. Se añadirán cuando se confirmen superficie, cultivo y riego.
                </p>
              ) : (
                sinSituar.length > 0 && (
                  <div className="flex flex-col gap-1.5 bg-pergamino/90 px-2 py-2">
                    <p className="text-xs font-bold text-tinta-suave">
                      {conPlano ? "Zonas aún sin situar en el plano:" : "Zonas:"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sinSituar.map((z) => (
                        <button
                          key={z.id}
                          type="button"
                          onClick={() => elegir(z.id)}
                          onMouseEnter={() => setSobre(z.id)}
                          onMouseLeave={() => setSobre(null)}
                          aria-pressed={elegida === z.id}
                          className={`chip cursor-pointer ${elegida === z.id ? "bg-sol!" : ""}`}
                        >
                          {z.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))}

            {vista === "sectores" &&
              (sectores.length === 0 ? (
                <p className="ficha-pendiente p-4 text-sm text-tinta-suave">Sin sectores de riego dados de alta.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {sectores.map((s, i) => {
                    const zs = zonasDeSector(s.id);
                    return (
                      <div key={s.id} className="ficha flex flex-col gap-2 p-3">
                        <h3 className="titulo-pixel flex items-center gap-2 text-lg">
                          <span
                            aria-hidden="true"
                            className="h-4 w-4 border-2 border-tinta"
                            style={{ background: COLOR_SECTOR[i % COLOR_SECTOR.length], opacity: 0.75 }}
                          />
                          Sector {s.numero}
                          {s.nombre ? ` · ${s.nombre}` : ""}
                        </h3>
                        {s.notas && <p className="text-[13px] text-tinta-suave">{s.notas}</p>}
                        <div className="flex flex-wrap gap-1.5">
                          {zs.length ? (
                            zs.map((z) => (
                              <Chip key={z.id} tono="verde">
                                {z.nombre}
                              </Chip>
                            ))
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
              ))}
          </section>

          {acciones}
        </div>

        {/* ---------- Ficha lateral ---------- */}
        <div className="flex flex-col gap-4">
          {vista === "zonas" && zonaVista && (
            <Panel>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold tracking-wider text-tinta-suave uppercase">Zona</span>
                {sobre && sobre !== elegida && <span className="text-xs text-tinta-suave">vista previa · pulsa para fijarla</span>}
              </div>
              <h2 className="titulo-pixel text-[26px]">{zonaVista.nombre}</h2>
              {zonaVista.notas && <p className="text-sm leading-relaxed">{zonaVista.notas}</p>}
              <div className="flex flex-col gap-1.5">
                <Dato
                  k="También llamada"
                  v={zonaVista.alias.filter((a) => normalizar(a) !== normalizar(zonaVista.nombre)).join(", ") || "—"}
                />
                <Dato k="Especie" v={zonaVista.especie ?? <PorConfirmar />} />
                <Dato k="Variedad" v={zonaVista.variedad ?? <PorConfirmar />} />
                <Dato k="Edad" v={zonaVista.edad_aprox_anios ? `~${zonaVista.edad_aprox_anios} años` : <PorConfirmar />} />
                <Dato k="Árboles" v={zonaVista.n_arboles ? formatoNumero(zonaVista.n_arboles) : <PorConfirmar />} />
                <Dato
                  k="Superficie"
                  v={
                    zonaVista.superficie_ha ? (
                      `${formatoNumero(Number(zonaVista.superficie_ha), 2)} ha`
                    ) : (
                      <PorConfirmar>pendiente de medir</PorConfirmar>
                    )
                  }
                />
                <Dato
                  k="Sector de riego"
                  v={
                    sectoresDeZona(zonaVista.id).length ? (
                      sectoresDeZona(zonaVista.id)
                        .map((s) => `S${s.numero}`)
                        .join(", ")
                    ) : (
                      <PorConfirmar />
                    )
                  }
                />
                <Dato k="Fiabilidad" v={zonaVista.fiabilidad} />
              </div>
            </Panel>
          )}

          {vista === "sectores" && riego}

          {lateral}
        </div>
      </div>
    </main>
  );
}
