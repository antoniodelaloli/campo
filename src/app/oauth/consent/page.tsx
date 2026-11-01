import { Suspense } from "react";
import { redirect } from "next/navigation";
import { obtenerContexto } from "@/lib/sesion";
import { Cargando } from "@/components/ui";
import { permitir, rechazar } from "./actions";

// Pantalla que ve quien conecta Campo desde ChatGPT o Claude (una sola vez):
// entra con su usuario de Campo y pulsa «Permitir». El asistente podrá
// consultar y apuntar con SUS permisos (lector solo consulta).

export const instant = false;

export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-hierba px-4 py-8">
      <Suspense fallback={<Cargando />}>
        <Consentimiento searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function nombreAsistente(nombre: string | undefined) {
  if (!nombre) return "Un asistente";
  return nombre;
}

async function Consentimiento({ searchParams }: { searchParams: PageProps<"/oauth/consent">["searchParams"] }) {
  const sp = await searchParams;
  const id = typeof sp.authorization_id === "string" ? sp.authorization_id : "";
  const errorPrevio = typeof sp.error === "string" ? sp.error : null;
  const { supabase, perfil, puedeEditar } = await obtenerContexto();

  if (!id) {
    return (
      <section className="panel w-full max-w-md space-y-3 p-6">
        <h1 className="titulo-pixel text-2xl">Falta la solicitud</h1>
        <p className="text-sm">Vuelve a ChatGPT o Claude y pulsa otra vez «Conectar».</p>
      </section>
    );
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) {
    return (
      <section className="panel w-full max-w-md space-y-3 p-6">
        <h1 className="titulo-pixel text-2xl">No se pudo conectar</h1>
        <p className="text-sm">
          La solicitud ha caducado o no es válida ({error?.message ?? "sin datos"}). Vuelve a ChatGPT o Claude y pulsa otra
          vez «Conectar».
        </p>
      </section>
    );
  }
  // Ya se dio permiso antes: se vuelve directamente al asistente
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const asistente = nombreAsistente(data.client?.name);

  return (
    <section className="panel w-full max-w-md space-y-4 p-6">
      <div className="flex items-center gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true" className="pixel shrink-0">
          <rect x="3" y="6" width="18" height="12" fill="#f6d743" stroke="#3b2a1a" strokeWidth="2" />
          <rect x="1" y="10" width="3" height="4" fill="#f6d743" stroke="#3b2a1a" strokeWidth="2" />
          <rect x="20" y="10" width="3" height="4" fill="#f6d743" stroke="#3b2a1a" strokeWidth="2" />
          <rect x="11" y="2" width="6" height="4" fill="#46a047" stroke="#3b2a1a" strokeWidth="1.5" />
        </svg>
        <h1 className="titulo-pixel text-2xl leading-tight">Conectar Campo con {asistente}</h1>
      </div>

      <p className="text-sm">
        Hola, {perfil.nombre ?? data.user.email}. <b>{asistente}</b> quiere usar Campo con tu usuario ({data.user.email}).
      </p>

      <div className="ficha space-y-1.5 p-3 text-sm">
        <p className="font-bold">Podrá:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Consultar las fincas: fechas clave, tareas, agua, tratamientos y avisos.</li>
          {puedeEditar ? (
            <li>
              Apuntar en tu nombre tareas, niveles de pantano, lecturas de contadores, fechas clave, avisos y notas,
              <b> siempre preguntándote antes</b>.
            </li>
          ) : (
            <li>Tu usuario solo puede consultar: no podrá apuntar nada.</li>
          )}
        </ul>
        <p className="text-tinta-suave">No podrá borrar nada. Lo que apunte quedará marcado «desde el asistente».</p>
      </div>

      {errorPrevio && (
        <p role="alert" className="border-2 border-aviso bg-papel px-3 py-2 text-sm font-semibold text-[#7d1a10]">
          No se pudo completar: {errorPrevio}
        </p>
      )}

      <div className="flex gap-2">
        <form action={rechazar} className="flex-1">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <button type="submit" className="boton-madera w-full">
            No permitir
          </button>
        </form>
        <form action={permitir} className="flex-1">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <button type="submit" className="boton w-full">
            Permitir
          </button>
        </form>
      </div>
    </section>
  );
}
