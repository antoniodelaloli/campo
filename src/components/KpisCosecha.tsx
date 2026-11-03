import type { ReactNode } from "react";
import { Panel } from "@/components/ui";
import type { Finca } from "@/lib/datos";
import { CONTRATO_MANDARINAS_2024, type FilaCosecha } from "@/lib/cosecha-documentos";
import { formatoNumero } from "@/lib/texto";

/*
 * Indicadores de la campaña: se calculan con la liquidación y con lo que sabe la base
 * de datos (árboles y hectáreas de cada finca). Si falta un dato, se dice qué falta;
 * nunca se rellena con un número inventado.
 */

// ------------------------------------------------------------------
// Iconos 2D (pixel art, 16×16)
// ------------------------------------------------------------------
function Icono({ children, etiqueta }: { children: ReactNode; etiqueta?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className="shrink-0"
      aria-hidden={etiqueta ? undefined : true}
      role={etiqueta ? "img" : undefined}
      aria-label={etiqueta}
    >
      {children}
    </svg>
  );
}

const ICONOS = {
  arbol: (
    <>
      <rect x="4" y="2" width="8" height="8" fill="#2f7a34" />
      <rect x="3" y="4" width="10" height="4" fill="#2f7a34" />
      <rect x="5" y="3" width="6" height="5" fill="#46a047" />
      <rect x="5" y="4" width="2" height="2" fill="#f6d743" />
      <rect x="9" y="6" width="2" height="2" fill="#f6d743" />
      <rect x="7" y="10" width="2" height="4" fill="#6b4423" />
      <rect x="4" y="14" width="8" height="1" fill="#8a5a2b" />
    </>
  ),
  limon: (
    <>
      <rect x="4" y="4" width="8" height="8" fill="#f6d743" />
      <rect x="2" y="6" width="12" height="4" fill="#f6d743" />
      <rect x="1" y="7" width="1" height="2" fill="#e0b92a" />
      <rect x="14" y="7" width="1" height="2" fill="#e0b92a" />
      <rect x="5" y="5" width="2" height="2" fill="#fff4a8" />
      <rect x="7" y="2" width="2" height="2" fill="#46a047" />
      <rect x="9" y="1" width="3" height="2" fill="#46a047" />
    </>
  ),
  moneda: (
    <>
      <rect x="4" y="2" width="8" height="12" fill="#e0b92a" />
      <rect x="2" y="4" width="12" height="8" fill="#e0b92a" />
      <rect x="5" y="3" width="6" height="10" fill="#f6d743" />
      <rect x="3" y="5" width="10" height="6" fill="#f6d743" />
      <rect x="7" y="4" width="2" height="8" fill="#b07a1a" />
      <rect x="6" y="5" width="4" height="1" fill="#b07a1a" />
      <rect x="6" y="10" width="4" height="1" fill="#b07a1a" />
    </>
  ),
  bascula: (
    <>
      <rect x="2" y="12" width="12" height="3" fill="#6b6b6b" />
      <rect x="7" y="6" width="2" height="6" fill="#8a8a8a" />
      <rect x="2" y="4" width="12" height="2" fill="#8a8a8a" />
      <rect x="2" y="6" width="1" height="2" fill="#8a8a8a" />
      <rect x="13" y="6" width="1" height="2" fill="#8a8a8a" />
      <rect x="1" y="2" width="4" height="2" fill="#f6d743" />
      <rect x="11" y="2" width="4" height="2" fill="#f6d743" />
    </>
  ),
  parcela: (
    <>
      <rect x="1" y="3" width="14" height="10" fill="#7a5230" />
      <rect x="2" y="4" width="12" height="8" fill="#86bd5b" />
      <rect x="3" y="5" width="2" height="2" fill="#2f7a34" />
      <rect x="7" y="5" width="2" height="2" fill="#2f7a34" />
      <rect x="11" y="5" width="2" height="2" fill="#2f7a34" />
      <rect x="3" y="9" width="2" height="2" fill="#2f7a34" />
      <rect x="7" y="9" width="2" height="2" fill="#2f7a34" />
      <rect x="11" y="9" width="2" height="2" fill="#2f7a34" />
    </>
  ),
  estrella: (
    <>
      <rect x="7" y="1" width="2" height="4" fill="#f6d743" />
      <rect x="1" y="5" width="14" height="2" fill="#f6d743" />
      <rect x="3" y="7" width="10" height="2" fill="#f6d743" />
      <rect x="4" y="9" width="8" height="2" fill="#f6d743" />
      <rect x="3" y="11" width="3" height="3" fill="#f6d743" />
      <rect x="10" y="11" width="3" height="3" fill="#f6d743" />
      <rect x="6" y="5" width="4" height="4" fill="#e0b92a" />
    </>
  ),
  gota: (
    <>
      <rect x="7" y="1" width="2" height="2" fill="#2f7fb0" />
      <rect x="6" y="3" width="4" height="2" fill="#2f7fb0" />
      <rect x="5" y="5" width="6" height="2" fill="#2f7fb0" />
      <rect x="4" y="7" width="8" height="5" fill="#2f7fb0" />
      <rect x="5" y="12" width="6" height="2" fill="#2f7fb0" />
      <rect x="5" y="8" width="2" height="2" fill="#8fd0f2" />
    </>
  ),
  saco: (
    <>
      <rect x="3" y="4" width="10" height="10" fill="#d9c49a" />
      <rect x="5" y="2" width="6" height="2" fill="#b9a57a" />
      <rect x="4" y="7" width="8" height="3" fill="#5f9e3c" />
      <rect x="3" y="14" width="10" height="1" fill="#8a6b3d" />
    </>
  ),
  rayo: (
    <>
      <rect x="8" y="1" width="3" height="2" fill="#f6d743" />
      <rect x="7" y="3" width="3" height="2" fill="#f6d743" />
      <rect x="6" y="5" width="6" height="2" fill="#f6d743" />
      <rect x="8" y="7" width="3" height="2" fill="#f6d743" />
      <rect x="7" y="9" width="3" height="2" fill="#f6d743" />
      <rect x="6" y="11" width="3" height="2" fill="#f6d743" />
      <rect x="5" y="13" width="2" height="2" fill="#f6d743" />
    </>
  ),
  pulverizador: (
    <>
      <rect x="2" y="6" width="9" height="6" fill="#d9d9d9" />
      <rect x="3" y="7" width="5" height="2" fill="#2f7fb0" />
      <rect x="11" y="7" width="3" height="4" fill="#c0563a" />
      <rect x="3" y="12" width="3" height="3" fill="#3b2a1a" />
      <rect x="8" y="12" width="3" height="3" fill="#3b2a1a" />
      <rect x="13" y="3" width="1" height="4" fill="#3b2a1a" />
      <rect x="12" y="1" width="3" height="2" fill="#f6d743" />
    </>
  ),
  manos: (
    <>
      <rect x="2" y="7" width="5" height="6" fill="#e0b48a" />
      <rect x="9" y="7" width="5" height="6" fill="#e0b48a" />
      <rect x="2" y="4" width="1" height="3" fill="#e0b48a" />
      <rect x="4" y="3" width="1" height="4" fill="#e0b48a" />
      <rect x="11" y="3" width="1" height="4" fill="#e0b48a" />
      <rect x="13" y="4" width="1" height="3" fill="#e0b48a" />
      <rect x="2" y="13" width="5" height="2" fill="#2f7fb0" />
      <rect x="9" y="13" width="5" height="2" fill="#2f7fb0" />
    </>
  ),
};

