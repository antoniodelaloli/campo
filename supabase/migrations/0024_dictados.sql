-- =====================================================================
-- CAMPO · Migración 0024 · Atajo «Cuaderno» (dictar y repartir)
--
-- Juan Carlos dice «Oye Siri, cuaderno» y habla todo lo que quiera.
-- Campo reparte lo dicho con Claude: lo del campo se guarda aquí (tareas,
-- fechas clave, diario, ideas, incidencias) y lo personal se manda a su
-- cuaderno personal, nunca a Campo.
--
-- 1. Todas las tablas con «origen» aceptan también 'atajo'.
-- 2. Tabla «dictados»: lo que dijo tal cual y cómo se repartió. Solo la ve
--    quien lo dictó (puede llevar cosas personales), ni siquiera los admin.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Origen 'atajo' en todas las tablas -------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tabla, c.conname
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public'
      and c.contype = 'c'
      and c.conname like '%\_origen\_check' escape '\'
      and pg_get_constraintdef(c.oid) like '%''conector''%'
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
    execute format(
      'alter table %s add constraint %I check (origen in (''app'', ''chatgpt'', ''conector'', ''atajo'', ''import'', ''manual'', ''dron''))',
      r.tabla, r.conname);
  end loop;
end;
$$;

-- 2. Dictados ----------------------------------------------------------
create table if not exists public.dictados (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  texto       text not null check (char_length(texto) between 1 and 8000),
  -- repartido = Claude lo ha ordenado; sin_repartir = falló la IA, queda tal cual
  estado      text not null default 'repartido' check (estado in ('repartido', 'sin_repartir')),
  -- lo que salió: [{destino, tipo, titulo, guardado_en, ...}]
  reparto     jsonb not null default '[]'::jsonb,
  -- lo que Siri le contestó
  respuesta   text,
  created_at  timestamptz not null default now()
);
comment on table public.dictados is
  'Lo dictado con el atajo «Cuaderno», tal cual, y cómo se repartió. Privado: solo lo ve quien lo dictó.';

alter table public.dictados enable row level security;

drop policy if exists dictados_select on public.dictados;
create policy dictados_select on public.dictados
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.dictados from anon;
revoke insert, update, delete, truncate on public.dictados from authenticated;

create index if not exists dictados_user_idx on public.dictados (user_id, created_at desc);

-- Fin de la migración 0024
