import {
  BLOQUES_VALLADOLISES,
  DETALLES_CASA_VALLADOLISES,
  DETALLES_LOBOSILLO,
  LOBOSILLO_536_67,
  FORMAS,
  MANDARINOS_VALLADOLISES,
  SECTORES_CORVERA,
} from "@/lib/geografia";

/*
 * Dibujos pixel art de las tres fincas, calcados de las vistas aéreas de Google Earth
 * (31/10/2026). Coordenadas en «unidades de dibujo» (ver FORMAS en geografia.ts).
 * Los usan el mapa de inicio (MapaInteractivo) y el plano de cada finca (PlanoFinca).
 * Sin estado ni efectos: sirven en servidor y en cliente.
 */

export type PropsDibujo = {
  /** capacidad del pantano en m³ (texto ya formateado), para su cartel */
  pantano?: string | null;
  /** aviso rojo junto a la piscina (Valladolises) */
  piscina?: boolean;
  /** insignias de sector (Corvera) */
  sectores?: { id: string; numero: number }[];
  /** carteles con nombres */
  detalle: boolean;
};

export function Patrones() {
  return (
    <defs>
      {/* en unidades de dibujo (fincas) */}
      <pattern id="u-limonero" width="28" height="24" patternUnits="userSpaceOnUse">
        <rect width="28" height="24" fill="#b98c5a" />
        <rect x="5" y="4" width="18" height="14" fill="#2f7a34" />
        <rect x="7" y="2" width="14" height="2" fill="#2f7a34" />
        <rect x="7" y="18" width="14" height="2" fill="#2f7a34" />
        <rect x="8" y="5" width="12" height="9" fill="#46a047" />
        <rect x="10" y="7" width="2" height="2" fill="#f6d743" />
        <rect x="16" y="10" width="2" height="2" fill="#f6d743" />
        <rect x="13" y="13" width="2" height="2" fill="#f6d743" />
        <rect x="12" y="20" width="4" height="3" fill="#5e3b1c" />
      </pattern>
      <pattern id="u-mandarino" width="28" height="24" patternUnits="userSpaceOnUse">
        <rect width="28" height="24" fill="#b98c5a" />
        <rect x="5" y="4" width="18" height="14" fill="#37803a" />
        <rect x="7" y="2" width="14" height="2" fill="#37803a" />
        <rect x="7" y="18" width="14" height="2" fill="#37803a" />
        <rect x="8" y="5" width="12" height="9" fill="#4fa54a" />
        <rect x="10" y="7" width="3" height="3" fill="#ef8a22" />
        <rect x="16" y="10" width="3" height="3" fill="#ef8a22" />
        <rect x="12" y="13" width="2" height="2" fill="#ef8a22" />
        <rect x="12" y="20" width="4" height="3" fill="#5e3b1c" />
      </pattern>
      <pattern id="u-arbol" width="28" height="24" patternUnits="userSpaceOnUse">
        <rect width="28" height="24" fill="#b98c5a" />
        <rect x="5" y="4" width="18" height="14" fill="#3d7a3a" />
        <rect x="7" y="2" width="14" height="2" fill="#3d7a3a" />
        <rect x="7" y="18" width="14" height="2" fill="#3d7a3a" />
        <rect x="8" y="5" width="12" height="9" fill="#5a9a50" />
        <rect x="12" y="20" width="4" height="3" fill="#5e3b1c" />
      </pattern>
    </defs>
  );
}


export function Etiqueta({ x, y, texto }: { x: number; y: number; texto: string }) {
  const ancho = Math.max(50, texto.length * 8 + 14);
  return (
    <g>
      <rect x={x - ancho / 2} y={y - 16} width={ancho} height={22} fill="#f6e7c1" stroke="#3b2a1a" strokeWidth={2} />
      <text x={x} y={y} textAnchor="middle" fontSize={13} fontWeight={600} fill="#3b2a1a">
        {texto}
      </text>
    </g>
  );
}