// ------------------------------------------------------------------
// Piezas
// ------------------------------------------------------------------
type ValorFinca = { finca: string; valor: string | null; falta?: string };

function Kpi({
  icono,
  titulo,
  explica,
  valores,
}: {
  icono: keyof typeof ICONOS;
  titulo: string;
  explica: string;
  valores: ValorFinca[];
}) {
  return (
    <div className="panel flex flex-col gap-2 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Icono>{ICONOS[icono]}</Icono>
        <h3 className="titulo-pixel text-[19px] leading-tight">{titulo}</h3>
      </div>
      <div className="flex flex-col gap-1.5">
        {valores.map((v) => (
          <div key={v.finca} className="flex items-baseline justify-between gap-3 border-b-2 border-dotted border-borde-papel pb-1">
            <span className="text-sm font-bold text-tinta-suave">{v.finca}</span>
            {v.valor ? (
              <span className="titulo-pixel text-[24px] leading-none">{v.valor}</span>
            ) : (
              <span className="text-right text-[13px] font-semibold text-tinta-suave italic">{v.falta ?? "falta el dato"}</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-[13px] leading-snug text-tinta-suave">{explica}</p>
    </div>
  );
}


// ------------------------------------------------------------------
// Sección completa
// ------------------------------------------------------------------
export function KpisCosecha({
  fincas,
  campana,
  filas,
  estimada = false,
}: {
  fincas: Finca[];
  campana: string;
  filas: FilaCosecha[];
  /** true = estimación: los valores llevan «≈» y los textos hablan en futuro */
  estimada?: boolean;
}) {
  const aprox = estimada ? "≈ " : "";
  const kgFmt = (n: number) => `${aprox}${formatoNumero(Math.round(n))} kg`;
  const eurFmt = (n: number, d = 0) => `${aprox}${formatoNumero(n, d)} €`;
  const datos = filas.map((f) => {
    const finca = fincas.find((x) => x.nombre === f.finca);
    const arboles = finca?.n_arboles_aprox ?? null;
    const ha = finca?.superficie_ha ?? null;
    return {
      finca: f.finca,
      arboles,
      arbolesAntiguos: Boolean(finca?.arboles_nota),
      ha,
      haDudosa: finca?.superficie_fiabilidad !== "medido",
      kg: f.kgTotal,
      euros: f.importeEur,
      precio: f.importeEur / f.kgLiquidables,
      calidad: f.kgComercial / (f.kgComercial + f.kgCitrica + f.kgRodrejos),
    };
  });

  const notaArboles = datos.some((d) => d.arbolesAntiguos)
    ? " * Con un número de árboles antiguo (de cuando se compró la finca): puede haber cambiado."
    : "";
  const corvera = datos.find((d) => d.finca === "Corvera");
  const eurosArbolCorvera = corvera?.arboles ? corvera.euros / corvera.arboles : null;
  const kgArbolCorvera = corvera?.arboles ? corvera.kg / corvera.arboles : null;

  // Variedades: barras de kg por árbol (solo lo que se puede calcular)
  const variedades = [
    { nombre: "Limón Fino 95 y Fino 49 · Corvera", valor: kgArbolCorvera, falta: null as string | null },
    { nombre: "Limón Fino 49 · Valladolises", valor: null, falta: "faltan los kilos y los árboles de cada variedad" },
    { nombre: "Mandarina Clemenvilla / Nova · Valladolises", valor: null, falta: "faltan los kilos y los árboles" },
  ];
  const maxVar = Math.max(...variedades.map((v) => v.valor ?? 0), 1);

  // Un árbol en euros: ingresos frente a costes
  const costes: { nombre: string; icono: keyof typeof ICONOS; falta: string }[] = [
    { nombre: "Agua", icono: "gota", falta: "falta saber los m³ del año (Pozo Villalba, ~0,85 €/m³)" },
    { nombre: "Luz del bombeo", icono: "rayo", falta: "solo hay una factura (agosto: 1.654 €)" },
    { nombre: "Abonos", icono: "saco", falta: "sin facturas apuntadas" },
    { nombre: "Tratamientos", icono: "pulverizador", falta: "sin facturas apuntadas" },
    { nombre: "Mano de obra", icono: "manos", falta: "sin datos" },
  ];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-kpis">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-kpis" className="titulo-pixel text-[26px]">
          {estimada ? `Cómo puede ir la campaña ${campana}` : `Cómo ha ido la campaña ${campana}`}
        </h2>
        <span className="text-[13px] font-bold text-tinta-suave">
          {estimada ? "Estimación con los supuestos de arriba" : "Con la liquidación y los datos de cada finca"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          icono="arbol"
          titulo="Kilos por árbol"
          explica={`${estimada ? "Lo que daría cada árbol si rinde como el año pasado." : "Cuánto limón ha dado cada árbol de media. Si sube de un año a otro, los árboles vienen más cargados."}${notaArboles}`}
          valores={datos.map((d) => ({
            finca: d.finca,
            valor: d.arboles ? `${kgFmt(d.kg / d.arboles)}${d.arbolesAntiguos ? " *" : ""}` : null,
            falta: "falta el nº de árboles",
          }))}
        />
        <Kpi
          icono="moneda"
          titulo="Precio medio de venta"
          explica={
            estimada
              ? "Lo que se cobraría por kilo liquidado, ya descontados el destrío global y la comisión del contrato 2026/27."
              : `Lo que se ha cobrado de media por kilo liquidado (en 25/26, el mismo precio en las dos fincas). Mandarina (contrato 2024): ${formatoNumero(CONTRATO_MANDARINAS_2024.precioEurKg, 2)} €/kg.`
          }
          valores={datos.map((d) => ({ finca: d.finca, valor: `${aprox}${formatoNumero(d.precio, 3)} €/kg` }))}
        />
        <Kpi
          icono="estrella"
          titulo="Fruta de primera"
          explica="Parte de la cosecha que fue limón comercial (el resto, cítrica y rodrejos, se paga menos o nada)."
          valores={datos.map((d) => ({ finca: d.finca, valor: `${aprox}${formatoNumero(d.calidad * 100, 1)} %` }))}
        />
        <Kpi
          icono="parcela"
          titulo="Kilos por hectárea"
          explica="Rendimiento de la tierra. La superficie es aproximada (~22 ha cada una) hasta medirla bien."
          valores={datos.map((d) => ({ finca: d.finca, valor: d.ha ? kgFmt(d.kg / d.ha) : null, falta: "falta la superficie" }))}
        />
        <Kpi
          icono="bascula"
          titulo="Euros por hectárea"
          explica={estimada ? "Lo que daría cada hectárea, antes de gastos." : "Lo que ha dado cada hectárea según la liquidación, antes de gastos."}
          valores={datos.map((d) => ({ finca: d.finca, valor: d.ha ? eurFmt(d.euros / d.ha) : null, falta: "falta la superficie" }))}
        />
        <Kpi
          icono="limon"
          titulo="Euros por árbol"
          explica={`${estimada ? "Lo que daría cada árbol de media, antes de gastos." : "Lo que ha dado cada árbol de media, antes de gastos."}${notaArboles}`}
          valores={datos.map((d) => ({
            finca: d.finca,
            valor: d.arboles ? `${eurFmt(d.euros / d.arboles, 2)}${d.arbolesAntiguos ? " *" : ""}` : null,
            falta: "falta el nº de árboles",
          }))}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* Comparar variedades */}
        <Panel titulo="Por variedad" extra="kilos por árbol">
          <ul className="flex flex-col gap-3">
            {variedades.map((v) => (
              <li key={v.nombre} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <b>{v.nombre}</b>
                  {v.valor && <span className="titulo-pixel text-lg">{kgFmt(v.valor)}</span>}
                </div>
                {v.valor ? (
                  <div
                    className="h-7 rounded-[3px] border-[3px] border-tinta bg-[#f6d743]"
                    style={{ width: `${(v.valor / maxVar) * 100}%` }}
                    role="img"
                    aria-label={`${v.nombre}: ${kgFmt(v.valor)} por árbol`}
                  />
                ) : (
                  <div className="flex h-7 items-center rounded-[3px] border-[3px] border-dashed border-borde-papel px-2 text-xs text-tinta-suave italic">
                    {v.falta}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-snug text-tinta-suave">
            Corvera es toda Fino 49, así que ahí la cuenta sale sola. En Valladolises conviven limón y mandarina: para
            comparar hay que apuntar los kilos de cada corte por variedad y cuántos árboles hay de cada una.
          </p>
        </Panel>

        {/* Un árbol en euros */}
        <Panel titulo="Un árbol de Corvera, en euros" extra={estimada ? "estimación" : "media de la campaña"}>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Icono>{ICONOS.moneda}</Icono>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <b>{estimada ? "Lo que daría (venta)" : "Lo que da (venta)"}</b>
                  <span className="titulo-pixel text-lg">{eurosArbolCorvera ? eurFmt(eurosArbolCorvera, 2) : "—"}</span>
                </div>
                <div
                  className="h-6 w-full rounded-[3px] border-[3px] border-hoja-oscura bg-hoja"
                  role="img"
                  aria-label={`Ingresos por árbol: ${eurosArbolCorvera ? eurFmt(eurosArbolCorvera, 2) : "sin datos"}`}
                />
              </div>
            </div>
            {costes.map((c) => (
              <div key={c.nombre} className="flex items-center gap-2">
                <Icono>{ICONOS[c.icono]}</Icono>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <b>{c.nombre}</b>
                    <span className="text-right text-xs text-tinta-suave italic">{c.falta}</span>
                  </div>
                  <div className="h-4 w-1/3 rounded-[3px] border-[3px] border-dashed border-[#c8473a]/50" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between rounded-[3px] border-2 border-borde-papel bg-papel px-3 py-2 text-sm">
            <b>Lo que queda por árbol</b>
            <span className="font-semibold text-tinta-suave italic">cuando se apunten los gastos</span>
          </div>
          <p className="text-[13px] leading-snug text-tinta-suave">
            En verde lo que se cobra; en rojo, cada gasto repartido entre los ~6.000 árboles. Las barras de gastos se
            rellenarán solas al ir apuntando lecturas de contador y facturas.
          </p>
        </Panel>
      </div>
    </section>
  );
}
