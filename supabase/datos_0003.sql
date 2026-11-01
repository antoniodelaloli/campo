-- =====================================================================
-- CAMPO · datos_0003.sql · Primeros hitos del calendario
--
-- Sacados del documento de la familia (30-31/10/2026) y de la normativa.
-- Las fechas que no son exactas van marcadas como aproximadas (≈).
--
-- Ejecutar DESPUÉS de 0003_hitos.sql, desde el SQL Editor de Supabase.
-- Se puede lanzar más de una vez: cada hito comprueba antes si ya existe.
-- =====================================================================

do $$
declare
  v_valladolises uuid;
  v_corvera      uuid;
begin
  select id into v_valladolises from public.fincas where nombre = 'Valladolises';
  select id into v_corvera      from public.fincas where nombre = 'Corvera';

  if v_valladolises is null or v_corvera is null then
    raise exception 'Faltan las fincas: ejecuta antes seed.sql';
  end if;

  -- Primer corte de Valladolises (fecha orientativa)
  if not exists (select 1 from public.hitos where titulo = 'Primer corte de Valladolises') then
    insert into public.hitos (titulo, texto, tipo, finca_id, fecha, fecha_aproximada, avisar_dias, origen)
    values ('Primer corte de Valladolises',
            'Previsto a finales de octubre o principios de noviembre, según la analítica de residuos. Se esperan dos cortes. Fecha sin confirmar.',
            'corte', v_valladolises, date '2026-11-02', true, '{7,1,0}', 'import');
  end if;

  -- Contrato 2026/27: cambio de precio de referencia
  if not exists (select 1 from public.hitos where titulo = 'Precio de referencia: de «un corte» a «todo limón»') then
    insert into public.hitos (titulo, texto, tipo, finca_id, fecha, fecha_aproximada, avisar_dias, origen)
    values ('Precio de referencia: de «un corte» a «todo limón»',
            'Contrato 2026/27 de Valladolises y Corvera: se liquida con el precio medio de la Consejería para «un corte» mientras exista y luego «todo limón». El cambio suele ser antes de Navidad.',
            'corte', null, date '2026-12-15', true, '{14,7,1}', 'import');
  end if;

  -- Normativa: registro electrónico de tratamientos
  if not exists (select 1 from public.hitos where titulo = 'Tratamientos en el cuaderno digital (CUE)') then
    insert into public.hitos (titulo, texto, tipo, finca_id, fecha, fecha_aproximada, avisar_dias, origen)
    values ('Tratamientos en el cuaderno digital (CUE)',
            'Desde el 1 de enero de 2027 los tratamientos fitosanitarios se tienen que anotar por medios electrónicos (CUE digital); en papel solo hasta el 31/12/2026. Hablarlo con el técnico.',
            'plazo', null, date '2027-01-01', false, '{30,7,1}', 'import');
  end if;
end;
$$;
