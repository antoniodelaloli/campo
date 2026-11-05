-- =====================================================================
-- CAMPO · Tres facturas de gasto de septiembre de 2026 (las pagó JHSYO)
-- Leídas de la carpeta de Drive de Antonio (5/11/2026). El PDF de cada una está
-- en Drive (enlace en las notas). Se puede ejecutar más de una vez: no duplica.
--   1. Pozo Villalba nº 101 (30/09/2026): agua de riego, 21.990 m³ a 0,85 €/m³ → Corvera
--   2. Ruraltech 26F3789 (30/09/2026): productos (tratamientos) y abonos → sin finca concreta
--   3. Axpo SCOMPW-26-0132239 (10/09/2026): luz de agosto de Valladolises
-- Requiere las migraciones 0014 y 0015.
-- =====================================================================

do $$
declare
  v_jhsyo uuid;
  v_corvera uuid;
  v_vall uuid;
begin
  select id into v_jhsyo from public.titulares where nombre = 'JHSYO';
  select id into v_corvera from public.fincas where nombre = 'Corvera';
  select id into v_vall from public.fincas where nombre = 'Valladolises';
  if v_jhsyo is null then raise exception 'No encuentro el titular JHSYO (¿falta la migración 0014?)'; end if;

  insert into public.facturas
    (tipo, estado, titular_id, finca_id, campana, fecha, numero, contraparte, concepto, categoria,
     base_eur, impuesto_eur, cuenta_limite, origen, notas)
  select v.tipo, 'emitida', v_jhsyo, v.finca, '2026/27', v.fecha::date, v.numero, v.contraparte, v.concepto, v.categoria,
         v.base, v.iva, false, 'import', v.notas
  from (values
    ('gasto', v_corvera, '2026-09-30', '101', 'Pozo Villalba, S.L.',
     'Agua para riego: 21.990 m³ a 0,85 €/m³', 'agua', 18691.50, 1869.15,
     'IVA 10 %. Total 20.560,65 €. PDF: https://drive.google.com/file/d/1HnNpwwRwS39UR9w_1VpX7HusPmamtG-f/view'),
    ('gasto', null::uuid, '2026-09-30', '26F3789', 'Ruraltech, S.L.U.',
     'Productos fitosanitarios y abonos (Quassar, Azupec, Suporter, Dorian, Torcha, Adur, Spintor cebo, Jalisco, Mullo, Codasal, Codasil)',
     'productos', 8677.64, 867.76,
     'IVA 10 %. Total 9.545,40 €. Incluye unos 2.143 € de abonos (Codasal Premium 1.000 L y Codasil). Sin finca: por confirmar a cuál va. PDF: https://drive.google.com/file/d/1-uRik9fV2PC5VImrG19Zo1DIxpCVG5XN/view'),
    ('gasto', v_vall, '2026-09-10', 'SCOMPW-26-0132239', 'Axpo Iberia',
     'Luz de agosto de 2026 (01/08-31/08), tarifa 6.1TD', 'luz', 1174.35, 246.61,
     'IVA 21 %. Total 1.420,96 €. Suministro en C/ Los Morenos 15, Fuente Álamo (Valladolises). PDF: https://drive.google.com/file/d/1JeBye50s0VyESmJcaWyvEUM60-h4WcIF/view')
  ) as v(tipo, finca, fecha, numero, contraparte, concepto, categoria, base, iva, notas)
  where not exists (
    select 1 from public.facturas f
    where f.numero = v.numero and f.contraparte = v.contraparte and not f.anulado
  );
end;
$$;

-- Comprobación
select fecha, contraparte, numero, categoria, base_eur, impuesto_eur, total_eur
from public.facturas where tipo = 'gasto' and not anulado order by fecha;
