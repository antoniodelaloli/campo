// Albaranes de báscula: las hojas de Excel de cada corte que lleva la familia
// (una fila por camión). Este archivo es puro (sin base de datos): lee el texto
// copiado del Excel y lo convierte en filas, y hace los resúmenes.
//
// Formato de las hojas (ejemplos de 5/11/2026):
//   «LIMON - CORVERA 2024-2025 · 1º CORTE … Todos a Nombre de Mª Teresa …»
//   «3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026»
//   «VALLADOLISES.--MªTERESA · MªTERESA 2026»
//   Columnas: Albarán | FECHA | CAJA (buenas) | CAJA (cítrica) | CAJA (rodrejo) |
//   BRUTO | TARA (camión) | TARA (cajas, 2,5 kg/caja) | NETO | MED (kg/caja) |
//   KILOS (buenos) | [KILOS (cítrica)] | importe o «K BUENOS X 0,36» | …
//   Los albaranes sin pesada (sin bruto ni tara) traen los kilos tecleados.

export type FilaAlbaran = {
  albaran: string;
  fecha: string; // AAAA-MM-DD
  cajas: number | null;
  bruto_kg: number | null;
  tara_camion_kg: number | null;
  tara_cajas_kg: number | null;
  kg_buenos: number;
  kg_citrica: number;
  importe_eur: number | null;
  notas: string | null;
};

