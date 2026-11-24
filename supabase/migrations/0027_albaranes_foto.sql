-- =====================================================================
-- CAMPO · Migración 0027: foto de cada albarán (enlace a Drive)
-- Cada albarán de báscula puede llevar el enlace a la foto del papel, guardada
-- en Drive (Documentación › 1 Cosechas › <campaña> › <finca> › Albaranes de
-- báscula, con el nombre «AAAA-MM-DD Citrisol - Albarán báscula NNNNN - Finca»).
-- Así, al repasar la hoja con Juan Carlos, cada fila abre su papel.
-- Se ponen ya las fotos de los dos primeros albaranes de Lobosillo (2026/27).
-- Requiere la migración 0020. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.albaranes add column if not exists foto_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'albaranes_foto_url_check') then
    alter table public.albaranes
      add constraint albaranes_foto_url_check
      check (foto_url is null or (foto_url ~ '^https://' and char_length(foto_url) <= 500));
  end if;
end;
$$;

comment on column public.albaranes.foto_url is 'Enlace (Drive) a la foto del albarán de báscula.';

update public.albaranes a
   set foto_url = v.url
  from (values
    ('10386', 'https://drive.google.com/file/d/1Qx3_AmRsU9TCa7If9HSKfylegYct1RCA/view'),
    ('10388', 'https://drive.google.com/file/d/1jiPLO_9p7X9cBZ-fPVTKNmFmHte0TWSs/view')
  ) as v(albaran, url)
 where a.albaran = v.albaran
   and a.campana = '2026/27'
   and a.finca_id = (select id from public.fincas where nombre = 'Lobosillo')
   and not a.anulado;

select a.albaran, a.fecha, a.kg_buenos, a.kg_citrica, a.foto_url
from public.albaranes a
where a.campana = '2026/27' and not a.anulado
order by a.fecha;

-- Fin de la migración 0027
