-- =====================================================================
-- CAMPO · Migración 0011 · Nota en el número de árboles
--
-- El número de árboles a veces viene de un papel antiguo (en Corvera, la hoja
-- impresa de cuando se compró la finca): la app lo enseña con un asterisco y
-- esta nota debajo, porque puede haber cambiado (árboles secos, replantados…).
-- Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.zonas  add column if not exists arboles_nota text
  check (arboles_nota is null or char_length(arboles_nota) <= 300);
alter table public.fincas add column if not exists arboles_nota text
  check (arboles_nota is null or char_length(arboles_nota) <= 300);

comment on column public.zonas.arboles_nota  is 'De dónde sale n_arboles y si puede estar desfasado (la app pone un asterisco).';
comment on column public.fincas.arboles_nota is 'De dónde sale n_arboles_aprox y si puede estar desfasado (la app pone un asterisco).';

update public.zonas z
   set arboles_nota = 'Dato de la hoja impresa de cuando se compró la finca: puede haber cambiado.'
  from public.fincas f
 where f.id = z.finca_id and f.nombre = 'Corvera'
   and z.nombre in ('Rectángulo grande', 'Parcela del panadero');

update public.fincas
   set arboles_nota = 'Dato de la hoja impresa de cuando se compró la finca: puede haber cambiado.'
 where nombre = 'Corvera';

-- Fin de la migración 0011
