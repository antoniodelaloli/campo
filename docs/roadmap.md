# Campo · Hoja de ruta

Ideas y trabajos de desarrollo pendientes de la app. Lo más reciente arriba.
Cuando algo se haga, se tacha y se pone la fecha.

## Pendiente

- [ ] **Registrar cómo trabajan, corte a corte** (apuntado el 5/11/2026)
  Objetivo de Antonio: que Campo recoja su forma de hacer (de qué finca sale cada camión y a nombre de quién
  se factura) para ayudarles con la contabilidad y tener estadísticas reales para decidir.
  1. **Albaranes del corte en curso, uno a uno:** hecho el formulario (Albaranes → «Apuntar albaranes uno a uno»,
     con pesada y kg/caja en vivo) y la comparación de dos hojas albarán a albarán (5/11/2026). Falta la
     herramienta «apuntar_albaran» en el conector (por voz o con foto del albarán).
  2. **Plan del corte:** antes de facturar, repartir los kilos previstos entre titulares con el simulador y
     guardarlo como facturas «previstas»; al llegar la factura, se marca emitida.
  3. **Cuadre automático:** albaranes ↔ facturas ↔ liquidación de cada corte, con aviso si algo no casa.
  4. **Fotos (para más adelante, a posteriori):** adjuntar a cada hoja de Albaranes la foto o el PDF de la hoja
     impresa, firmada y sellada (una por corte, como prueba). Más adelante, si compensa: foto de cada albarán que
     rellene sola la línea (nº, cajas, pesada) para revisarla, en vez de teclearla.
  5. **Regla del límite por confirmar con el asesor:** si se suman las ventas de JHSYO a cada socio (ahora se
     enseñan las dos cuentas).

- [ ] **Newsletter de los domingos para la familia** (apuntado el 5/11/2026)
  Un resumen semanal por correo, los domingos, para los familiares que se quieran suscribir.
  Qué contaría: lo hecho en la semana (diario, tareas terminadas, tratamientos, cortes), el agua y los
  pantanos, el tiempo de la semana que viene, cómo va la campaña (kilos, precio, gastos por kilo),
  las ideas nuevas de la libreta y un «dato de la semana».
  Por decidir: quién se apunta (lista de correos y botón para darse de baja), qué datos se pueden enseñar
  a toda la familia y cuáles no (cuentas de cada titular, límites de ventas), y si lo revisa Antonio antes de enviarlo.
  Cómo: el mismo servidor que manda el aviso de las 7:00, un envío semanal con el servicio de correo (Resend).

- [ ] **Estilo «sobrio» (sin videojuego) para quien lo prefiera** (apuntado el 5/11/2026)
  Hecho (5/11/2026, migración 0022): ajuste «estilo» por usuario (granja / sobrio), botón para cambiarlo en la
  barra de arriba, colores, letra (IBM Plex Sans), paneles y botones sobrios en toda la app, y el mapa de
  inicio como plano (contornos del Catastro con filas de árboles, sin 3D). Juan Carlos, en sobrio.
  Falta: fase 3, foto aérea del PNOA en «Satélite»; repasar colores fijos sueltos de algunas pantallas.

- [ ] **Gastos en tiempo real** (apuntado el 4/11/2026)
  Ir metiendo los gastos según se hacen (facturas de abonos y productos, agua, luz, gasoil,
  jornales, reparaciones…), por finca y por campaña, y ver en todo momento cuánto se lleva gastado.
  Apuntarlos fácil: por voz desde ChatGPT o con una foto de la factura.
  Enlaza con las facturas de venta (abajo): ingresos menos gastos = cómo va cada finca, y
  los gastos que entren en el reparto de cada socio.

- [ ] **Facturas de venta claras, para los módulos y las cuentas de cada socio** (apuntado el 4/11/2026)
  Tener en Campo todas las facturas y liquidaciones de venta del limón (Citrisol y otros compradores),
  por finca y por campaña, con fecha de factura, kilos, precio y total. Con eso:
  - calcular lo que toca declarar en **módulos** (estimación objetiva), que va por año fiscal (enero a diciembre);
  - llevar las **cuentas de cada socio y hermano** según su parte en cada finca.
  Por concretar: qué parte tiene cada uno en cada finca, quién factura (a nombre de quién va cada
  factura) y qué gastos entran en el reparto. Ojo: una misma campaña se factura en dos años fiscales.

- [ ] **Precios, ofertas y competencia** (apuntado el 4/11/2026; tarea en el calendario de Antonio)
  1. Sacar (scrapear) los precios de referencia de la Consejería: «un corte» (p. ej. 0,40-0,50 €/kg; a veces
     se cierra a la mitad, 0,45) y «todo limón» (suele ser más bajo). Mandarina también.
  2. Apuntar las ofertas que recibimos: comprador, fecha, finca, tipo de corte (primer corte / todo), precio y calibre.
  3. Apuntar los precios a los que sabemos que venden los competidores.
  4. Comparar todo en un gráfico a lo largo del año para decidir cuándo vender, a qué precio y cuánto.

