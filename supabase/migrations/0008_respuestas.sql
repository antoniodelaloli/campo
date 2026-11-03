-- =====================================================================
-- CAMPO · Migración 0008 · Respuestas al banco de preguntas
--
-- Las respuestas de Juan Carlos al banco de preguntas (docs/deberes/
-- preguntas-campo.md) se guardan aquí directamente desde ChatGPT o Claude
-- (conector), una por pregunta, en cuanto contesta. Ya no hace falta
-- copiar el acta ni mandarla por WhatsApp.
--
-- Una misma pregunta puede tener varias respuestas (si luego la corrige
-- o la completa): vale la más reciente. Nada se borra.
--
-- Mismo modelo de seguridad que el resto: leer = miembro activo,
-- escribir = editor/admin, sin DELETE, con auditoría.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez.
-- =====================================================================

create table if not exists public.respuestas (
  id          uuid primary key default gen_random_uuid(),
  -- código de la pregunta del banco: LOB-01, AGU-03, NUM-02…
  codigo      text not null check (codigo ~ '^[A-Z]{3}-[0-9]{2}$'),
  -- la pregunta tal como se hizo (por si el banco cambia)
  pregunta    text not null check (char_length(pregunta) between 3 and 500),
  -- lo que contestó, completo y con sus palabras
  respuesta   text not null check (char_length(respuesta) between 1 and 8000),
  seguridad   text not null default 'seguro'
                check (seguridad in ('seguro', 'mas_o_menos', 'no_sabe')),
  -- «eso lo sabe Pencho»
  quien_sabe  text check (quien_sabe is null or char_length(quien_sabe) <= 200),
  -- lo que quedó pendiente: una foto, un papel, preguntar a alguien…
  falta       text check (falta is null or char_length(falta) <= 1000),
  estado      text not null default 'nueva'
                check (estado in ('nueva', 'revisada', 'aplicada')),
  origen      text not null default 'conector'
                check (origen in ('app', 'chatgpt', 'conector', 'import', 'manual', 'dron')),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.respuestas is
  'Respuestas al banco de preguntas (una fila por respuesta; vale la más reciente de cada código). No se borran.';

alter table public.respuestas enable row level security;

drop policy if exists respuestas_select on public.respuestas;
create policy respuestas_select on public.respuestas
  for select to authenticated using ((select private.is_member()));
drop policy if exists respuestas_insert on public.respuestas;
create policy respuestas_insert on public.respuestas
  for insert to authenticated with check ((select private.is_writer()));
drop policy if exists respuestas_update on public.respuestas;
create policy respuestas_update on public.respuestas
  for update to authenticated
  using ((select private.is_writer())) with check ((select private.is_writer()));

revoke all on public.respuestas from anon;
revoke delete, truncate on public.respuestas from authenticated;

create or replace trigger trg_respuestas_updated_at before update on public.respuestas
  for each row execute function private.set_updated_at();
create or replace trigger trg_respuestas_audit after insert or update or delete on public.respuestas
  for each row execute function private.audit_row();

create index if not exists respuestas_codigo_idx  on public.respuestas (codigo, created_at desc);
create index if not exists respuestas_created_idx on public.respuestas (created_at desc);

-- Fin de la migración 0008
