"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/", label: "Mapa", icono: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" },
  { href: "/tareas", label: "Tareas", icono: "M5 4h14v17H5z M9 3h6v3H9z M8.5 13l2.5 2.5L15.5 11" },
  { href: "/calendario", label: "Agenda", icono: "M4 6h16v15H4z M4 10h16 M8 3v5 M16 3v5 M8 14h2 M14 14h2 M8 17h2" },
  { href: "/agua", label: "Agua", icono: "M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z" },
  { href: "/tratamientos", label: "Tratos", icono: "M9 3h6 M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" },
  { href: "/cosecha", label: "Cosecha", icono: "M4 12c0-4 4-7 8-7s8 3 8 7-4 7-8 7-8-3-8-7z M2 12h2 M20 12h2" },
];

function activa(ruta: string | null, href: string) {
  if (!ruta) return false;
  if (href === "/") return ruta === "/" || ruta.startsWith("/fincas");
  return ruta === href || ruta.startsWith(`${href}/`);
}

/** Barra de herramientas inferior (como el inventario de un juego). */
export function DockVista({ ruta }: { ruta: string | null }) {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-[2147483000] border-t-4 border-madera-oscura bg-madera px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:inset-x-auto lg:bottom-3 lg:left-1/2 lg:w-[700px] lg:-translate-x-1/2 lg:rounded-[6px] lg:border-4 lg:p-1 lg:shadow-[0_4px_0_#3b2412,inset_0_0_0_2px_#b07a40]"
    >
      <ul className="flex items-stretch justify-around gap-1">
        {SECCIONES.map((s) => {
          const on = activa(ruta, s.href);
          return (
            <li key={s.href} className="flex-1">
              <Link
                href={s.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-[3px] border-2 ${
                  on
                    ? "border-tinta bg-pergamino text-tinta"
                    : "border-transparent text-pergamino hover:bg-madera-clara/40"
                }`}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d={s.icono} />
                </svg>
                <span className="font-pixel text-[13px] font-bold">{s.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Dock() {
  const ruta = usePathname();
  return <DockVista ruta={ruta} />;
}
