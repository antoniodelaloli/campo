import type { ReactNode } from "react";

function Cod({ children }: { children: ReactNode }) {
  return <code className="break-all bg-[#f6e7c1] px-1 font-bold">{children}</code>;
}

/**
 * Pasos para montar el atajo «Cuaderno» en la app Atajos del iPhone.
 * Es el único atajo: los antiguos «Incidencia» y «¿En qué finca estoy?»
 * se pueden borrar del iPhone (sus direcciones siguen funcionando por si acaso).
 */
export function PasosAtajos({ base, clave }: { base: string; clave: string | null }) {
  const c = clave ?? "TU_CLAVE";
  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed">
      <section className="flex flex-col gap-1.5">
        <h3 className="titulo-pixel text-lg">Atajo «Cuaderno»</h3>
        <p>
          Se dice <i>«Oye Siri, cuaderno»</i> y se habla todo lo que haga falta, aunque se mezclen cosas. Campo lo reparte
          solo: tareas, fechas clave, diario, ideas e incidencias. Si está en una finca, «aquí» es esa finca y las
          incidencias quedan con su sitio exacto en el plano. Lo personal y lo de la confitería no se quedan en Campo.
        </p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Abre la app <b>Atajos</b> y <b>borra</b> los atajos antiguos «Incidencia» y «¿En qué finca estoy?» (mantén el
            dedo encima → Eliminar). Así Siri solo tiene uno.
          </li>
          <li>
            Pulsa <b>+</b> y ponle de nombre <b>Cuaderno</b>. No uses «Apunta» ni «Anota»: Siri ya los usa para Notas y
            Recordatorios.
          </li>
          <li>
            Añade <b>Dictar texto</b>: idioma <b>Español (España)</b> y «Dejar de escuchar» <b>Tras una pausa</b>.
          </li>
          <li>Añade <b>Obtener ubicación actual</b>.</li>
          <li>
            Añade <b>Obtener contenido de URL</b> con la dirección <Cod>{`${base}/api/atajos/apuntar`}</Cod> y, en «Mostrar
            más»:
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
              <li>
                Método: <b>POST</b>
              </li>
              <li>
                Cabecera: <Cod>Authorization</Cod> = <Cod>{`Bearer ${c}`}</Cod>
              </li>
              <li>
                Cuerpo: <b>JSON</b>, con tres campos de texto: <Cod>texto</Cod> = «Texto dictado» · <Cod>lat</Cod> =
                «Ubicación actual» → <b>Latitud</b> · <Cod>lon</Cod> = «Ubicación actual» → <b>Longitud</b>
              </li>
            </ul>
          </li>
          <li>
            Añade <b>Mostrar resultado</b> con «Contenido de la URL». Siri contesta, por ejemplo: <i>«Apuntado en Campo: una
            incidencia en Corvera con su sitio exacto y una tarea para el 12/11»</i>.
          </li>
          <li>
            Pulsa el nombre del atajo → <b>Añadir a pantalla de inicio</b> para tener también el botón.
          </li>
        </ol>
      </section>

      <p className="text-xs text-tinta-suave">
        La primera vez, el iPhone pregunta si el atajo puede usar la ubicación y conectarse a Campo: «Permitir siempre».
        Hace falta algo de cobertura. Lo que no queda claro (de qué finca, para cuándo) no se inventa: va a la libreta de
        ideas con el tema «revisar». Lo dicho se guarda siempre tal cual y eso solo lo ve quien lo dictó. Si la clave se
        pierde o el móvil cambia de manos, anúlala aquí y crea otra.
      </p>
    </div>
  );
}