export type HojaLeida = {
  titulo: string;
  /** lo que se ha deducido del título (se puede cambiar antes de guardar) */
  sugerido: {
    campana: string | null;
    finca: string | null;
    titular: string | null; // "Maite" | "Carlos" | "JHSYO"
    corte: number | null;
  };
  filas: FilaAlbaran[];
  avisos: string[];
  /** total de kilos buenos que pone la propia hoja (para comprobar) */
  totalHoja: number | null;
};

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** «12.054» → 12054 · «4224,60» → 4224.6 · «1.485,00» → 1485 · «» / «#DIV/0!» → null */
export function numeroES(v: string | undefined): number | null {
  let s = (v ?? "").trim().replace(/\s|€/g, "");
  if (!s || /[^\d.,-]/.test(s)) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Campaña «2025/26» que empieza en mayo de 2025. */
export const nombreCampana = (ini: number) => `${ini}/${String((ini + 1) % 100).padStart(2, "0")}`;

/** Año en que cae un «día-mes» dentro de una campaña (mayo a abril). */
function fechaEnCampana(dia: number, mes: number, campana: string, anioHoja?: number | null): string {
  const ini = Number(campana.slice(0, 4));
  const anio = anioHoja ?? (mes >= 5 ? ini : ini + 1);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/** «24-12», «24/12», «24-12-2024», «24/12/24», «24-dic» → día, mes y (si viene) año. */
export function leerFecha(v: string | undefined): { dia: number; mes: number; anio: number | null } | null {
  const m = sinTildes(v ?? "").match(/^(\d{1,2})[-/.\s]([a-z]{3})?[a-z.]*?(\d{1,2})?(?:[-/.\s](\d{2,4}))?$/);
  if (!m) return null;
  const mes = m[2] ? MESES[m[2]] : m[3] ? Number(m[3]) : NaN;
  if (!mes || mes > 12) return null;
  const a = m[4] ? Number(m[4]) : null;
  return { dia: Number(m[1]), mes, anio: a == null ? null : a < 100 ? 2000 + a : a };
}

function deducirDelTitulo(titulo: string, fechas: { dia: number; mes: number; anio: number | null }[]) {
  const t = sinTildes(titulo);
  const corteM = t.match(/(\d)\s*(?:º|o|er|ª|a)?\.?\s*corte/);
  const corte = corteM ? Number(corteM[1]) : null;
  // campaña: «2024-2025» / «2024/25»; si no, un año suelto («2026»); si no, el año de
  // las fechas (poco fiable: al teclear «28-12» Excel le pone el año en que se teclea)
  let campana: string | null = null;
  const par = t.match(/(20\d{2})\s*[-/]\s*(20)?(\d{2})\b/);
  const conAnio = fechas.find((f) => f.anio);
  const anioSuelto = t.match(/\b(20\d{2})\b/);
  if (par) campana = nombreCampana(Number(par[1]));
  else if (!anioSuelto && conAnio?.anio) campana = nombreCampana(conAnio.mes >= 5 ? conAnio.anio : conAnio.anio - 1);
  else {
    const anio = t.match(/\b(20\d{2})\b/);
    if (anio) {
      const y = Number(anio[1]);
      // un año suelto: el 1º corte va en el primer año de la campaña (2024 → 2024/25)
      // y los demás cortes en el segundo (2026 → 2025/26). Sin corte, por los meses.
      if (corte === 1) campana = nombreCampana(y);
      else if (corte != null) campana = nombreCampana(y - 1);
      else {
        const meses = fechas.map((f) => f.mes);
        const masComun = meses.sort((a, b) => meses.filter((m) => m === b).length - meses.filter((m) => m === a).length)[0];
        campana = nombreCampana(masComun != null && masComun >= 5 ? y : y - 1);
      }
    }
  }
  const finca = /valladolises/.test(t) ? "Valladolises" : /corvera/.test(t) ? "Corvera" : /lobosillo/.test(t) ? "Lobosillo" : null;
  // titular: «a nombre de …» manda; después la sociedad; después Maite
  let titular: string | null = null;
  const aNombre = t.match(/a nombre de ([^|]+)/);
  const quien = aNombre ? aNombre[1] : t;
  if (/saez y otros|jhsyo|\bs\.?\s?c\.?(\s|$)/.test(quien)) titular = "JHSYO";
  else if (/teresa|maite/.test(quien)) titular = "Maite";
  else if (/juan carlos/.test(quien)) titular = "Carlos";
  return { campana, finca, titular, corte };
}

/**
 * Lee una hoja copiada del Excel (celdas separadas por tabuladores).
 * `campana` fuerza la campaña (si no, se deduce del título).
 */
export function leerHoja(texto: string, campana?: string | null): HojaLeida {
  const lineas = texto.replace(/\r/g, "").split("\n");
  const celdas = lineas.map((l) => l.split("\t"));
  const avisos: string[] = [];

  const iCab = celdas.findIndex((c) => sinTildes(c[0] ?? "").startsWith("albar"));
  if (iCab < 0) {
    return {
      titulo: "",
      sugerido: { campana: campana ?? null, finca: null, titular: null, corte: null },
      filas: [],
      avisos: ["No encuentro la fila de títulos («Albarán, FECHA, CAJA…»). Copia la hoja entera, con los títulos."],
      totalHoja: null,
    };
  }
  const cab = celdas[iCab].map(sinTildes);
  const sub = (celdas[iCab + 1] ?? []).map(sinTildes);
  const todas = (nombre: string) => cab.flatMap((c, i) => (c === nombre ? [i] : []));
  const kilos = todas("kilos");
  const taras = todas("tara");
  const col = {
    cajas: cab.indexOf("caja"),
    bruto: cab.indexOf("bruto"),
    taraCamion: taras[0] ?? -1,
    taraCajas: taras[1] ?? -1,
    buenos: kilos[0] ?? -1,
    // segunda columna de KILOS = cítrica (en la subcabecera pone «CITRICA»)
    citrica: kilos.length > 1 && (sub[kilos[1]] ?? "").includes("citrica") ? kilos[1] : kilos.length > 1 ? kilos[1] : -1,
    importe: cab.findIndex((c) => c === "importe" || c.startsWith("k buenos")),
  };
  if (col.buenos < 0) avisos.push("No encuentro la columna KILOS.");

  // título: lo que hay por encima de la cabecera y las notas de debajo («Todos a nombre de…»)
  const textoDe = (cs: string[][]) =>
    cs
      .map((c) => c.map((x) => x.trim()).filter(Boolean).join(" "))
      .filter(Boolean)
      .join(" | ");
  const titulo = textoDe(celdas.slice(0, iCab));
  const notasPie = textoDe(celdas.slice(iCab + 1).filter((c) => /[a-z]{4,}/i.test(c.join(" ")) && !/^\d/.test((c[0] ?? "").trim())))
    .replace(/\b(buenas|citrica|cítrica|rodrejo|bascula|báscula|cajas|caj|buenos|neto)\b/gi, "")
    .trim();

  // filas de datos: nº de albarán y fecha («d-m», «d/m/aaaa»…). Las filas con
  // kilos pero sin nº de albarán ni pesada, entre los albaranes, también cuentan
  // («s/n»): son camiones apuntados sin el papel (no las filas de totales, que
  // llevan el NETO sumado).
  const iNeto = cab.indexOf("neto");
  const crudas: { c: string[]; dia: number; mes: number; anio: number | null; sinNumero?: boolean }[] = [];
  const conDatos = celdas.slice(iCab + 1);
  const ultimaConAlbaran = conDatos.reduce((u, c, i) => (/^\d{3,}$/.test((c[0] ?? "").trim()) ? i : u), -1);
  conDatos.forEach((c, i) => {
    const alb = (c[0] ?? "").trim();
    const f = leerFecha(c[1]);
    if (/^\d{3,}$/.test(alb) && f) {
      crudas.push({ c, ...f });
      return;
    }
    const kg = [kilos[0], kilos[1]].some((k) => k != null && (numeroES(c[k]) ?? 0) > 0);
    const sinPesada = !(numeroES(c[iNeto]) ?? 0) && !(numeroES(c[cab.indexOf("bruto")]) ?? 0);
    if (!alb && kg && sinPesada && i < ultimaConAlbaran && crudas.length) {
      const prev = crudas[crudas.length - 1];
      crudas.push({ c: ["s/n", prev.c[1], ...c.slice(2)], dia: prev.dia, mes: prev.mes, anio: prev.anio, sinNumero: true });
    }
  });
  const sugerido = deducirDelTitulo(`${titulo} | ${notasPie}`, crudas);
  const camp = campana || sugerido.campana;
  if (!camp) avisos.push("No sé de qué campaña es: elígela antes de guardar.");

  const ini = camp ? Number(camp.slice(0, 4)) : null;
  // fecha «central» de la hoja: un corte dura días o semanas, no meses
  const enDias = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 86_400_000;
  const tentativas = camp ? crudas.map(({ dia, mes }) => fechaEnCampana(dia, mes, camp)).filter(esFechaValida).sort() : [];
  const mediana = tentativas.length ? enDias(tentativas[Math.floor(tentativas.length / 2)]) : null;
  const filas: FilaAlbaran[] = [];
  let anterior: string | null = null;
  for (const { c, dia, mes, anio, sinNumero } of crudas) {
    const n = (i: number) => (i >= 0 ? numeroES(c[i]) : null);
    const kgB = n(col.buenos) ?? 0;
    const kgC = n(col.citrica) ?? 0;
    if (kgB <= 0 && kgC <= 0) continue;
    let fecha = camp ? fechaEnCampana(dia, mes, camp, anio) : `0000-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    // si el año que trae la celda la saca de la campaña, se usa el de la campaña
    if (camp && anio && ini != null && (fecha < `${ini}-05-01` || fecha > `${ini + 1}-04-30`)) fecha = fechaEnCampana(dia, mes, camp);
    let notas: string | null = sinNumero ? "En la hoja no tiene nº de albarán: se pone la fecha del anterior." : null;
    if (sinNumero) avisos.push(`Hay una fila con ${kgB || kgC} kg sin nº de albarán: se guarda como «s/n».`);
    // fecha fuera de la campaña (p. ej. «27-7» en un corte de febrero): error de tecleo
    const fuera =
      ini != null &&
      (fecha < `${ini}-05-01` ||
        fecha > `${ini + 1}-04-30` ||
        !esFechaValida(fecha) ||
        (mediana != null && Math.abs(enDias(fecha) - mediana) > 60));
    if (fuera) {
      notas = `En la hoja pone «${(c[1] ?? "").trim()}»: fecha corregida a la del albarán anterior.`;
      avisos.push(`Albarán ${c[0].trim()}: la fecha «${(c[1] ?? "").trim()}» no cuadra con el resto de la hoja; se pone la del albarán anterior.`);
      fecha = anterior ?? fecha;
    }
    const conPesada = (n(col.bruto) ?? 0) > 0;
    const cajas = n(col.cajas);
    const importe = n(col.importe);
    filas.push({
      albaran: c[0].trim(),
      fecha,
      cajas: cajas && cajas > 0 ? cajas : null,
      bruto_kg: conPesada ? n(col.bruto) : null,
      tara_camion_kg: conPesada ? n(col.taraCamion) : null,
      tara_cajas_kg: conPesada ? n(col.taraCajas) : null,
      kg_buenos: kgB,
      kg_citrica: kgC,
      importe_eur: importe && importe > 0 ? importe : null,
      notas,
    });
    anterior = fecha;
  }

  // el total que pone la hoja: el mayor número de la columna KILOS fuera de las filas de datos
  let totalHoja: number | null = null;
  for (const c of celdas.slice(iCab + 1)) {
    if (/^\d{3,}$/.test((c[0] ?? "").trim())) continue;
    const v = col.buenos >= 0 ? numeroES(c[col.buenos]) : null;
    if (v != null && v > (totalHoja ?? 0)) totalHoja = v;
  }
  const suma = filas.reduce((s, f) => s + f.kg_buenos, 0);
  if (totalHoja != null && Math.abs(totalHoja - suma) > 1)
    avisos.push(`La hoja suma ${totalHoja} kg buenos y las filas leídas ${suma} kg: revisa que se hayan copiado todas.`);

  // el mismo albarán dos veces (puede ser correcto: dos camiones con el mismo papel)
  const vistos = new Map<string, number>();
  for (const f of filas) vistos.set(f.albaran, (vistos.get(f.albaran) ?? 0) + 1);
  for (const [a, k] of vistos) if (k > 1) avisos.push(`El albarán ${a} sale ${k} veces: se guardan todas (compruébalo en el papel).`);

  return { titulo: [titulo, notasPie].filter(Boolean).join(" | "), sugerido: { ...sugerido, campana: camp ?? null }, filas, avisos, totalHoja };
}

function esFechaValida(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

// ---------------------------------------------------------------- resúmenes

export type Albaran = FilaAlbaran & {
  id: string;
  campana: string;
  finca_id: string | null;
  titular_id: string | null;
  corte: number | null;
  hoja: string | null;
};

export type GrupoAlbaranes = {
  campana: string;
  finca: string;
  titular: string;
  corte: number | null;
  hoja: string | null;
  desde: string;
  hasta: string;
  camiones: number;
  kgBuenos: number;
  kgCitrica: number;
  importe: number;
  /** €/kg sobre los kilos buenos con importe */
  precioKg: number | null;
  /** kg por caja (solo camiones con pesada) */
  kgCaja: number | null;
};

export function agrupar(
  albaranes: Albaran[],
  nombreFinca: Map<string, string>,
  nombreTitular: Map<string, string>,
): GrupoAlbaranes[] {
  const grupos = new Map<string, Albaran[]>();
  for (const a of albaranes) {
    const k = [a.campana, a.finca_id ?? "", a.titular_id ?? "", a.corte ?? "", a.hoja ?? ""].join("|");
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  return [...grupos.values()]
    .map((g) => {
      const a0 = g[0];
      const conImporte = g.filter((a) => a.importe_eur != null && a.kg_buenos > 0);
      const kgConImporte = conImporte.reduce((s, a) => s + a.kg_buenos, 0);
      const pesadas = g.filter((a) => a.cajas && a.bruto_kg);
      const kgPesadas = pesadas.reduce((s, a) => s + a.kg_buenos, 0);
      const cajasPesadas = pesadas.reduce((s, a) => s + (a.cajas ?? 0), 0);
      const fechas = g.map((a) => a.fecha).sort();
      return {
        campana: a0.campana,
        finca: a0.finca_id ? (nombreFinca.get(a0.finca_id) ?? "—") : "Sin finca",
        titular: a0.titular_id ? (nombreTitular.get(a0.titular_id) ?? "—") : "Sin titular",
        corte: a0.corte,
        hoja: a0.hoja,
        desde: fechas[0],
        hasta: fechas[fechas.length - 1],
        camiones: g.length,
        kgBuenos: g.reduce((s, a) => s + a.kg_buenos, 0),
        kgCitrica: g.reduce((s, a) => s + a.kg_citrica, 0),
        importe: conImporte.reduce((s, a) => s + (a.importe_eur ?? 0), 0),
        precioKg: kgConImporte > 0 ? conImporte.reduce((s, a) => s + (a.importe_eur ?? 0), 0) / kgConImporte : null,
        kgCaja: cajasPesadas > 0 ? kgPesadas / cajasPesadas : null,
      };
    })
    .sort((a, b) => b.campana.localeCompare(a.campana) || a.desde.localeCompare(b.desde));
}

/** Kilos buenos e importe por finca de una campaña (para el coste por kilo). */
export function kilosPorFinca(albaranes: Albaran[], campana: string, nombreFinca: Map<string, string>) {
  const m = new Map<string, { finca: string; kg: number; eur: number; kgConImporte: number }>();
  for (const a of albaranes) {
    if (a.campana !== campana || !a.finca_id) continue;
    const finca = nombreFinca.get(a.finca_id);
    if (!finca) continue;
    const x = m.get(finca) ?? { finca, kg: 0, eur: 0, kgConImporte: 0 };
    x.kg += a.kg_buenos;
    if (a.importe_eur != null) {
      x.eur += a.importe_eur;
      x.kgConImporte += a.kg_buenos;
    }
    m.set(finca, x);
  }
  return [...m.values()];
}

// ---------------------------------------------------------------- comparar dos hojas

export type DiferenciaAlbaran = {
  albaran: string;
  fecha: string;
  /** qué pasa: solo en una hoja, o en las dos con datos distintos */
  tipo: "solo_a" | "solo_b" | "distinto";
  a: Pick<Albaran, "fecha" | "cajas" | "kg_buenos" | "kg_citrica" | "importe_eur"> | null;
  b: Pick<Albaran, "fecha" | "cajas" | "kg_buenos" | "kg_citrica" | "importe_eur"> | null;
  campos: string[];
};

export type Comparacion = {
  iguales: number;
  diferencias: DiferenciaAlbaran[];
  totales: {
    a: { camiones: number; kgBuenos: number; kgCitrica: number; importe: number };
    b: { camiones: number; kgBuenos: number; kgCitrica: number; importe: number };
  };
};

/**
 * Compara dos hojas del mismo corte (p. ej. la de Juan Carlos en Excel y la que
 * se apunta a mano en Campo) albarán a albarán. Se emparejan por nº de albarán;
 * si un nº sale varias veces, por orden.
 */
export function compararHojas(a: Albaran[], b: Albaran[]): Comparacion {
  const tot = (xs: Albaran[]) => ({
    camiones: xs.length,
    kgBuenos: xs.reduce((s, x) => s + x.kg_buenos, 0),
    kgCitrica: xs.reduce((s, x) => s + x.kg_citrica, 0),
    importe: xs.reduce((s, x) => s + (x.importe_eur ?? 0), 0),
  });
  const grupos = (xs: Albaran[]) => {
    const m = new Map<string, Albaran[]>();
    for (const x of [...xs].sort((p, q) => p.fecha.localeCompare(q.fecha))) m.set(x.albaran, [...(m.get(x.albaran) ?? []), x]);
    return m;
  };
  const ga = grupos(a);
  const gb = grupos(b);
  const datos = (x: Albaran) => ({ fecha: x.fecha, cajas: x.cajas, kg_buenos: x.kg_buenos, kg_citrica: x.kg_citrica, importe_eur: x.importe_eur });
  const casi = (p: number | null, q: number | null, tol: number) => Math.abs((p ?? 0) - (q ?? 0)) <= tol;
  const diferencias: DiferenciaAlbaran[] = [];
  let iguales = 0;
  for (const n of new Set([...ga.keys(), ...gb.keys()])) {
    const la = ga.get(n) ?? [];
    const lb = gb.get(n) ?? [];
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      const x = la[i];
      const y = lb[i];
      if (x && !y) diferencias.push({ albaran: n, fecha: x.fecha, tipo: "solo_a", a: datos(x), b: null, campos: [] });
      else if (!x && y) diferencias.push({ albaran: n, fecha: y.fecha, tipo: "solo_b", a: null, b: datos(y), campos: [] });
      else if (x && y) {
        const campos = [
          x.fecha !== y.fecha && "fecha",
          (x.cajas ?? 0) !== (y.cajas ?? 0) && "cajas",
          // finca y titular solo si las dos hojas lo dicen
          x.finca_id && y.finca_id && x.finca_id !== y.finca_id && "finca",
          x.titular_id && y.titular_id && x.titular_id !== y.titular_id && "a quién se factura",
          !casi(x.kg_buenos, y.kg_buenos, 0.5) && "kilos buenos",
          !casi(x.kg_citrica, y.kg_citrica, 0.5) && "kilos de cítrica",
          // el importe solo se compara si las dos hojas lo traen
          x.importe_eur != null && y.importe_eur != null && !casi(x.importe_eur, y.importe_eur, 0.05) && "importe",
        ].filter((c): c is string => !!c);
        if (campos.length) diferencias.push({ albaran: n, fecha: x.fecha, tipo: "distinto", a: datos(x), b: datos(y), campos });
        else iguales++;
      }
    }
  }
  diferencias.sort((p, q) => p.fecha.localeCompare(q.fecha) || p.albaran.localeCompare(q.albaran));
  return { iguales, diferencias, totales: { a: tot(a), b: tot(b) } };
}
