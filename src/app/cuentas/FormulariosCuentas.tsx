"use client";

import { useActionState, useState } from "react";
import { guardarFactura, type EstadoFormCuentas } from "./actions";
import { COLOR_ESTADO, estadoDe, type Titular } from "@/lib/cuentas-calculo";

const inicial: EstadoFormCuentas = { ok: false, mensaje: null };

const eur = (n: number) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Math.round(n))} €`;


function numero(s: string) {
  let t = s.trim().replace(/\s|€/g, "");
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function Mensaje({ estado }: { estado: EstadoFormCuentas }) {
  if (!estado.mensaje) return null;
  return (
    <p
      role={estado.ok ? "status" : "alert"}
      className={`border-2 px-3 py-2 text-sm font-semibold ${
        estado.ok ? "border-hoja bg-[#eaf5dc] text-hoja-oscura" : "border-aviso bg-papel text-[#7d1a10]"
      }`}
    >
      {estado.mensaje}
    </p>
  );
}

export function FormFactura({
  titulares,
  fincas,
  hoy,
}: {
  titulares: { id: string; nombre: string }[];
  fincas: { id: string; nombre: string }[];
  hoy: string;
}) {
  const [estado, accion, pendiente] = useActionState(guardarFactura, inicial);
  return (
    <form key={estado.guardadoEn ?? 0} action={accion} className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          A nombre de
          <select name="titular" required className="campo" defaultValue="">
            <option value="" disabled>
              Elige…
            </option>
            {titulares.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Limón de la finca
          <select name="finca" className="campo" defaultValue="">
            <option value="">—</option>
            {fincas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Fecha de la factura
          <input type="date" name="fecha" defaultValue={hoy} required className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          ¿Ya está hecha?
          <select name="estado" className="campo" defaultValue="emitida">
            <option value="emitida">Sí, emitida</option>
            <option value="prevista">No, es una previsión</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Comprador
          <input name="contraparte" placeholder="Citrisol" className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Nº de factura
          <input name="numero" className="campo" />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Base (€)
          <input name="base" inputMode="decimal" required placeholder="45.000" className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          IVA / comp. (€)
          <input name="impuesto" inputMode="decimal" placeholder="5.400" className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Kilos
          <input name="kg" inputMode="decimal" placeholder="80.000" className="campo" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-bold">
        Concepto o notas
        <input name="concepto" placeholder="Primer corte limón Fino" className="campo" />
      </label>
      <p className="text-xs text-tinta-suave">
        Para el límite cuenta la <b>base</b>, sin IVA ni la compensación agraria del 12 %.
      </p>
      <Mensaje estado={estado} />
      <button type="submit" disabled={pendiente} className="boton">
        {pendiente ? "Guardando…" : "Apuntar factura de venta"}
      </button>
    </form>
  );
}

/** «¿A nombre de quién facturo este corte?»: cómo quedaría cada titular. */
export function Simulador({
  titulares,
}: {
  titulares: (Titular & { facturado: number; previsto: number })[];
}) {
  const [kg, setKg] = useState("");
  const [precio, setPrecio] = useState("");
  const [base, setBase] = useState("");
  const importe = numero(base) || numero(kg) * numero(precio);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Kilos
          <input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" placeholder="200.000" className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          € / kg
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" placeholder="0,55" className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          o base (€)
          <input value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" placeholder="110.000" className="campo" />
        </label>
      </div>
      {importe > 0 ? (
        <>
          <p className="text-sm">
            Factura de <b>{eur(importe)}</b> (base). Así quedaría cada uno este año, contando lo ya facturado y lo previsto:
          </p>
          <ul className="flex flex-col gap-2">
            {titulares.map((t) => {
              const total = t.facturado + t.previsto + importe;
              const e = estadoDe(t, total);
              const c = COLOR_ESTADO[e];
              return (
                <li key={t.id} className="ficha flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <b>A nombre de {t.nombre}</b>
                  <span>
                    {eur(total)} · <span style={{ color: c.texto }} className="font-bold">{c.etiqueta}</span>
                    {e === "bien" || e === "aviso" ? ` · le quedarían ${eur(t.tope_seguridad_eur - total)} hasta el tope` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-sm text-tinta-suave">Escribe los kilos y el precio previstos del corte (o la base) para ver a quién le cabe.</p>
      )}
    </div>
  );
}
