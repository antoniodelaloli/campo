-- =====================================================================
-- CAMPO · demo_fechas_clave.sql · FECHAS CLAVE DE EJEMPLO (ficticias)
--
-- Para enseñarle a Juan Carlos cómo se ve la línea de la campaña 2026/27.
-- Son fechas INVENTADAS y orientativas: todas llevan en la nota
-- «Ejemplo · …» para distinguirlas de las reales.
--
-- Ejecutar en el SQL Editor de Supabase (requiere 0003). Se puede lanzar
-- más de una vez: no duplica.
--
-- PARA QUITARLAS (no se borran, se anulan y desaparecen de la agenda):
--   update public.hitos set estado = 'anulado'
--    where texto like 'Ejemplo ·%' and estado = 'pendiente';
-- =====================================================================

do $$
declare
  v_valladolises uuid;
  v_corvera      uuid;
begin
  select id into v_valladolises from public.fincas where nombre = 'Valladolises';
  select id into v_corvera      from public.fincas where nombre = 'Corvera';

  insert into public.hitos (titulo, texto, tipo, finca_id, fecha, fecha_aproximada, avisar_dias, repetir, origen)
  select e.titulo, e.texto, e.tipo, e.finca, e.fecha::date, e.aprox, e.avisar::integer[], e.repetir, 'manual'
    from (values
      ('Venta de los limones de Corvera',        'Ejemplo · cerrar precio y comprador antes de cortar.',            'corte',       v_corvera,      '2026-11-24', true,  '{7,1,0}',  'no'),
      ('Corte de los limones de Corvera',        'Ejemplo · después de cerrar la venta; con analítica de residuos.', 'corte',       v_corvera,      '2026-12-10', true,  '{7,1,0}',  'no'),
      ('Cierre del año natural (contabilidad)',  'Ejemplo · facturas, gastos e ingresos del año, para la gestoría.', 'plazo',       null,           '2026-12-31', false, '{30,7,1}', 'anual'),
      ('Negociación de los limones de Valladolises', 'Ejemplo · precio para el segundo corte.',                    'corte',       v_valladolises, '2027-01-12', true,  '{7,1,0}',  'no'),
      ('Impuestos del trimestre (4T)',           'Ejemplo · plazo hasta el 30 de enero.',                          'plazo',       null,           '2027-01-30', false, '{14,7,1}', 'anual'),
      ('Corte de los limones de Valladolises',   'Ejemplo · segundo corte, después de venderlos.',                 'corte',       v_valladolises, '2027-02-10', true,  '{7,1,0}',  'no'),
      ('Abonado de primavera',                   'Ejemplo · empezar la fertirrigación de primavera.',              'tratamiento', null,           '2027-03-01', true,  '{7,1}',    'anual'),
      ('Poda',                                   'Ejemplo · después de la cosecha.',                               'otro',        null,           '2027-03-15', true,  '{7,1}',    'anual'),
      ('Floración del limonero',                 'Ejemplo · vigilar plagas en flor.',                              'otro',        null,           '2027-04-05', true,  '{7}',      'anual'),
      ('Impuestos del trimestre (1T)',           'Ejemplo · plazo hasta el 20 de abril.',                          'plazo',       null,           '2027-04-20', false, '{14,7,1}', 'anual'),
      ('Solicitud de la PAC',                    'Ejemplo · fecha orientativa, confirmar con el técnico.',        'plazo',       null,           '2027-04-30', true,  '{30,7,1}', 'anual'),
      ('Tratamiento contra la araña roja',       'Ejemplo · revisar antes si hay ácaros.',                         'tratamiento', v_corvera,      '2027-05-12', true,  '{7,1}',    'no'),
      ('Revisar contadores',                     'Ejemplo · foto de cada contador para cuadrar el agua.',          'revision',    null,           '2027-06-01', false, '{1,0}',    'anual'),
      ('Llenar los pantanos antes del verano',   'Ejemplo · pedir agua del trasvase y del Pozo Villalba.',         'agua',        null,           '2027-06-20', true,  '{7,1}',    'anual'),
      ('Impuestos del trimestre (2T)',           'Ejemplo · plazo hasta el 20 de julio.',                          'plazo',       null,           '2027-07-20', false, '{14,7,1}', 'anual'),
      ('Revisión del atomizador',                'Ejemplo · antes de la nueva campaña.',                           'revision',    null,           '2027-09-15', true,  '{7,1}',    'anual')
    ) as e(titulo, texto, tipo, finca, fecha, aprox, avisar, repetir)
   where not exists (select 1 from public.hitos h where h.titulo = e.titulo and h.texto = e.texto);
end;
$$;

select count(*) as fechas_de_ejemplo from public.hitos where texto like 'Ejemplo ·%' and estado = 'pendiente';
