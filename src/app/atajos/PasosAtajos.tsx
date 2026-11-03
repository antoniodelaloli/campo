import type { ReactNode } from "react";

function Cod({ children }: { children: ReactNode }) {
  return <code className="break-all bg-[#f6e7c1] px-1 font-bold">{children}</code>;
}

/** Pasos para montar los dos atajos en la app Atajos del iPhone. */
export function PasosAtajos({ base, clave }: { base: string; clave: string | null }) {
  const c = clave ?? "TU_CLAVE";
  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed">
      <section className="flex flex-col gap-1.5">
        <h3 className="titulo-pixel text-lg">1 · Atajo «Incidencia»</h3>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>Abre la app <b>Atajos</b> → <b>+</b>. Ponle de nombre <b>Incidencia</b> (es lo que se le dice a Siri).</li>
          <li>Añade la acción <b>Obtener ubicación actual</b>.</li>
          <li>
            Añade <b>Lista</b> con: <i>Fuga de agua</i>, <i>Árbol a revisar</i>, <i>Plaga</i>, <i>Avería</i>, <i>Otra cosa</i>.
          </li>
          <li>Añade <b>Elegir de la lista</b> y en «Pregunta» escribe <i>¿Qué es?</i></li>
          <li>Añade <b>Pedir entrada</b> (texto) con la pregunta <i>¿Algo más? Di «no» si nada.</i></li>
          <li>
            Añade <b>Obtener contenido de URL</b> con la dirección <Cod>{`${base}/api/atajos/incidencia`}</Cod> y, en «Mostrar
            más»:
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
              <li>
                Método: <b>POST</b>
              </li>
              <li>
                Cabecera: <Cod>Authorization</Cod> = <Cod>{`Bearer ${c}`}</Cod>
              </li>
              <li>
                Cuerpo: <b>JSON</b>, con cuatro campos de texto: <Cod>lat</Cod> = «Ubicación actual» → <b>Latitud</b> ·{" "}
                <Cod>lon</Cod> = «Ubicación actual» → <b>Longitud</b> · <Cod>tipo</Cod> = «Elemento elegido» ·{" "}
                <Cod>nota</Cod> = «Entrada proporcionada»
              </li>
            </ul>
          </li>
          <li>
            Añade <b>Mostrar resultado</b> con «Contenido de la URL». Siri lo dice en voz alta: <i>«Fuga de agua apuntada en
            Valladolises, zona Abajo»</i>.
          </li>
          <li>
            Pulsa el nombre del atajo → <b>Añadir a pantalla de inicio</b> para tener el botón.
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="titulo-pixel text-lg">2 · Atajo «¿En qué finca estoy?»</h3>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>Nuevo atajo con el nombre <b>¿En qué finca estoy?</b></li>
          <li>
            <b>Obtener ubicación actual</b> → <b>Obtener contenido de URL</b> con <Cod>{`${base}/api/atajos/donde`}</Cod>,
            método POST, la misma cabecera y en el cuerpo JSON solo <Cod>lat</Cod> y <Cod>lon</Cod>.
          </li>
          <li>
            <b>Mostrar resultado</b> con «Contenido de la URL».
          </li>
        </ol>
      </section>

      <p className="text-xs text-tinta-suave">
        La primera vez, el iPhone pregunta si el atajo puede usar la ubicación y conectarse a Campo: «Permitir siempre».
        Hace falta algo de cobertura. Si la clave se pierde o el móvil cambia de manos, anúlala aquí y crea otra.
      </p>
    </div>
  );
}
