import { Suspense } from "react";
import { Marco } from "@/components/Marco";
import { CabeceraSeccion, Cargando, Chip, ChipFinca } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { fechaCorta, hoyISO } from "@/lib/texto";
import { nombreMes } from "@/lib/agenda";
import { cambiarEstadoIdea } from "./actions";

// Libreta de ideas y reflexiones (migración 0007). Página discreta: no está en el
// menú; se llega desde un enlace pequeño en Tareas. Casi todo llega por voz desde
// ChatGPT o Claude; aquí se leen y se marcan como revisadas o descartadas.

export const instant = false;

type Idea = {
  id: string;
  titulo: string;
  texto: string;
  tipo: "idea" | "reflexion" | "duda" | "plan" | "aprendizaje";
  temas: string[];
  estado: "nueva" | "revisada" | "convertida" | "descartada";
  origen: string;
  created_at: string;
  fincas: { nombre: string } | null;
  profiles: { nombre: string | null } | null;
};

const TIPO: Record<Idea["tipo"], string> = {
  idea: "Idea",
  reflexion: "Reflexión",
  duda: "Duda",
  plan: "Plan",
  aprendizaje: "Aprendido",
};

export default function IdeasPage({ searchParams }: PageProps<"/ideas">) {
  return (
    <Marco>
      <Suspense fallback={<Cargando />}>
        <Ideas searchParams={searchParams} />
      </Suspense>
    </Marco>
  );
}

async function Ideas({ searchParams }: { searchParams: PageProps<"/ideas">["searchParams"] }) {
  const { supabase, puedeEditar } = await obtenerContexto();
  const sp = await searchParams;
  const verDescartadas = sp.descartadas === "1";
  const hoy = hoyISO();

  let q = supabase
    .from("ideas")
    .select("id, titulo, texto, tipo, temas, estado, origen, created_at, fincas(nombre), profiles:created_by(nombre)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (!verDescartadas) q = q.neq("estado", "descartada");
  const { data, error } = await q.overrideTypes<Idea[], { merge: false }>();
  const falta = !!error && /ideas/.test(error.message);
  const ideas = data ?? [];

  const porMes = new Map<string, Idea[]>();
  for (const i of ideas) {
    const mes = i.created_at.slice(0, 7);
    porMes.set(mes, [...(porMes.get(mes) ?? []), i]);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5">
      <CabeceraSeccion
        titulo="Libreta de ideas"
        subtitulo="Ideas y reflexiones sobre el campo, sin fecha ni obligación. Llegan sobre todo por voz desde ChatGPT o Claude."
        volver="/tareas"
      />

      {falta && (
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          Falta crear la libreta en Supabase: ejecuta <code>supabase/migrations/0007_ideas.sql</code>.
        </p>
      )}
      {error && !falta && (
        <p role="alert" className="border-2 border-aviso bg-papel p-3 text-sm">
          No se pudieron cargar las ideas: {error.message}
        </p>
      )}

      {!error && ideas.length === 0 && (
        <p className="ficha-pendiente p-4 text-sm text-tinta-suave">
          Todavía no hay ideas. Dile a tu asistente algo como: «apunta una idea: habría que probar a soltar bichos contra el
          cotonet en Valladolises».
        </p>
      )}

      {[...porMes.entries()].map(([mes, lista]) => (
        <section key={mes} className="flex flex-col gap-2" aria-labelledby={`mes-${mes}`}>
          <h2 id={`mes-${mes}`} className="titulo-pixel text-xl">
            {nombreMes(`${mes}-01`)}
          </h2>
          <ul className="flex flex-col gap-2">
            {lista.map((i) => (
              <li key={i.id} className={`ficha flex flex-col gap-1.5 p-3 ${i.estado === "descartada" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tono={i.tipo === "duda" ? "ambar" : i.tipo === "plan" ? "azul" : i.tipo === "aprendizaje" ? "verde" : "neutro"}>
                    {TIPO[i.tipo] ?? i.tipo}
                  </Chip>
                  {i.fincas && <ChipFinca nombre={i.fincas.nombre} />}
                  {i.estado !== "nueva" && <Chip tono={i.estado === "convertida" ? "verde" : "neutro"}>{i.estado}</Chip>}
                  <span className="ml-auto text-xs text-tinta-suave">
                    {fechaCorta(i.created_at.slice(0, 10), hoy)}
                    {i.profiles?.nombre ? ` · ${i.profiles.nombre}` : ""}
                    {i.origen === "conector" ? " · por voz" : ""}
                  </span>
                </div>
                <h3 className="font-bold leading-snug">{i.titulo}</h3>
                {i.texto !== i.titulo && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-tinta-suave">Lo que dijo</summary>
                    <p className="mt-1 leading-relaxed whitespace-pre-line">{i.texto}</p>
                  </details>
                )}
                {i.temas.length > 0 && (
                  <p className="text-xs text-tinta-suave">{i.temas.map((t) => `#${t}`).join("  ")}</p>
                )}
                {puedeEditar && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(["revisada", "convertida", "descartada"] as const)
                      .filter((e) => e !== i.estado)
                      .map((e) => (
                        <form key={e} action={cambiarEstadoIdea}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="estado" value={e} />
                          <button
                            type="submit"
                            className="rounded-[3px] border-2 border-borde-papel bg-papel px-2 py-0.5 text-xs font-bold hover:bg-[#fff2c4]"
                          >
                            {e === "revisada" ? "Revisada" : e === "convertida" ? "Ya es tarea/fecha" : "Descartar"}
                          </button>
                        </form>
                      ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <a
        href={verDescartadas ? "/ideas" : "/ideas?descartadas=1"}
        className="self-start text-xs font-bold text-tinta-suave underline-offset-2 hover:underline"
      >
        {verDescartadas ? "Ocultar las descartadas" : "Ver también las descartadas"}
      </a>
    </main>
  );
}