export function DibujoCorvera({ pantano, sectores = [], detalle }: PropsDibujo) {
  // Calcada de la vista aérea: contorno real, filas en diagonal (unos 33° hacia el noreste),
  // caminos interiores y el pantano con su caseta.
  const contorno = FORMAS.corvera.contorno!;
  return (
    <g>
      <defs>
        <pattern id="u-limonero-diag" href="#u-limonero" patternTransform="rotate(-33)" />
        <clipPath id="recorte-corvera">
          <polygon points={contorno} />
        </clipPath>
      </defs>
      <polygon points={contorno} fill="#7a5230" stroke="#7a5230" strokeWidth={8} strokeLinejoin="round" />
      <polygon points={contorno} fill="url(#u-limonero-diag)" />
      {/* caminos interiores */}
      <g clipPath="url(#recorte-corvera)" stroke="#e0bd80" strokeWidth={7} strokeLinecap="square">
        <line x1={20} y1={279} x2={352} y2={65} />
        <line x1={55} y1={322} x2={370} y2={121} />
        <line x1={79} y1={178} x2={113} y2={220} />
        <line x1={235} y1={62} x2={273} y2={108} />
        <line x1={167} y1={230} x2={199} y2={278} />
      </g>
      {/* pantano */}
      <polygon points="214,224 243,207 274,247 244,267" fill="#8b6b3d" stroke="#8b6b3d" strokeWidth={6} strokeLinejoin="round" />
      <polygon points="217,225 242,211 270,247 244,263" fill="#4aa3d9" />
      <line x1={228} y1={226} x2={240} y2={219} stroke="#8fd0f2" strokeWidth={3} />
      <line x1={238} y1={238} x2={248} y2={232} stroke="#8fd0f2" strokeWidth={3} />
      {/* caseta del cabezal, junto al pantano */}
      <g transform="translate(240,196)">
        <rect x={0} y={5} width={15} height={11} fill="#d9c49a" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={-2} y={0} width={19} height={6} fill="#c0563a" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={6} y={10} width={4} height={6} fill="#6b4423" />
      </g>
      {detalle && pantano && <Etiqueta x={262} y={292} texto={`Pantano ~${pantano} m³`} />}
      {sectores.map((s) => {
        const p = SECTORES_CORVERA[s.numero];
        if (!p) return null;
        return (
          <g key={s.id}>
            <rect x={p.x} y={p.y} width={34} height={22} rx={4} fill="#f6e7c1" stroke="#3b2a1a" strokeWidth={2} />
            <text x={p.x + 17} y={p.y + 16} textAnchor="middle" fontSize={14} fontWeight={700} fill="#3b2a1a">
              S{s.numero}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function DibujoValladolises({ pantano, piscina, detalle }: PropsDibujo) {
  // La finca entera, dibujada en Google Earth (3/11/2026): tres bloques de limoneros,
  // los trozos de mandarinos y, en el bloque de la casa, los detalles calcados antes
  // (casa, pista de tenis, piscina, pantano y caseta), puestos a la misma escala.
  return (
    <g>
      <defs>
        <pattern id="u-limonero-vall" href="#u-limonero" patternTransform="rotate(-42) scale(0.7)" />
        <pattern id="u-mandarino-vall" href="#u-mandarino" patternTransform="rotate(-42) scale(0.7)" />
      </defs>
      {BLOQUES_VALLADOLISES.map((b) => (
        <g key={b.nombre}>
          <polygon points={b.puntos} fill="#7a5230" stroke="#7a5230" strokeWidth={6} strokeLinejoin="round" />
          <polygon points={b.puntos} fill="url(#u-limonero-vall)" />
        </g>
      ))}
      {MANDARINOS_VALLADOLISES.map((m) => (
        <polygon key={m} points={m} fill="url(#u-mandarino-vall)" stroke="#5e3b1c" strokeWidth={1.5} strokeLinejoin="round" />
      ))}

      <g transform={DETALLES_CASA_VALLADOLISES.transform}>
        {/* claro de la casa: tierra y jardín */}
        <polygon points="118,88 150,74 220,122 206,152 160,170 136,160 112,124" fill="#d8c08a" />
        <polygon points="136,150 150,140 166,158 152,168" fill="#3f7a4a" />
        <polygon points="152,138 160,132 172,146 164,152" fill="#3f7a4a" />

        {/* pista de tenis con su valla */}
        <polygon points="164,116 177,100 211,127 198,144" fill="#8fbf8a" stroke="#f3f3f3" strokeWidth={2} />
        <polygon points="174,114 182,108 202,125 194,135" fill="#c97b7b" stroke="#ffffff" strokeWidth={1.2} />
        <line x1={192} y1={116.5} x2={184} y2={124.5} stroke="#ffffff" strokeWidth={1.5} />
        <line x1={178} y1={111} x2={198} y2={130} stroke="#ffffff" strokeWidth={0.6} />

        {/* piscina */}
        <polygon points="156,128 164,121 173,130 165,137" fill="#f3f3f3" stroke="#3b2a1a" strokeWidth={1} />
        <polygon points="158,128 164,123 171,130 165,135" fill="#4ac0e8" />

        {/* árboles grandes junto a la casa */}
        <g fill="#2f5a2c" stroke="#1f3d1d" strokeWidth={1}>
          <rect x={106} y={94} width={12} height={12} rx={5} />
          <rect x={110} y={108} width={13} height={13} rx={5} />
          <rect x={120} y={120} width={11} height={11} rx={5} />
        </g>

        {/* casa */}
        <g transform="translate(130,96)">
          <rect x={0} y={8} width={24} height={16} fill="#f3e6c8" stroke="#3b2a1a" strokeWidth={1.5} />
          <polygon points="-3,9 12,0 27,9" fill="#c0563a" stroke="#3b2a1a" strokeWidth={1.5} />
          <rect x={10} y={15} width={5} height={9} fill="#6b4423" />
          <rect x={3} y={12} width={4} height={4} fill="#8fd0f2" />
          <rect x={17} y={12} width={4} height={4} fill="#8fd0f2" />
        </g>

        {/* pantano */}
        <polygon points="56,272 101,243 180,321 130,366" fill="#8b6b3d" stroke="#8b6b3d" strokeWidth={6} strokeLinejoin="round" />
        <polygon points="59,273 101,247 176,321 130,362" fill="#4aa3d9" />
        <line x1={80} y1={272} x2={98} y2={261} stroke="#8fd0f2" strokeWidth={3} />
        <line x1={104} y1={296} x2={120} y2={286} stroke="#8fd0f2" strokeWidth={3} />

        {/* caseta, junto al pantano */}
        <g transform="translate(52,249)">
          <rect x={0} y={4} width={14} height={10} fill="#e9e9e2" stroke="#3b2a1a" strokeWidth={1.5} />
          <rect x={-2} y={0} width={18} height={5} fill="#cfcfc6" stroke="#3b2a1a" strokeWidth={1.5} />
          <rect x={5} y={8} width={4} height={6} fill="#6b4423" />
        </g>
      </g>

      {piscina && (
        <g>
          <circle cx={59} cy={84} r={5} fill="#c8473a" stroke="#ffffff" strokeWidth={1.2} />
          <text x={59} y={87} textAnchor="middle" fontSize={8} fontWeight={700} fill="#ffffff">
            !
          </text>
        </g>
      )}

      {detalle && pantano && (
        <Etiqueta x={DETALLES_CASA_VALLADOLISES.pantano.x + 40} y={DETALLES_CASA_VALLADOLISES.pantano.y + 46} texto={`Pantano ~${pantano} m³`} />
      )}
    </g>
  );
}

export function DibujoLobosillo({ detalle, completa = false }: PropsDibujo & { completa?: boolean }) {
  // Límites del Catastro (parcelas 535/63 y 535/64) y, dentro, lo que se ve en la
  // ortofoto: filas de árboles, balsa con su caseta, explanada con la casa y pista de fútbol.
  // «completa» (solo en la ficha): también la parcela 536/67, unos 400 m al nordeste.
  const contorno = FORMAS.lobosillo.contorno!;
  const d = DETALLES_LOBOSILLO;
  return (
    <g>
      <defs>
        <pattern id="u-arbol-lobosillo" href="#u-arbol" patternTransform="rotate(68)" />
        <pattern id="u-arbol-lobosillo-2" href="#u-arbol" patternTransform="rotate(64)" />
        <clipPath id="u-recorte-lobosillo">
          <polygon points={contorno} />
        </clipPath>
      </defs>
      {completa && (
        <>
          <polygon points={LOBOSILLO_536_67} fill="#7a5230" stroke="#7a5230" strokeWidth={8} strokeLinejoin="round" />
          <polygon points={LOBOSILLO_536_67} fill="url(#u-arbol-lobosillo-2)" />
        </>
      )}
      <polygon points={contorno} fill="#7a5230" stroke="#7a5230" strokeWidth={8} strokeLinejoin="round" />
      <polygon points={contorno} fill="url(#u-arbol-lobosillo)" />

      <g clipPath="url(#u-recorte-lobosillo)">
        {/* explanada de abajo: tierra y hormigón */}
        <polygon points={d.explanada} fill="#d8c08a" />

        {/* balsa con su talud */}
        <polygon points={d.balsaTalud} fill="#e9dcc0" stroke="#b9a57a" strokeWidth={2} />
        <polygon points={d.balsaAgua} fill="#3f5566" />

        {/* pista de fútbol */}
        <polygon points={d.pista} fill="#2f6b43" stroke="#ffffff" strokeWidth={1.5} />
        <line x1={246} y1={263} x2={255} y2={304.5} stroke="#ffffff" strokeWidth={1.2} />
        <circle cx={250.5} cy={284} r={6} fill="none" stroke="#ffffff" strokeWidth={1.2} />
      </g>

      {/* caseta junto a la balsa */}
      <g transform={`translate(${d.caseta.x - 6},${d.caseta.y - 7})`}>
        <rect x={0} y={4} width={12} height={10} fill="#e9e9e2" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={-2} y={0} width={16} height={5} fill="#9a9a92" stroke="#3b2a1a" strokeWidth={1.5} />
      </g>

      {/* casa */}
      <g transform={`translate(${d.casa.x - 10},${d.casa.y - 12})`}>
        <rect x={0} y={7} width={20} height={14} fill="#f3e6c8" stroke="#3b2a1a" strokeWidth={1.5} />
        <polygon points="-3,8 10,0 23,8" fill="#9a9a92" stroke="#3b2a1a" strokeWidth={1.5} />
        <rect x={8} y={13} width={5} height={8} fill="#6b4423" />
      </g>

      {detalle && (
        <>
          <Etiqueta x={250} y={336} texto="Pista de fútbol" />
          <Etiqueta x={226} y={190} texto="Balsa" />
          {completa && <Etiqueta x={540} y={-330} texto="Parcela 536/67 · 2,02 ha" />}
          {completa && <Etiqueta x={70} y={345} texto="Casa · 1,66 ha" />}
        </>
      )}
    </g>
  );
}
