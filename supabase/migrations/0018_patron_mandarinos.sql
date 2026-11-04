-- =====================================================================
-- CAMPO · Migración 0018 · Pie (patrón) de cada zona y mandarinos de Valladolises
--
-- Juan Carlos a Antonio en la finca (4/11/2026): los mandarinos son de la
-- variedad Nova, pero sobre dos pies distintos, y eso puede dar precios distintos:
--   · los nuevos, recién plantados, los más cerca de la casa: pie Macrophylla;
--   · los que están más al este, más lejos de la casa: pie Cleopatra.
-- Correspondencia con las zonas dibujadas (POR CONFIRMAR con Juan Carlos):
--   «Mandarinos» (junto a la casa) = Macrophylla;
--   «Mandarinos 2» y «Mandarinos viejos» (más al este) = Cleopatra.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.zonas add column if not exists patron text;
comment on column public.zonas.patron is 'Pie o portainjerto (Macrophylla, Cleopatra, Citrange…).';

update public.zonas z
   set especie = 'Mandarino',
       variedad = 'Nova',
       patron = case when z.nombre = 'Mandarinos' then 'Macrophylla' else 'Cleopatra' end,
       notas = concat_ws(E'\n', nullif(z.notas, ''),
         case when z.nombre = 'Mandarinos'
              then 'Nova sobre pie Macrophylla: los nuevos, recién plantados, junto a la casa (Juan Carlos, 4/11/2026).'
              else 'Nova sobre pie Cleopatra: los de más al este, más lejos de la casa (Juan Carlos, 4/11/2026). Zona por confirmar.' end)
  from public.fincas f
 where f.id = z.finca_id and f.nombre = 'Valladolises'
   and z.nombre in ('Mandarinos', 'Mandarinos 2', 'Mandarinos viejos')
   and z.patron is null;

-- Comprobación
select z.nombre, z.especie, z.variedad, z.patron
from public.zonas z join public.fincas f on f.id = z.finca_id
where f.nombre = 'Valladolises' and z.nombre like 'Mandarinos%'
order by z.nombre;

-- Fin de la migración 0018
