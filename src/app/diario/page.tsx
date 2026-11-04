import { Suspense } from "react";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, ChipFinca } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { fechaCorta, hoyISO } from "@/lib/texto";
import { nombreMes } from "@/lib/agenda";

// Diario de las fincas: lo que ya ha pasado («ha venido Diego», «se ha terminado de
// fumigar»). Casi todo llega por voz desde ChatGPT o Claude (herramienta «nota_diario»).
// Solo lectura. Se llega desde la ficha de cada finca y desde la Agenda.

export const instant = false;

type Nota = {
  id: string;
  fecha: string;
  texto: string;
  origen: string;
  created_at: string;
  fincas: { nombre: string } | null;
  profiles: { nombre: string | null } | null;
};

export default function DiarioPage({ searchParams }: PageProps<"/diario">) {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Diario searchParams={searchParams} />
      </Suspense>
    </Marco>
  );
}

async function Diario({ searchParams }: { searchParams: PageProps<"/diario">["searchParams"] }) {
  const { supabase } = await obtenerContexto();
  const sp = await searchParams;
  const fincaId = typeof sp.finca === "string" ? sp.finca : null;
  const hoy = hoyISO();

  let q = supabase
    .from("diario")
    .select("id, fecha, texto, origen, created_at, fincas(nombre), profiles:created_by(nombre)")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (fincaId) q = q.eq("finca_id", fincaId);
  const { data, error } = await q.overrideTypes<Nota[], { merge: false }>();
  const notas = data ?? [];
  const nombreFinca = fincaId ? (notas[0]?.fincas?.nombre ?? null) : null;

  const porMes = new Map<string, Nota[]>();
  for (const n of notas) {
    const mes = n.fecha.slice(0, 7);
    porMes.set(mes, [...(porMes.get(mes) ?? []), n]);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion
        titulo={nombreFinca ? `Diario · ${nombreFinca}` : "Diario de las fincas"}
        subtitulo="Lo que ya ha pasado en el campo, día a día. Llega sobre todo por voz desde ChatGPT o Claude."
        volver={fincaId ? `/fincas/${fincaId}` : "/calendario"}
      />

      {error && (
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          No se pudo cargar el diario: {error.message}
        </p>
      )}

      {!error && notas.length === 0 && (
        <p className="ficha-pendiente p-4 text-sm text-tinta-suave">
          Todavía no hay nada en el diario. Dile a tu asistente algo como: «apunta en el diario que hoy ha venido Diego a
          ver los limoneros de Corvera».
        </p>
      )}

      {[...porMes.entries()].map(([mes, lista]) => (
        <section key={mes} className="flex flex-col gap-2" aria-labelledby={`mes-${mes}`}>
          <h2 id={`mes-${mes}`} className="titulo-pixel text-xl">
            {nombreMes(`${mes}-01`)}
          </h2>
          <ul className="flex flex-col gap-2">
            {lista.map((n) => (
              <li key={n.id} className="ficha flex flex-col gap-1.5 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold">{fechaCorta(n.fecha, hoy)}</span>
                  {n.fincas && <ChipFinca nombre={n.fincas.nombre} />}
                  <span className="ml-auto text-xs text-tinta-suave">
                    {n.profiles?.nombre ?? ""}
                    {n.origen === "conector" ? " · por voz" : ""}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line">{n.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {fincaId && (
        <a href="/diario" className="self-start text-xs font-bold text-tinta-suave underline-offset-2 hover:underline">
          Ver el diario de todas las fincas
        </a>
      )}
    </main>
  );
}
