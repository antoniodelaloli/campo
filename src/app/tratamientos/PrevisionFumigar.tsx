import { Panel } from "@/components/ui";
import { previsionFincas, RACHA_MAX_KMH, VIENTO_MAX_KMH } from "@/lib/alertas-tiempo";
import { diasEntre } from "@/lib/texto";

const DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function etiquetaDia(fecha: string, hoy: string) {
  const d = diasEntre(hoy, fecha);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañ.";
  return `${DIA[new Date(`${fecha}T12:00:00Z`).getUTCDay()]} ${Number(fecha.slice(8, 10))}`;
}

/** Tabla de los próximos días: si hace poco viento por la mañana para fumigar, por finca. */
export async function PrevisionFumigar({ hoy }: { hoy: string }) {
  const { viento, alertas } = await previsionFincas();
  const dias = [...new Set(viento.map((v) => v.fecha))].filter((f) => f >= hoy).sort();
  const fincas = [...new Set(viento.map((v) => v.finca))];

  if (dias.length === 0) {
    return (
      <Panel titulo="¿Se puede fumigar?">
        <p className="text-sm text-tinta-suave">No se ha podido cargar la previsión del viento. Prueba más tarde.</p>
      </Panel>
    );
  }

  return (
    <Panel titulo="¿Se puede fumigar?" extra="viento de 7 a 13 h">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left font-normal text-tinta-suave" />
              {dias.map((f) => (
                <th key={f} className="p-1 font-bold whitespace-nowrap">
                  {etiquetaDia(f, hoy)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fincas.map((finca) => (
              <tr key={finca}>
                <th className="p-1 pr-2 text-left font-bold whitespace-nowrap">{finca}</th>
                {dias.map((fecha) => {
                  const v = viento.find((x) => x.finca === finca && x.fecha === fecha);
                  const granizo = alertas.some((a) => a.fecha === fecha && a.fincas.includes(finca));
                  if (!v) return <td key={fecha} className="p-1 text-tinta-suave">–</td>;
                  const bien = v.apto && !granizo;
                  return (
                    <td
                      key={fecha}
                      title={`Viento hasta ${v.kmh} km/h, rachas de ${v.rachas} km/h${granizo ? " · tormenta prevista" : ""}`}
                      className={`border-2 border-papel p-1 leading-tight ${
                        bien ? "bg-[#eaf5dc] text-[#2f5a12]" : "bg-[#fbe1dc] text-[#7d1a10]"
                      }`}
                    >
                      <div className="text-sm font-bold">{granizo ? "⛈" : bien ? "✓" : "💨"}</div>
                      <div>{v.kmh}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-tinta-suave">
        Número = viento máximo en km/h. ✓ por debajo de {VIENTO_MAX_KMH} km/h y rachas de menos de {RACHA_MAX_KMH}.
        💨 mucho viento: el caldo se lo lleva el aire. ⛈ tormenta prevista. Es una previsión: mirad el cielo antes de cargar
        la cuba.
      </p>
    </Panel>
  );
}
