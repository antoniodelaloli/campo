"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { desactivarSuscripcion, enviarPrueba, guardarSuscripcion } from "@/app/avisos/push-actions";

// Botón «Avisarme en este móvil». Registra el service worker (/sw.js),
// pide permiso, apunta el móvil en Supabase y permite mandar un aviso de prueba.

type Estado =
  | "cargando"
  | "no-soportado"
  | "ios-instalar"
  | "bloqueado"
  | "sin-clave"
  | "inactivo"
  | "activo";

const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function base64UrlABytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = window.atob(b64);
  const salida = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) salida[i] = bruto.charCodeAt(i);
  return salida;
}

function esIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function esInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function nombreDispositivo() {
  const ua = navigator.userAgent;
  const so = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac/.test(ua)
            ? "Mac"
            : "Otro";
  const nav = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return `${so}${nav ? ` · ${nav}` : ""}${esInstalada() ? " (app)" : ""}`;
}

async function registrar() {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  return reg;
}

export function AvisosMovil() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  const comprobar = useCallback(async () => {
    const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!soporta) {
      setEstado(esIOS() && !esInstalada() ? "ios-instalar" : "no-soportado");
      return;
    }
    if (!CLAVE_PUBLICA) {
      setEstado("sin-clave");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("bloqueado");
      return;
    }
    try {
      const reg = await registrar();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Por si entró otra persona en este móvil o se perdió en el servidor
        await guardarSuscripcion(JSON.parse(JSON.stringify(sub)), nombreDispositivo());
        setEstado("activo");
      } else {
        setEstado("inactivo");
      }
    } catch {
      setEstado("no-soportado");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- comprobación inicial del navegador
    comprobar();
  }, [comprobar]);

  function activar() {
    setMensaje(null);
    empezar(async () => {
      try {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          setEstado(permiso === "denied" ? "bloqueado" : "inactivo");
          if (permiso !== "denied") setMensaje({ tipo: "error", texto: "Hace falta pulsar «Permitir» para recibir avisos." });
          return;
        }
        const reg = await registrar();
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlABytes(CLAVE_PUBLICA),
          }));
        const r = await guardarSuscripcion(JSON.parse(JSON.stringify(sub)), nombreDispositivo());
        if (!r.ok) {
          setMensaje({ tipo: "error", texto: r.error });
          return;
        }
        setEstado("activo");
        setMensaje({ tipo: "ok", texto: "Listo: este móvil recibirá los avisos. Prueba a mandarte uno." });
      } catch (e) {
        setMensaje({ tipo: "error", texto: `No se pudo activar: ${e instanceof Error ? e.message : String(e)}` });
      }
    });
  }

  function desactivar() {
    setMensaje(null);
    empezar(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await desactivarSuscripcion(sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado("inactivo");
      setMensaje({ tipo: "ok", texto: "Este móvil ya no recibirá avisos." });
    });
  }

  function probar() {
    setMensaje(null);
    empezar(async () => {
      const r = await enviarPrueba();
      setMensaje(r.ok ? { tipo: "ok", texto: r.mensaje ?? "Aviso enviado." } : { tipo: "error", texto: r.error });
    });
  }

  return (
    <div className="flex flex-col gap-2.5 text-sm">
      <p className="text-tinta-suave">
        Cada mañana a las 7:50 te avisa de las fechas clave que tocan (una semana antes, el día antes y el mismo día,
        o lo que pongas en «Avisar») y de las tareas apuntadas para ese día. Los lunes, repaso de la semana.
      </p>

      {estado === "cargando" && <p className="text-tinta-suave">Comprobando este móvil…</p>}

      {estado === "ios-instalar" && (
        <div className="ficha-pendiente flex flex-col gap-1 p-3">
          <p className="font-bold">En iPhone, primero hay que instalar Campo:</p>
          <ol className="list-decimal pl-5">
            <li>Abre esta página en Safari.</li>
            <li>
              Pulsa <b>Compartir</b> (el cuadrado con la flecha) → <b>Añadir a pantalla de inicio</b>.
            </li>
            <li>Abre Campo desde el icono nuevo y vuelve aquí.</li>
          </ol>
          <p className="text-tinta-suave">Hace falta iOS 16.4 o posterior.</p>
        </div>
      )}

      {estado === "no-soportado" && (
        <p className="ficha-pendiente p-3">
          Este navegador no admite avisos. En Android usa Chrome; en iPhone, Campo instalado desde Safari.
        </p>
      )}

      {estado === "sin-clave" && (
        <p className="ficha-pendiente p-3">
          Falta configurar las claves de avisos (<code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>) en Vercel.
        </p>
      )}

      {estado === "bloqueado" && (
        <div className="ficha-pendiente flex flex-col gap-1 p-3">
          <p className="font-bold">Los avisos están bloqueados para Campo en este móvil.</p>
          <p>
            Para activarlos: en Android, toca el candado junto a la dirección → Permisos → Notificaciones → Permitir. En
            iPhone: Ajustes → Notificaciones → Campo → Permitir notificaciones. Luego recarga esta página.
          </p>
        </div>
      )}

      {estado === "inactivo" && (
        <button type="button" className="boton w-full" onClick={activar} disabled={pendiente}>
          {pendiente ? "Activando…" : "Avisarme en este móvil"}
        </button>
      )}

      {estado === "activo" && (
        <>
          <p className="font-bold text-hoja-oscura">✓ Este móvil recibe los avisos.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton flex-1" onClick={probar} disabled={pendiente}>
              {pendiente ? "Enviando…" : "Mandarme un aviso de prueba"}
            </button>
            <button type="button" className="boton-madera" onClick={desactivar} disabled={pendiente}>
              Dejar de avisar
            </button>
          </div>
        </>
      )}

      {mensaje && (
        <p
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={mensaje.tipo === "error" ? "font-bold text-[#7d1a10]" : "font-bold text-hoja-oscura"}
        >
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
