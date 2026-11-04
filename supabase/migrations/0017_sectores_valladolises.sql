-- =====================================================================
-- CAMPO · Migración 0017 · Sectores de riego de Valladolises
--
-- Según Juan Carlos / Antonio (4/11/2026), Valladolises riega en dos zonas
-- porque la bomba no tiene fuerza para llegar tan lejos de una vez:
--   · Sector 1: la casa y lo que está a su derecha: La Casa, Mandarinos,
--     Mandarinos 2, Mandarinos viejos y Los Olivos.
--   · Sector 2: a partir del salto entre fincas, lo más lejano al pantano:
--     Del Pozo, Abajo, La Mari y Triviño.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez.
-- =====================================================================

do $$
declare
  v_fv uuid;
  v_s1 uuid;
  v_s2 uuid;
begin
  select id into v_fv from public.fincas where nombre = 'Valladolises';
  if v_fv is null then raise exception 'No encuentro la finca Valladolises'; end if;

  select id into v_s1 from public.sectores_riego where finca_id = v_fv and numero = 1;
  select id into v_s2 from public.sectores_riego where finca_id = v_fv and numero = 2;
  if v_s1 is null or v_s2 is null then raise exception 'No encuentro los sectores 1 y 2 de Valladolises'; end if;

  update public.sectores_riego
     set notas = 'La casa y lo que está a su derecha: La Casa, Mandarinos, Mandarinos 2, Mandarinos viejos y Los Olivos (4/11/2026).'
   where id = v_s1;
  update public.sectores_riego
     set notas = 'A partir del salto entre fincas, lo más lejano al pantano: Del Pozo, Abajo, La Mari y Triviño. Va aparte porque la bomba no tiene fuerza para regar tan lejos a la vez (4/11/2026).'
   where id = v_s2;

  -- quitar repartos anteriores de Valladolises (si los había) y poner los nuevos
  delete from public.zona_sector where finca_id = v_fv;

  insert into public.zona_sector (zona_id, sector_id, finca_id, notas)
  select z.id, case when z.nombre in ('Del Pozo', 'Abajo', 'La Mari', 'Triviño') then v_s2 else v_s1 end,
         v_fv, 'Juan Carlos / Antonio, 4/11/2026'
  from public.zonas z
  where z.finca_id = v_fv
    and z.nombre in ('La Casa', 'Mandarinos', 'Mandarinos 2', 'Mandarinos viejos', 'Los Olivos',
                     'Del Pozo', 'Abajo', 'La Mari', 'Triviño');
end;
$$;

-- Comprobación: cada zona con su sector (deben salir las 9)
select s.numero as sector, z.nombre as zona
from public.zona_sector zs
join public.zonas z on z.id = zs.zona_id
join public.sectores_riego s on s.id = zs.sector_id
join public.fincas f on f.id = zs.finca_id
where f.nombre = 'Valladolises'
order by s.numero, z.nombre;

-- Fin de la migración 0017