- [ ] **Precios del limón de la Consejería** (apuntado el 4/11/2026)
  Para qué (Juan Carlos, 4/11/2026): nuestro limón es tardío y conviene cortar en los meses de mejor precio.
  Objetivo: un gráfico del precio semana a semana de varias campañas, con la media por mes, para ver qué
  meses pagan más; marcar en él cuándo cortamos nosotros y a cuánto, y un «dato del día» cuando suba o baje.
  Revisar los precios que publica la Consejería de Agricultura de la Región de Murcia en su web
  (precios agrarios semanales / de referencia) y ver cómo traerlos a Campo: precio del limón
  Fino y Verna por semana, para compararlo con lo que liquidan Citrisol y los compradores.
  Primero: ver qué publica exactamente, cada cuánto y en qué formato (página, PDF, Excel).
  Después: decidir si se lee solo (cada semana) o se apunta a mano, y dónde se enseña
  (Cosecha, junto a la liquidación de cada campaña).

- [ ] **Que la app funcione sin cobertura en el campo** (apuntar sin red y enviar al volver la cobertura).

- [ ] **Sectores de riego en los planos**: Valladolises hecho (4/11/2026, migración 0017). Falta Corvera:
  confirmar cuál de las dos franjas es el sector 1 y cuál el 2.

- [ ] **Atajo de Siri «Incidencia» en el iPhone de Juan Carlos**: crear su clave en /atajos y montarle el atajo.

- [ ] **Avisos de tormenta**: valorar avisar solo de granizo, o de tormenta solo con probabilidad alta
  (Open-Meteo marca «tormenta» con poco riesgo; ej. Lobosillo, 4/11/2026).

- [ ] **Esquema visual de la campaña del limonero** (mayo a mayo) frente al ejercicio fiscal
  (enero a diciembre), como pidió Juan Carlos en su idea del 4/11/2026.

- [ ] **Más «datos del día»** para el aviso de la mañana (lib/dato-del-dia.ts). Ideas: kilos cortados
  frente al año pasado (cuando haya albaranes), € por kilo de cada corte, gasto de la campaña por finca,
  días sin llover, días desde la última fumigación y plazos de seguridad, árboles por zona, agua por kilo cosechado.

## Hecho

- [x] Albaranes de báscula (migración 0020): página /cosecha/albaranes para pegar las hojas de Excel de cada corte (una fila por camión), con campaña, finca, corte y titular deducidos del título; resumen por finca y titular; el coste por kilo usa sus kilos por finca. Metidas las 9 hojas buenas de los Excel de Juan Carlos (5/11/2026; análisis en docs/albaranes-excel.md). Falta: confirmar la finca de las hojas de 2025/26 y el Excel del corte de Carlos de febrero de 2026.
- [x] Tratamientos sin finca al 50 % entre Valladolises y Corvera en el coste por kilo (5/11/2026).
- [x] KPI «¿Cuánto nos cuesta cada kilo?» en Cosecha: gastos de la campaña (facturas de gasto + agua de la Comunidad) entre kilos vendidos = precio mínimo; precio de venta y margen por kilo, por finca (5/11/2026). Será fiable cuando estén metidos todos los gastos.
- [x] «Dato del día» en el aviso de cada mañana y en el resumen del conector: agua de la campaña frente al año pasado, últimos 30 días, ahorro por precio, pantanos, ventas por titular (y aviso si alguien se acerca al límite), ideas de la semana y fase de la campaña (4/11/2026).
- [x] Cuentas, primera parte (migración 0014): titulares (Maite, Carlos, JHSYO), facturas de venta con titular y finca de origen, contador del límite de 250.000 € por año y simulador «¿a nombre de quién facturo este corte?» en /cuentas (4/11/2026). Falta: meter las facturas de 2026, gastos con foto, reparto por socio y exportar para el gestor.
- [x] Riegos pedidos a la Comunidad de Regantes (talones, migración 0013): gasto por campaña y año fiscal, comparación con el año pasado, por meses y por arqueta; «Gastos de la campaña» en Cosecha (4/11/2026). Falta: apuntar lecturas del contador de entrada para comprobar si llega toda el agua.
- [x] Diario a la vista: página /diario y últimas notas en cada ficha; herramienta «ver_diario» en el conector (4/11/2026).
- [x] Lobosillo con los límites del Catastro, en dos trozos (3/11/2026).
- [x] Mapa de inicio: Valladolises solo con el bloque de la casa; arreglo de los carteles en el móvil (3/11/2026).
