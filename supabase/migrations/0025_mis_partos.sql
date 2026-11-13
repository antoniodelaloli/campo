-- =====================================================================
-- CAMPO · Migración 0025: Mis Partos, C.B. (Lobosillo)
-- Lobosillo se factura a nombre de Mis Partos, C.B., una comunidad de bienes de
-- Blanca Martínez, Alejandro García-Melgares y Juan Carlos García-Melgares
-- (Antonio, 13/11/2026). No va por módulos: se hizo como comunidad de bienes
-- porque la finca puede dar pérdidas los primeros años. Por eso:
--   · no tiene tarjeta de límite en Cuentas y sus ventas NO suman al límite de
--     Juan Carlos (ni de nadie);
--   · sí sale en «Se factura a» (factura a Citrisol).
-- Reparto: a partes iguales, un tercio cada comunero (supuesto; cambiar aquí si no).
-- Requiere 0021 y 0023. Se puede ejecutar más de una vez.
-- =====================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'titulares' and column_name = 'factura') then
    raise exception 'Falta la migración 0023: ejecútala antes que esta.';
  end if;
end;
$$;

insert into public.titulares (nombre, nombre_completo, tipo, en_modulos, factura, notas) values
  ('Mis Partos CB', 'Mis Partos, C.B.', 'sociedad', false, true,
   'Comunidad de bienes de Lobosillo: Blanca Martínez, Alejandro García-Melgares y Juan Carlos García-Melgares. No va por módulos (puede dar pérdidas los primeros años). Socio 12110 de Citrisol.'),
  ('Blanca Martínez', 'Blanca Martínez', 'persona', false, false, 'Comunera de Mis Partos, C.B. (Lobosillo). No factura limón a su nombre.'),
  ('Alejandro García-Melgares', 'Alejandro García-Melgares', 'persona', false, false, 'Comunero de Mis Partos, C.B. (Lobosillo). No factura limón a su nombre.')
on conflict (nombre) do update
  set nombre_completo = excluded.nombre_completo, tipo = excluded.tipo,
      en_modulos = excluded.en_modulos, factura = excluded.factura, notas = excluded.notas;

insert into public.titular_socios (sociedad_id, socio_id, participacion)
select s.id, p.id, 1.0 / 3
from public.titulares s
join public.titulares p on p.nombre in ('Blanca Martínez', 'Alejandro García-Melgares', 'Carlos')
where s.nombre = 'Mis Partos CB'
on conflict (sociedad_id, socio_id) do nothing;

-- Los albaranes de Lobosillo de la campaña 2026/27, a nombre de Mis Partos
update public.albaranes a
   set titular_id = (select id from public.titulares where nombre = 'Mis Partos CB')
 where a.campana = '2026/27'
   and a.finca_id = (select id from public.fincas where nombre = 'Lobosillo')
   and a.titular_id is null
   and not a.anulado;

select s.nombre as sociedad, p.nombre as comunero, round(ts.participacion * 100, 2) as pct,
       s.en_modulos as sociedad_en_modulos, s.factura as sociedad_factura
from public.titular_socios ts
join public.titulares s on s.id = ts.sociedad_id
join public.titulares p on p.id = ts.socio_id
where s.nombre = 'Mis Partos CB'
order by p.nombre;

-- Fin de la migración 0025
