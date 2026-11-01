-- =====================================================================
-- CAMPO · Migración 0004 · Tareas que cuelgan de una fecha clave
--
-- Una fecha clave (hito) puede tener tareas: «Primer corte» → «analítica
-- de residuos», «avisar al comprador», «preparar cuadrilla»…
-- Solo añade la columna tareas.hito_id (opcional) y su índice.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Requiere la 0003. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.tareas
  add column if not exists hito_id uuid references public.hitos (id);

comment on column public.tareas.hito_id is
  'Fecha clave a la que pertenece la tarea (opcional).';

create index if not exists tareas_hito_idx on public.tareas (hito_id);

-- Fin de la migración 0004
