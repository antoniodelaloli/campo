-- =====================================================================
-- CAMPO · Migración 0007 · Ideas y reflexiones
--
-- Lo que la familia piensa sobre el campo sin fecha ni obligación:
-- ideas, reflexiones, dudas, planes y cosas aprendidas. Sobre todo llegan
-- por voz desde ChatGPT o Claude (conector), mientras se va por la finca.
-- Sirven de contexto: Claude las repasa para entender mejor las fincas y
-- proponer tareas o fechas clave.
--
-- Mismo modelo de seguridad que el resto: leer = miembro activo,
-- escribir = editor/admin, sin DELETE (se descartan), con auditoría.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez.
-- =====================================================================

create table if not exists public.ideas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (char_length(titulo) between 3 and 200),
  -- lo que dijo, completo (puede ser largo si divaga)
  texto       text not null check (char_length(texto) between 3 and 8000),
  tipo        text not null default 'idea'
                check (tipo in ('idea', 'reflexion', 'duda', 'plan', 'aprendizaje')),
  finca_id    uuid references public.fincas (id),
  zona_id     uuid references public.zonas (id),
  temas       text[] not null default '{}',
  estado      text not null default 'nueva'
                check (estado in ('nueva', 'revisada', 'convertida', 'descartada')),
  nota_revision text check (nota_revision is null or char_length(nota_revision) <= 1000),
  origen      text not null default 'app'
                check (origen in ('app', 'chatgpt', 'conector', 'import', 'manual', 'dron')),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.ideas is
  'Ideas y reflexiones sobre el campo, sin fecha ni obligación. No se borran: estado = descartada.';

alter table public.ideas enable row level security;

drop policy if exists ideas_select on public.ideas;
create policy ideas_select on public.ideas
  for select to authenticated using ((select private.is_member()));
drop policy if exists ideas_insert on public.ideas;
create policy ideas_insert on public.ideas
  for insert to authenticated with check ((select private.is_writer()));
drop policy if exists ideas_update on public.ideas;
create policy ideas_update on public.ideas
  for update to authenticated
  using ((select private.is_writer())) with check ((select private.is_writer()));

revoke all on public.ideas from anon;
revoke delete, truncate on public.ideas from authenticated;

create or replace trigger trg_ideas_updated_at before update on public.ideas
  for each row execute function private.set_updated_at();
create or replace trigger trg_ideas_audit after insert or update or delete on public.ideas
  for each row execute function private.audit_row();

create index if not exists ideas_created_idx on public.ideas (created_at desc);
create index if not exists ideas_temas_idx   on public.ideas using gin (temas);
create index if not exists ideas_finca_idx   on public.ideas (finca_id);

-- Fin de la migración 0007
