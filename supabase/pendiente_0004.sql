-- =====================================================================
-- CAMPO · pendiente_0004.sql · Tareas que cuelgan de una fecha clave
--
-- Junta migrations/0004_tareas_de_fecha_clave.sql y datos_0004.sql.
-- Requisito: tener aplicada la 0003 (ya lo está desde pendiente_0002_0003.sql).
-- Cómo: Supabase → SQL Editor → New query → pegar entero → Run.
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================

begin;

alter table public.tareas
  add column if not exists hito_id uuid references public.hitos (id);

comment on column public.tareas.hito_id is
  'Fecha clave a la que pertenece la tarea (opcional).';

create index if not exists tareas_hito_idx on public.tareas (hito_id);

-- Fin de la migración 0004

update public.tareas t
   set hito_id = h.id
  from public.hitos h, public.fincas f
 where f.nombre = 'Valladolises'
   and t.finca_id = f.id
   and t.titulo = 'Preparar el primer corte'
   and h.titulo = 'Primer corte de Valladolises'
   and t.hito_id is null;

commit;

-- Comprobación: debería salir «Preparar el primer corte → Primer corte de Valladolises».
select t.titulo as tarea, h.titulo as fecha_clave
  from public.tareas t join public.hitos h on h.id = t.hito_id;
