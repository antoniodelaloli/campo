"use client";

import { useActionState, useEffect, useState } from "react";
import { iniciarSesion, type LoginState } from "./actions";

const estadoInicial: LoginState = { error: null };

export default function LoginPage() {
  const [estado, accion, pendiente] = useActionState(
    iniciarSesion,
    estadoInicial,
  );
  // Adónde volver después de entrar (p. ej. el permiso para ChatGPT o Claude)
  const [siguiente, setSiguiente] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee una vez de la dirección
    setSiguiente(new URLSearchParams(window.location.search).get("siguiente") ?? "");
  }, []);
  const vieneDeAsistente = siguiente.startsWith("/oauth/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-hierba px-4">
      <form action={accion} className="panel w-full max-w-sm space-y-5 p-6">
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true" className="pixel">
            <rect x="3" y="6" width="18" height="12" fill="#f6d743" stroke="#3b2a1a" strokeWidth="2" />
            <rect x="1" y="10" width="3" height="4" fill="#f6d743" stroke="#3b2a1a" strokeWidth="2" />
            <rect x="20" y="10" width="3" height="4" fill="#f6d743" stroke="#3b2a1a" strokeWidth="2" />
            <rect x="11" y="2" width="6" height="4" fill="#46a047" stroke="#3b2a1a" strokeWidth="1.5" />
          </svg>
          <div>
            <h1 className="titulo-pixel text-3xl tracking-widest">CAMPO</h1>
            <p className="text-sm text-tinta-suave">Gestión interna de fincas</p>
          </div>
        </div>

        <input type="hidden" name="siguiente" value={siguiente} />
        {vieneDeAsistente && (
          <p className="ficha-pendiente p-3 text-sm">
            Entra con tu usuario de Campo para conectarlo con tu asistente (ChatGPT o Claude).
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-sm font-bold">Email</span>
          <input name="email" type="email" autoComplete="email" required className="campo" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-bold">Contraseña</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="campo"
          />
        </label>

        {estado.error && (
          <p role="alert" className="border-2 border-aviso bg-papel px-3 py-2 text-sm font-semibold text-[#7d1a10]">
            {estado.error}
          </p>
        )}

        <button type="submit" disabled={pendiente} className="boton w-full">
          {pendiente ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
