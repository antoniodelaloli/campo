"use client";

import { startTransition, useActionState, useState } from "react";
import { guardarFactura, type EstadoFormCuentas } from "./actions";
import { CATEGORIAS_GASTO, COLOR_ESTADO, estadoDe, type Titular } from "@/lib/cuentas-calculo";
import { createClient } from "@/lib/supabase/client";

const inicial: EstadoFormCuentas = { ok: false, mensaje: null };

const eur = (n: number) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Math.round(n))} €`;

const MAX_MB = 15;

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

/** Sube la foto o el PDF al cajón privado «facturas» y devuelve su ruta. */
async function subirArchivo(archivo: File, fecha: string): Promise<string> {
  if (archivo.size > MAX_MB * 1024 * 1024) throw new Error(`El archivo pasa de ${MAX_MB} MB.`);
  const anio = /^\d{4}/.test(fecha) ? fecha.slice(0, 4) : String(new Date().getFullYear());
  const limpio = archivo.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(-60);
  const ruta = `${anio}/${crypto.randomUUID().slice(0, 8)}-${limpio || "factura"}`;
  const { error } = await createClient()
    .storage.from("facturas")
    .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  return ruta;
}

type Opcion = { id: string; nombre: string };

function FormFactura({
  tipo,
  titulares,
  fincas,
  hoy,
  conArchivos,
}: {
  tipo: "venta" | "gasto";
  titulares: Opcion[];
  fincas: Opcion[];
  hoy: string;
  conArchivos: boolean;
}) {
  const [estado, accion, pendiente] = useActionState(guardarFactura, inicial);
  const [subiendo, setSubiendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const venta = tipo === "venta";

  // Primero se sube el archivo (directo desde el navegador, sin límite de tamaño
  // del servidor) y luego se guarda la factura con su ruta.
  async function enviar(fd: FormData) {
    setErrorArchivo(null);
    const archivo = fd.get("archivo");
    fd.delete("archivo");
    if (archivo instanceof File && archivo.size > 0) {
      setSubiendo(true);
      try {
        fd.set("archivo_path", await subirArchivo(archivo, String(fd.get("fecha") ?? "")));
      } catch (e) {
        setSubiendo(false);
        setErrorArchivo(`No se pudo subir el archivo: ${e instanceof Error ? e.message : e}`);
        return;
      }
      setSubiendo(false);
    }
    startTransition(() => accion(fd));
  }

  const ocupado = pendiente || subiendo;

  return (
    <form key={estado.guardadoEn ?? 0} action={enviar} className="flex flex-col gap-2.5">
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          {venta ? "A nombre de" : "Lo paga"}
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
          {venta ? "Limón de la finca" : "Para la finca"}
          <select name="finca" className="campo" defaultValue="">
            <option value="">{venta ? "—" : "Todas / ninguna"}</option>
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
        {venta ? (
          <label className="flex flex-col gap-1 text-sm font-bold">
            ¿Ya está hecha?
            <select name="estado" className="campo" defaultValue="emitida">
              <option value="emitida">Sí, emitida</option>
              <option value="prevista">No, es una previsión</option>
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-bold">
            Tipo de gasto
            <select name="categoria" required className="campo" defaultValue="">
              <option value="" disabled>
                Elige…
              </option>
              {Object.entries(CATEGORIAS_GASTO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          {venta ? "Comprador" : "Proveedor"}
          <input name="contraparte" placeholder={venta ? "Citrisol" : "Agroquímicos…"} className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Nº de factura
          <input name="numero" className="campo" />
        </label>
      </div>

      <div className={`grid gap-2 ${venta ? "grid-cols-3" : "grid-cols-2"}`}>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Base (€)
          <input name="base" inputMode="decimal" required placeholder={venta ? "45.000" : "1.250"} className="campo" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          {venta ? "IVA / comp. (€)" : "IVA (€)"}
          <input name="impuesto" inputMode="decimal" placeholder={venta ? "5.400" : "262,50"} className="campo" />
        </label>
        {venta && (
          <label className="flex flex-col gap-1 text-sm font-bold">
            Kilos
            <input name="kg" inputMode="decimal" placeholder="80.000" className="campo" />
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm font-bold">
        Concepto o notas
        <input name="concepto" placeholder={venta ? "Primer corte limón Fino" : "Abono de noviembre"} className="campo" />
      </label>

      {conArchivos ? (
        <label className="flex flex-col gap-1 text-sm font-bold">
          Factura (foto o PDF)
          <input
            type="file"
            name="archivo"
            accept="application/pdf,image/*"
            className="campo file:mr-3 file:border-2 file:border-tinta file:bg-[#fff8e2] file:px-2 file:font-bold"
          />
          <span className="text-xs font-normal text-tinta-suave">
            Desde el móvil puedes hacer la foto directamente. Hasta {MAX_MB} MB.
          </span>
        </label>
      ) : (
        <p className="text-xs text-tinta-suave">
          Para adjuntar la foto o el PDF hay que ejecutar la migración 0015 en Supabase.
        </p>
      )}

      {venta && (
        <p className="text-xs text-tinta-suave">
          Para el límite cuenta la <b>base</b>, sin IVA ni la compensación agraria del 12 %.
        </p>
      )}
      {errorArchivo && <Mensaje estado={{ ok: false, mensaje: errorArchivo }} />}
      <Mensaje estado={estado} />
      <button type="submit" disabled={ocupado} className={venta ? "boton" : "boton-madera"}>
        {subiendo ? "Subiendo la factura…" : pendiente ? "Guardando…" : venta ? "Apuntar factura de venta" : "Apuntar factura de gasto"}
      </button>
    </form>
  );
}

/** Formulario con dos pestañas: venta o gasto. */
export function ApuntarFactura(props: {
  titulares: Opcion[];
  fincas: Opcion[];
  hoy: string;
  conArchivos: boolean;
  conGastos: boolean;
}) {
  const [tipo, setTipo] = useState<"venta" | "gasto">("venta");
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Tipo de factura" className="flex gap-1.5">
        {(
          [
            ["venta", "Venta (ingreso)"],
            ["gasto", "Gasto"],
          ] as const
        ).map(([k, v]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tipo === k}
            onClick={() => setTipo(k)}
            className="pestana aria-selected:bg-sol"
          >
            {v}
          </button>
        ))}
      </div>
      {tipo === "gasto" && !props.conGastos ? (
        <p className="ficha-pendiente p-3 text-sm">Para apuntar gastos hay que ejecutar la migración 0015 en Supabase.</p>
      ) : (
        <FormFactura key={tipo} tipo={tipo} {...props} />
      )}
    </div>
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
