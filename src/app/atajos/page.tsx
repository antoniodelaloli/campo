import { Suspense } from "react";
import { headers } from "next/headers";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Panel } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { fechaCorta, hoyISO } from "@/lib/texto";
import { anularClaveAtajo } from "./actions";
import { CrearClave } from "./CrearClave";

export const instant = false;

export default function AtajosPage() {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Atajos />
      </Suspense>
    </Marco>
  );
}

type Clave = { id: string; nombre: string; prefijo: string; activa: boolean; ultimo_uso: string | null; created_at: string };

async function Atajos() {
  const { supabase } = await obtenerContexto();
  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "campo-lac.vercel.app"}`;
  const hoy = hoyISO();
  const { data, error } = await supabase
    .from("claves_atajo")
    .select("id, nombre, prefijo, activa, ultimo_uso, created_at")
    .order("created_at", { ascending: false })
    .overrideTypes<Clave[], { merge: false }>();
  const claves = data ?? [];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion titulo="Atajos de Siri" subtitulo="«Oye Siri, cuaderno»" volver="/calendario" />

      <p className="ficha px-3 py-2.5 text-sm leading-relaxed">
        Di <b>«Oye Siri, cuaderno»</b> o pulsa el botón y habla: Campo lo reparte solo en tareas, fechas clave, diario, ideas
        e incidencias. Si estás en una finca, las incidencias quedan con su <b>sitio exacto</b> en el plano, con «Cómo
        llegar». Lo personal y lo de la confitería no se guardan en Campo.
      </p>

      {error && (
        <p role="alert" className="border-2 border-aviso bg-[#fbe1dc] px-3 py-2 text-sm">
          Falta aplicar la migración 0010 en Supabase para usar los atajos.
        </p>
      )}

      <Panel titulo="Claves">
        {claves.length === 0 ? (
          <p className="text-sm text-tinta-suave">Aún no hay ninguna clave. Crea una para cada iPhone que vaya a usar los atajos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {claves.map((k) => (
              <li key={k.id} className="ficha flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <b>{k.nombre}</b> · <code>{k.prefijo}…</code>
                  <span className="text-tinta-suave">
                    {" "}
                    · {k.ultimo_uso ? `usada el ${fechaCorta(k.ultimo_uso.slice(0, 10), hoy)}` : "sin usar todavía"}
                  </span>
                </span>
                {k.activa ? (
                  <form action={anularClaveAtajo}>
                    <input type="hidden" name="id" value={k.id} />
                    <button type="submit" className="boton-madera min-h-[36px] text-xs">
                      Anular
                    </button>
                  </form>
                ) : (
                  <span className="text-xs font-bold text-tinta-suave">Anulada</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel titulo="Crear una clave y montar los atajos">
        <CrearClave base={base} />
      </Panel>
    </main>
  );
}
