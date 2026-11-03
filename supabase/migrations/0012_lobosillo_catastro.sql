-- =====================================================================
-- CAMPO · Migración 0012 · Lobosillo con los límites del Catastro
--
-- Lobosillo son dos trozos (Catastro de Murcia, 3/11/2026):
--   1. El de la casa, la balsa y la pista de fútbol: polígono 535, parcelas 63 y 64
--      (5.623 + 10.997 m² = 1,66 ha).
--   2. La parcela de la escritura: polígono 536, parcela 67 (20.246 m² = 2,02 ha),
--      unos 400 m al nordeste.
-- Total: 36.866 m² ≈ 3,69 ha. La escritura dice 2 ha 13 a 70 ca: se apunta en notas.
-- Se puede ejecutar más de una vez.
-- =====================================================================

update public.fincas
   set geom = extensions.ST_GeomFromText('MULTIPOLYGON(((-1.081588 37.718974, -1.080623 37.719271, -1.080283 37.718790, -1.079876 37.718224, -1.079864 37.718207, -1.079645 37.717890, -1.079703 37.717820, -1.079793 37.717765, -1.079962 37.717712, -1.080239 37.717688, -1.080478 37.717695, -1.080695 37.717669, -1.080935 37.717959, -1.081067 37.718155, -1.081142 37.718235, -1.081279 37.718482, -1.081588 37.718974)), ((-1.076998 37.721281, -1.076993 37.721237, -1.076999 37.721165, -1.077015 37.721171, -1.078293 37.721660, -1.078481 37.721818, -1.079036 37.722854, -1.079044 37.722869, -1.079015 37.722883, -1.078808 37.722898, -1.078574 37.722899, -1.078226 37.722835, -1.078030 37.722812, -1.077756 37.722818, -1.077428 37.722869, -1.077399 37.722876, -1.077343 37.722678, -1.077249 37.722299, -1.077091 37.721677, -1.077005 37.721359, -1.076998 37.721281)))', 4326),
       superficie_ha = 3.69,
       superficie_fiabilidad = 'medido',
       notas = concat_ws(E'\n', nullif(notas, ''),
         'Superficie del Catastro (3/11/2026): 535/63 + 535/64 (1,66 ha, casa, balsa y pista) y 536/67 (2,02 ha, la de la escritura). La escritura dice 2 ha 13 a 70 ca.')
 where nombre = 'Lobosillo'
   and (superficie_ha is distinct from 3.69 or geom is null);

-- Comprobación
select nombre, superficie_ha, superficie_fiabilidad,
       round((extensions.ST_Area(geom::extensions.geography) / 10000)::numeric, 2) as ha_dibujo
from public.fincas where nombre = 'Lobosillo';

-- Fin de la migración 0012
