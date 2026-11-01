import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { cerrarSesion } from "@/app/auth/actions";
import { obtenerContexto } from "@/lib/sesion";
import { cargarCampanaActual } from "@/lib/datos";
import { fechaLarga, hoyISO } from "@/lib/texto";
import { Dock, DockVista } from "@/components/Dock";

/** Estructura común: barra superior + contenido + barra inferior. */
export function Marco({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<Barra />}>
        <BarraConSesion />
      </Suspense>
      <div className="flex flex-1 flex-col pb-[84px] lg:pb-24">{children}</div>
      <Suspense fallback={<DockVista ruta={null} />}>
        <Dock />
      </Suspense>
    </>
  );
}

async function BarraConSesion() {
  const { supabase, perfil } = await obtenerContexto();
  const campana = await cargarCampanaActual(supabase);
  return (
    <Barra
      fecha={fechaLarga(hoyISO())}
      campana={campana?.nombre ?? null}
      usuario={perfil.nombre ?? "Usuario"}
      rol={perfil.rol}
    />
  );
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" className="pixel">
      <rect x="3" y="6" width="18" height="12" fill="#f6d743" stroke="#3b2a1a" strokeWidth="2" />
      <rect x="1" y="10" width="3" height="4" fill="#f6d743" stroke="#3b2a1a" strokeWidth="2" />
      <rect x="20" y="10" width="3" height="4" fill="#f6d743" stroke="#3b2a1a" strokeWidth="2" />
      <rect x="11" y="2" width="6" height="4" fill="#46a047" stroke="#3b2a1a" strokeWidth="1.5" />
    </svg>
  );
}

function Barra({
  fecha,
  campana,
  usuario,
  rol,
}: {
  fecha?: string;
  campana?: string | null;
  usuario?: string;
  rol?: string;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b-4 border-madera-oscura bg-madera px-3 shadow-[inset_0_4px_0_#b07a40] sm:px-5">
      <Link href="/" className="flex items-center gap-2" aria-label="Campo, ir al mapa">
        <Logo />
        <span className="font-pixel text-2xl font-bold tracking-widest text-pergamino [text-shadow:0_2px_0_#3b2a1a]">
          CAMPO
        </span>
      </Link>

      <div className="hidden items-center gap-3 md:flex">
        {fecha && (
          <span className="font-pixel text-[17px] text-pergamino first-letter:uppercase">{fecha}</span>
        )}
        {campana && (
          <span className="border-2 border-tinta bg-pergamino px-2.5 py-0.5 font-pixel text-sm text-tinta">
            Campaña {campana}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {usuario && (
          <span className="hidden font-pixel text-[15px] text-pergamino sm:inline">
            {usuario}
            {rol ? ` · ${rol}` : ""}
          </span>
        )}
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center border-[3px] border-tinta bg-sol font-pixel text-lg font-bold text-tinta"
        >
          {(usuario ?? "·").charAt(0).toUpperCase()}
        </span>
        {usuario && (
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="min-h-[40px] border-2 border-pergamino/70 px-2.5 font-pixel text-sm text-pergamino hover:bg-madera-clara/50"
            >
              Salir
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
