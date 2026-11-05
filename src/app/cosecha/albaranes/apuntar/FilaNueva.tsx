"use client";

import { useActionState, useRef, useState } from "react";
import { apuntarAlbaran, type EstadoApuntar } from "../actions";

const inicial: EstadoApuntar = { ok: false, mensaje: null };

const num = (s: string) => {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return null;
  const limpio = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};
const kg = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(n);

/**
 * Una línea para apuntar un albarán, con las mismas columnas que el Excel de
 * Juan Carlos. Los kilos se calculan solos con la pesada (bruto − tara del
 * camión − 2,5 kg por caja); si el albarán no trae pesada, se escriben a mano.
 * Al guardar, se queda la fecha y el precio, y se vacía lo demás.
 */
export function FilaNueva({
  campana,
  hoja,
  finca,
  titular,
  corte,
  fechaInicial,
  precioInicial,
  fincas,
  titulares,
}: {
  campana: string;
  hoja: string;
  finca: string;
  titular: string;
  corte: string;
  fechaInicial: string;
  precioInicial: string;
  fincas: { id: string; nombre: string }[];
  titulares: { id: string; nombre: string }[];
}) {
  // de dónde sale el limón y a quién se factura: se eligen en cada albarán y se
  // quedan para el siguiente (lo normal es que no cambien en todo el corte)
  const [fincaSel, setFincaSel] = useState(finca);
  const [titularSel, setTitularSel] = useState(titular);
  const [fecha, setFecha] = useState(fechaInicial);
  const [precio, setPrecio] = useState(precioInicial);
  const [albaran, setAlbaran] = useState("");
  const [cajas, setCajas] = useState("");
  const [bruto, setBruto] = useState("");
  const [taraCamion, setTaraCamion] = useState("");
  const [taraCajas, setTaraCajas] = useState("");
  const [kgBuenos, setKgBuenos] = useState("");
  const [kgCitrica, setKgCitrica] = useState("");
  const [notas, setNotas] = useState("");
  const primero = useRef<HTMLInputElement>(null);

  const [estado, accion, enviando] = useActionState(async (prev: EstadoApuntar, fd: FormData) => {
    const r = await apuntarAlbaran(prev, fd);
    if (r.ok) {
      for (const f of [setAlbaran, setCajas, setBruto, setTaraCamion, setTaraCajas, setKgBuenos, setKgCitrica, setNotas]) f("");
      primero.current?.focus();
    }
    return r;
  }, inicial);

  // cálculo en vivo, como en el Excel
  const nCajas = num(cajas) ?? 0;
  const nBruto = num(bruto);
  const nTaraC = num(taraCamion);
  const taraCajasAuto = nCajas * 2.5;
  const nTaraK = num(taraCajas) ?? taraCajasAuto;
  const neto = nBruto && nTaraC != null ? nBruto - nTaraC - nTaraK : null;
  const kgFinal = num(kgBuenos) ?? neto ?? 0;
  const kgCaja = nCajas > 0 && kgFinal > 0 ? kgFinal / nCajas : null;
  const importe = (num(precio) ?? 0) * kgFinal;
  const raro = kgCaja != null && (kgCaja < 15 || kgCaja > 24);

  const campo = "campo px-2 py-1.5 text-sm tabular-nums";
  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="campana" value={campana} />
      <input type="hidden" name="hoja" value={hoja} />
      <input type="hidden" name="corte" value={corte} />
      <div className="grid grid-cols-2 gap-2 sm:max-w-xl">
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          Finca de donde sale el limón
          <select name="finca" value={fincaSel} onChange={(e) => setFincaSel(e.target.value)} className={campo}>
            <option value="">Por confirmar</option>
            {fincas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          Se factura a
          <select name="titular" value={titularSel} onChange={(e) => setTitularSel(e.target.value)} className={campo}>
            <option value="">Por confirmar</option>
            {titulares.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-[1fr_1.2fr_0.8fr_1fr_1fr_0.9fr_1fr_1fr_0.8fr]">
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          Albarán
          <input ref={primero} name="albaran" value={albaran} onChange={(e) => setAlbaran(e.target.value)} required autoFocus className={campo} inputMode="numeric" placeholder="71359" />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          Fecha
          <input type="date" name="fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={campo} />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          Cajas
          <input name="cajas" value={cajas} onChange={(e) => setCajas(e.target.value)} className={campo} inputMode="numeric" placeholder="594" />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          Bruto
          <input name="bruto" value={bruto} onChange={(e) => setBruto(e.target.value)} className={campo} inputMode="numeric" placeholder="24.320" />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          Tara camión
          <input name="tara_camion" value={taraCamion} onChange={(e) => setTaraCamion(e.target.value)} className={campo} inputMode="numeric" placeholder="11.560" />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          Tara cajas
          <input
            name="tara_cajas"
            value={taraCajas}
            onChange={(e) => setTaraCajas(e.target.value)}
            className={campo}
            inputMode="decimal"
            placeholder={nCajas ? kg(taraCajasAuto) : "2,5/caja"}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          Kilos buenos
          <input
            name="kg_buenos"
            value={kgBuenos}
            onChange={(e) => setKgBuenos(e.target.value)}
            className={campo}
            inputMode="decimal"
            placeholder={neto != null ? kg(neto) : "sin pesada"}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          Kilos cítrica
          <input name="kg_citrica" value={kgCitrica} onChange={(e) => setKgCitrica(e.target.value)} className={campo} inputMode="decimal" placeholder="0" />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-bold">
          € / kg
          <input name="precio" value={precio} onChange={(e) => setPrecio(e.target.value)} className={campo} inputMode="decimal" placeholder="0,60" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] tabular-nums">
        <span>
          Neto: <b>{neto != null ? `${kg(neto)} kg` : "—"}</b>
        </span>
        <span>
          Cuentan: <b>{kgFinal ? `${kg(kgFinal)} kg` : "—"}</b>
          {num(kgBuenos) != null && neto != null && Math.abs((num(kgBuenos) ?? 0) - neto) > 0.5 && (
            <span className="text-[#7d1a10]"> (no es el neto: ¿seguro?)</span>
          )}
        </span>
        <span style={raro ? { color: "#7d1a10", fontWeight: 700 } : undefined}>
          Kg/caja: {kgCaja != null ? kg(kgCaja) : "—"}
          {raro && " ⚠ raro (lo normal es 18-21)"}
        </span>
        <span>Importe: {importe ? `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(importe)} €` : "—"}</span>
        <input
          name="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Nota (opcional)"
          className="campo min-w-40 flex-1 px-2 py-1 text-sm"
        />
        <button type="submit" disabled={enviando} className="boton">
          {enviando ? "Guardando…" : "Apuntar"}
        </button>
      </div>
      {estado.mensaje && (
        <p
          role={estado.ok ? "status" : "alert"}
          className={`border-2 px-3 py-1.5 text-sm font-semibold ${
            estado.ok ? "border-hoja bg-[#eaf5dc] text-hoja-oscura" : "border-aviso bg-papel text-[#7d1a10]"
          }`}
        >
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
