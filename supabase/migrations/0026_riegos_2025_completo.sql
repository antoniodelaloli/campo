-- =====================================================================
-- CAMPO · Migración 0026 · Riegos de enero a julio de 2025 y de noviembre de 2026
--
-- Completa los talones de riego de la Comunidad de Regantes del Campo de
-- Cartagena (Valladolises). La 0013 traía del 2/8/2025 al 31/10/2026; esta
-- añade lo que faltaba según el listado de movimientos del 17/11/2026
-- (PDF «COMUNIDAD DE REGANTES DEL CAMPO DE CARTAGENA.pdf», en Drive):
--   · 1/1/2025 – 1/8/2025: 41 talones y 5 ingresos para riego.
--   · 1/11/2026 – 14/11/2026: 4 talones.
-- Con esto el total coincide con el PDF: 207 talones, 289.724 m³ y
-- 96.203,80 € («Importe total riego»); 14 ingresos por 100.000 €.
-- No se copian el «Saldo acreedor anterior» ni el «Cierre regante debe»:
-- son el cierre del año de la Comunidad, no dinero ni agua nuevos.
--
-- Requiere 0013. Se puede ejecutar más de una vez (no duplica).
-- =====================================================================

do $$
declare
  v_fv uuid;
  v_prov constant text := 'Comunidad de Regantes del Campo de Cartagena';
begin
  select id into v_fv from public.fincas where nombre = 'Valladolises';
  if v_fv is null then
    raise exception 'No encuentro la finca Valladolises';
  end if;

  insert into public.suministros_agua
    (finca_id, fecha, origen_agua, talon, arqueta, precio_eur_m3, volumen_m3, coste_eur,
     proveedor, fiabilidad, origen, notas)
  select v_fv, t.fecha::date, 'trasvase', t.talon, t.arqueta, t.precio, t.m3, t.importe,
         v_prov, 'declarado', 'import', 'Talón de riego (listado de la Comunidad, 17/11/2026)'
  from (values
    ('2025-01-10', '1060', '22.32.1', 0.34, 1356, 461.04),
    ('2025-01-25', '1233', '22.32.1', 0.34, 1153, 392.02),
    ('2025-01-27', '1245', '22.32.1', 0.34, 872, 296.48),
    ('2025-02-21', '1652', '22.32.1', 0.34, 1347, 457.98),
    ('2025-02-22', '1666', '22.32.1', 0.34, 1323, 449.82),
    ('2025-02-23', '1678', '22.32.1', 0.34, 1133, 385.22),
    ('2025-04-25', '2191', '22.32.1', 0.34, 1319, 448.46),
    ('2025-04-26', '2214', '22.32.1', 0.34, 3058, 1039.72),
    ('2025-04-29', '2240', '22.32.1', 0.34, 1341, 455.94),
    ('2025-05-02', '2280', '22.32.1', 0.34, 13, 4.42),
    ('2025-05-09', '2376', '22.32.1', 0.34, 1289, 438.26),
    ('2025-05-10', '2395', '22.32.1', 0.34, 1235, 419.90),
    ('2025-05-11', '2405', '22.32.1', 0.34, 1271, 432.14),
    ('2025-05-16', '2475', '22.32.1', 0.34, 1167, 396.78),
    ('2025-05-17', '2497', '22.32.1', 0.34, 1283, 436.22),
    ('2025-05-30', '2667', '22.32.1', 0.34, 1319, 448.46),
    ('2025-05-31', '2692', '22.32.1', 0.34, 1284, 436.56),
    ('2025-06-01', '2699', '22.32.1', 0.34, 1350, 459.00),
    ('2025-06-13', '2919', '22.32.1', 0.34, 1070, 363.80),
    ('2025-06-14', '2943', '22.32.1', 0.34, 1123, 381.82),
    ('2025-06-15', '2955', '22.32.1', 0.34, 1349, 458.66),
    ('2025-06-19', '3049', '22.32.1', 0.34, 3001, 1020.34),
    ('2025-06-20', '3059', '22.32.1', 0.34, 1151, 391.34),
    ('2025-06-24', '3138', '22.32.1', 0.34, 1259, 428.06),
    ('2025-06-26', '3179', '22.32.1', 0.34, 1435, 487.90),
    ('2025-07-04', '3374', '22.32.1', 0.34, 1253, 426.02),
    ('2025-07-05', '3399', '22.32.1', 0.34, 1236, 420.24),
    ('2025-07-06', '3418', '22.32.1', 0.34, 1304, 443.36),
    ('2025-07-07', '3445', '22.32.1', 0.34, 1295, 440.30),
    ('2025-07-08', '3475', '22.32.1', 0.34, 1242, 422.28),
    ('2025-07-11', '3542', '22.32.1', 0.34, 1280, 435.20),
    ('2025-07-12', '3566', '22.32.1', 0.34, 1248, 424.32),
    ('2025-07-13', '3581', '22.32.1', 0.34, 1319, 448.46),
    ('2025-07-18', '3683', '22.32.1', 0.34, 2979, 1012.86),
    ('2025-07-19', '3696', '22.32.1', 0.34, 1127, 383.18),
    ('2025-07-20', '3719', '22.32.1', 0.34, 1309, 445.06),
    ('2025-07-21', '3736', '22.32.1', 0.34, 1348, 458.32),
    ('2025-07-26', '3845', '22.32.1', 0.34, 1274, 433.16),
    ('2025-07-27', '3862', '22.32.1', 0.34, 1346, 457.64),
    ('2025-07-29', '3905', '22.32.1', 0.34, 1309, 445.06),
    ('2025-07-30', '3934', '22.32.1', 0.34, 3001, 1020.34),
    ('2026-11-06', '329', '22.32.1', 0.32, 1172, 375.04),
    ('2026-11-07', '342', '22.32.1', 0.32, 1022, 327.04),
    ('2026-11-13', '402', '22.32.1', 0.32, 1080, 345.60),
    ('2026-11-14', '415', '22.32.1', 0.32, 1089, 348.48)
  ) as t(fecha, talon, arqueta, precio, m3, importe)
  on conflict (finca_id, proveedor, talon, fecha) where talon is not null do nothing;

  insert into public.pagos_agua (finca_id, fecha, importe_eur, proveedor, origen, notas)
  select v_fv, i.fecha::date, i.importe, v_prov, 'import', 'Listado de la Comunidad (17/11/2026)'
  from (values
    ('2025-01-02', 5000),
    ('2025-05-05', 5000),
    ('2025-06-17', 5000),
    ('2025-07-10', 5000),
    ('2025-07-31', 5000)
  ) as i(fecha, importe)
  on conflict (finca_id, proveedor, fecha, importe_eur) do nothing;
end;
$$;

-- Comprobación: debe dar 207 talones, 289724 m³ y 96203.80 €; 14 ingresos por 100000 €
select 'talones' as que, count(*) as n, sum(volumen_m3) as m3, sum(coste_eur) as eur
from public.suministros_agua where talon is not null and not anulado
union all
select 'ingresos', count(*), null, sum(importe_eur) from public.pagos_agua where not anulado;

-- Fin de la migración 0026
