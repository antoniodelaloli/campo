-- =====================================================================
-- CAMPO · Migración 0009 · Zonas de Valladolises dibujadas en Google Earth
--
-- Antonio dibujó las zonas de Valladolises en Google Earth (archivo «Fincas.kml»,
-- Drive, carpeta PROGRAMA IA FINCAS, 3/11/2026). Esta migración:
--   1. Crea las tres zonas de mandarinos que aún no existían (nombres provisionales).
--   2. Guarda en cada zona su forma (geom) y su superficie aproximada, solo si la
--      zona no tenía ya superficie apuntada. La fiabilidad no cambia.
-- Correspondencias provisionales (por confirmar con Juan Carlos):
--   «Valladolises 1/2 parcela 1» = La Casa · «Limoneros los olivos» = Los Olivos ·
--   «Nuevos Pozo» = Del Pozo (Los Nuevos) · «viejos abajo» = Abajo · «MARI» = La Mari.
-- Los dibujos son aproximados. Se puede ejecutar más de una vez.
-- =====================================================================

do $$
declare
  v_fv uuid;
begin
  select id into v_fv from public.fincas where nombre = 'Valladolises';
  if v_fv is null then
    raise exception 'No encuentro la finca Valladolises';
  end if;

  insert into public.zonas (finca_id, nombre, especie, fiabilidad, notas)
  values
    (v_fv, 'Mandarinos', 'Mandarino', 'pendiente', 'Dibujada por Antonio en Google Earth (3/11/2026). Nombre provisional, por confirmar.'),
    (v_fv, 'Mandarinos viejos', 'Mandarino', 'pendiente', 'Dibujada por Antonio en Google Earth (3/11/2026). Nombre provisional, por confirmar.'),
    (v_fv, 'Mandarinos 2', 'Mandarino', 'pendiente', 'Dibujada por Antonio en Google Earth (3/11/2026). Nombre provisional, por confirmar.')
  on conflict (finca_id, nombre) do nothing;

  update public.zonas
     set geom = extensions.ST_GeomFromText('MULTIPOLYGON(((-1.1079919 37.7714315, -1.1072944 37.7705802, -1.1065703 37.7710112, -1.1067714 37.7711811, -1.1054538 37.7724701, -1.1058916 37.7728510, -1.1066054 37.7733418, -1.1068232 37.7734179, -1.1073476 37.7729847, -1.1084226 37.7719656, -1.1079919 37.7714315)))', 4326),
         superficie_ha = coalesce(superficie_ha, 4.16)
   where finca_id = v_fv and nombre = 'La Casa';

  update public.zonas
     set geom = extensions.ST_GeomFromText('MULTIPOLYGON(((-1.1033211 37.7737034, -1.1043803 37.7723408, -1.1034265 37.7716641, -1.1024756 37.7736263, -1.1033211 37.7737034)))', 4326),
         superficie_ha = coalesce(superficie_ha, 1.83)
   where finca_id = v_fv and nombre = 'Los Olivos';

  update public.zonas
     set geom = extensions.ST_GeomFromText('MULTIPOLYGON(((-1.1065300 37.7735025, -1.1047520 37.7722120, -1.1042157 37.7718225, -1.1038942 37.7715975, -1.1035725 37.7713474, -1.1033943 37.7715778, -1.1036146 37.7717052, -1.1043397 37.7721942, -1.1052082 37.7727968, -1.1060720 37.7737695, -1.1065300 37.7735025)))', 4326),
         superficie_ha = coalesce(superficie_ha, 0.98)
   where finca_id = v_fv and nombre = 'Mandarinos';

  update public.zonas
     set geom = extensions.ST_GeomFromText('MULTIPOLYGON(((-1.1059452 37.7736639, -1.1056171 37.7732673, -1.1049713 37.7727121, -1.1040590 37.7737672, -1.1047045 37.7739366, -1.1053792 37.7742418, -1.1060230 37.7738169, -1.1059452 37.7736639)))', 4326),
         superficie_ha = coalesce(superficie_ha, 1.49)
   where finca_id = v_fv and nombre = 'Mandarinos viejos';

  update public.zonas
     set geom = extensions.ST_GeomFromText('MULTIPOLYGON(((-1.1039882 37.7737782, -1.1049396 37.7726646, -1.1044173 37.7723410, -1.1033701 37.7737147, -1.1039882 37.7737782)))', 4326),
         superficie_ha = coalesce(superficie_ha, 0.88)
   where finca_id = v_fv and nombre = 'Mandarinos 2';

  update public.zonas
     set geom = extensions.ST_GeomFromText('MULTIPOLYGON(((-1.1005874 37.7735944, -1.1022384 37.7705148, -1.1013567 37.7699176, -1.0997206 37.7733271, -1.1005874 37.7735944)))', 4326),
         superficie_ha = coalesce(superficie_ha, 3.47)
   where finca_id = v_fv and nombre = 'Del Pozo';

  update public.zonas
     set geom = extensions.ST_GeomFromText('MULTIPOLYGON(((-1.0981312 37.7729301, -1.0996413 37.7733027, -1.1012407 37.7699172, -1.0992936 37.7685587, -1.0988250 37.7691858, -1.0969615 37.7727806, -1.0977496 37.7733499, -1.0981312 37.7729301)))', 4326),
         superficie_ha = coalesce(superficie_ha, 10.83)
   where finca_id = v_fv and nombre = 'Abajo';

  update public.zonas
     set geom = extensions.ST_GeomFromText('MULTIPOLYGON(((-1.0988027 37.7691570, -1.0992785 37.7684211, -1.0985370 37.7679227, -1.0975990 37.7684907, -1.0988027 37.7691570)))', 4326),
         superficie_ha = coalesce(superficie_ha, 1.02)
   where finca_id = v_fv and nombre = 'Triviño';

  update public.zonas
     set geom = extensions.ST_GeomFromText('MULTIPOLYGON(((-1.0975833 37.7736311, -1.0976587 37.7734643, -1.0973562 37.7731731, -1.0969088 37.7728346, -1.0966988 37.7732216, -1.0975833 37.7736311)))', 4326),
         superficie_ha = coalesce(superficie_ha, 0.31)
   where finca_id = v_fv and nombre = 'La Mari';

end;
$$;

-- Comprobación: las nueve zonas con su superficie
select z.nombre, z.especie, z.superficie_ha, z.geom is not null as con_forma
from public.zonas z join public.fincas f on f.id = z.finca_id
where f.nombre = 'Valladolises'
order by z.nombre;

-- Fin de la migración 0009
