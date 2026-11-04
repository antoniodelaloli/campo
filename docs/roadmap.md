# Campo · Hoja de ruta

Ideas y trabajos de desarrollo pendientes de la app. Lo más reciente arriba.
Cuando algo se haga, se tacha y se pone la fecha.

## Pendiente

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

- [ ] **Precios del limón de la Consejería** (apuntado el 4/11/2026)
  Revisar los precios que publica la Consejería de Agricultura de la Región de Murcia en su web
  (precios agrarios semanales / de referencia) y ver cómo traerlos a Campo: precio del limón
  Fino y Verna por semana, para compararlo con lo que liquidan Citrisol y los compradores.
  Primero: ver qué publica exactamente, cada cuánto y en qué formato (página, PDF, Excel).
  Después: decidir si se lee solo (cada semana) o se apunta a mano, y dónde se enseña
  (Cosecha, junto a la liquidación de cada campaña).

- [ ] **Que la app funcione sin cobertura en el campo** (apuntar sin red y enviar al volver la cobertura).

- [ ] **Sectores de riego en los planos**: falta la tabla de qué zonas riega cada sector
  (Valladolises y Corvera) para pintarlos.

- [ ] **Atajo de Siri «Incidencia» en el iPhone de Juan Carlos**: crear su clave en /atajos y montarle el atajo.

- [ ] **Avisos de tormenta**: valorar avisar solo de granizo, o de tormenta solo con probabilidad alta
  (Open-Meteo marca «tormenta» con poco riesgo; ej. Lobosillo, 4/11/2026).

- [ ] **Esquema visual de la campaña del limonero** (mayo a mayo) frente al ejercicio fiscal
  (enero a diciembre), como pidió Juan Carlos en su idea del 4/11/2026.

## Hecho

- [x] Cuentas, primera parte (migración 0014): titulares (Maite, Carlos, JHSYO), facturas de venta con titular y finca de origen, contador del límite de 250.000 € por año y simulador «¿a nombre de quién facturo este corte?» en /cuentas (4/11/2026). Falta: meter las facturas de 2026, gastos con foto, reparto por socio y exportar para el gestor.
- [x] Riegos pedidos a la Comunidad de Regantes (talones, migración 0013): gasto por campaña y año fiscal, comparación con el año pasado, por meses y por arqueta; «Gastos de la campaña» en Cosecha (4/11/2026). Falta: apuntar lecturas del contador de entrada para comprobar si llega toda el agua.
- [x] Diario a la vista: página /diario y últimas notas en cada ficha; herramienta «ver_diario» en el conector (4/11/2026).
- [x] Lobosillo con los límites del Catastro, en dos trozos (3/11/2026).
- [x] Mapa de inicio: Valladolises solo con el bloque de la casa; arreglo de los carteles en el móvil (3/11/2026).
