"use client";

import { useActionState, useMemo, useState } from "react";
import { leerHoja } from "@/lib/albaranes";
import { guardarHoja, type EstadoImportar } from "./actions";

type Opcion = { id: string; nombre: string };

const inicial: EstadoImportar = { ok: false, mensaje: null };
const kg = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Math.round(n));
const eur = (n: number) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n)} €`;
const fecha = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}/${iso.slice(2, 4)}`;

/**
 * Pegar una hoja de albaranes del Excel: se lee al momento, se enseña lo que se
 * ha entendido (campaña, finca, titular, corte, kilos) y se guarda.
 */
export function ImportarHoja({ fincas, titulares }: { fincas: Opcion[]; titulares: Opcion[] }) {
  const [texto, setTexto] = useState("");
  const [campana, setCampana] = useState("");
  const [finca, setFinca] = useState("");
  const [titular, setTitular] = useState("");
  const [corte, setCorte] = useState("");
  const [hoja, setHoja] = useState("");
  const [estado, accion, enviando] = useActionState(async (prev: EstadoImportar, fd: FormData) => {
    const r = await guardarHoja(prev, fd);
    if (r.ok) setTexto(""); // tras guardar, se vacía
    return r;
  }, inicial);

  const leida = useMemo(() => (texto.trim() ? leerHoja(texto, /^\d{4}\/\d{2}$/.test(campana) ? campana : null) : null), [texto, campana]);

  /** Al pegar una hoja nueva, se rellenan los campos con lo que dice su título (se pueden cambiar). */
  function cambiarTexto(v: string) {
    const nueva = !texto.trim() && v.trim();
    setTexto(v);
    if (!nueva) return;
    const l = leerHoja(v);
    const id = (lista: Opcion[], nombre: string | null) => lista.find((o) => o.nombre === nombre)?.id ?? "";
    setCampana(l.sugerido.campana ?? "");
    setFinca(id(fincas, l.sugerido.finca));
    setTitular(id(titulares, l.sugerido.titular));
    setCorte(l.sugerido.corte ? String(l.sugerido.corte) : "");
    setHoja((l.titulo.split(" | ")[0] ?? "").slice(0, 120));
  }

  const filas = leida?.filas ?? [];
  const kgB = filas.reduce((s, f) => s + f.kg_buenos, 0);
  const kgC = filas.reduce((s, f) => s + f.kg_citrica, 0);
  const importe = filas.reduce((s, f) => s + (f.importe_eur ?? 0), 0);
  const conImporte = filas.filter((f) => f.importe_eur != null).reduce((s, f) => s + f.kg_buenos, 0);
  const fechas = filas.map((f) => f.fecha).sort();

  return (
    <form action={accion} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-bold">
        Pega aquí la hoja del Excel (selecciona desde el título hasta los totales y copia)
        <textarea
          name="texto"
          value={texto}
          onChange={(e) => cambiarTexto(e.target.value)}
          rows={6}
          placeholder={"3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026\nAlbarán\tFECHA\tCAJA\t…\n71359\t24-2\t…"}
          className="campo font-mono text-xs"
          spellCheck={false}
        />
      </label>

      {leida && (
        <>
          <div className="grid gap-2 sm:grid-cols-5">
            <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-2">
              Nombre de la hoja
              <input name="hoja" value={hoja} onChange={(e) => setHoja(e.target.value)} required className="campo" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Campaña
              <input name="campana" value={campana} onChange={(e) => setCampana(e.target.value)} placeholder="2025/26" required className="campo" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Corte
              <select name="corte" value={corte} onChange={(e) => setCorte(e.target.value)} className="campo">
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}º
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Finca
              <select name="finca" value={finca} onChange={(e) => setFinca(e.target.value)} className="campo">
                <option value="">Por confirmar</option>
                {fincas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-2">
              A nombre de
              <select name="titular" value={titular} onChange={(e) => setTitular(e.target.value)} className="campo">
                <option value="">Por confirmar</option>
                {titulares.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ficha-pendiente flex flex-col gap-1 px-3 py-2 text-[13px] leading-snug">
            {filas.length ? (
              <p>
                <b>{filas.length} albaranes</b>
                {fechas.length ? ` del ${fecha(fechas[0])} al ${fecha(fechas[fechas.length - 1])}` : ""} ·{" "}
                <b>{kg(kgB)} kg buenos</b>
                {kgC > 0 && ` · ${kg(kgC)} kg de cítrica (${Math.round((kgC / (kgB + kgC)) * 100)} %)`}
                {importe > 0 && ` · ${eur(importe)}`}
                {conImporte > 0 && ` (${(importe / conImporte).toFixed(3).replace(".", ",")} €/kg)`}
                {leida.totalHoja != null && ` · la hoja suma ${kg(leida.totalHoja)} kg`}
              </p>
            ) : (
              <p>Todavía no veo albaranes en lo pegado.</p>
            )}
            {leida.avisos.map((a) => (
              <p key={a} className="text-[#7d1a10]">
                ⚠ {a}
              </p>
            ))}
          </div>

          {filas.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[13px] font-bold">Ver los albaranes leídos</summary>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs tabular-nums">
                  <thead>
                    <tr className="text-left text-tinta-suave">
                      <th className="py-1">Albarán</th>
                      <th className="py-1">Fecha</th>
                      <th className="py-1 text-right">Cajas</th>
                      <th className="py-1 text-right">Buenos</th>
                      <th className="py-1 text-right">Cítrica</th>
                      <th className="py-1 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={i} className="border-t border-dotted border-borde-papel">
                        <td className="py-0.5">{f.albaran}</td>
                        <td className="py-0.5">{fecha(f.fecha)}</td>
                        <td className="py-0.5 text-right">{f.cajas ?? ""}</td>
                        <td className="py-0.5 text-right">{f.kg_buenos ? kg(f.kg_buenos) : ""}</td>
                        <td className="py-0.5 text-right">{f.kg_citrica ? kg(f.kg_citrica) : ""}</td>
                        <td className="py-0.5 text-right">{f.importe_eur != null ? eur(f.importe_eur) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <button type="submit" disabled={enviando || filas.length === 0} className="boton self-start">
            {enviando ? "Guardando…" : `Guardar ${filas.length} albaranes`}
          </button>
        </>
      )}

      {estado.mensaje && (
        <p
          role={estado.ok ? "status" : "alert"}
          className={`border-2 px-3 py-2 text-sm font-semibold ${
            estado.ok ? "border-hoja bg-[#eaf5dc] text-hoja-oscura" : "border-aviso bg-papel text-[#7d1a10]"
          }`}
        >
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
