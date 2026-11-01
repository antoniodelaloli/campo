-- =====================================================================
-- CAMPO · Migración 0003 · Hitos del calendario
--
-- Contenido:
--   1. hitos: fechas que hay que tener presentes (cortes, tratamientos,
--      plazos de papeles, agua, revisiones…). No son tareas: una tarea es
--      algo que hacer; un hito es una fecha que no se puede pasar.
--      Lo que sale solo (plazos de seguridad, tareas con fecha) NO se guarda
--      aquí: la app lo calcula al vuelo.
--   2. Mismo modelo de seguridad que la 0001: leer = miembro activo,
--      escribir = editor/admin, sin DELETE, con auditoría y updated_at.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Requiere haber aplicado antes la 0001 y la 0002. Ejecutar una sola vez.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Hitos
-- ---------------------------------------------------------------------
create table public.hitos (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null check (char_length(titulo) between 3 and 200),
  texto             text check (texto is null or char_length(texto) <= 500),
  tipo              text not null default 'otro'
                      check (tipo in ('corte', 'tratamiento', 'plazo', 'agua', 'revision', 'compra', 'otro')),
  finca_id          uuid references public.fincas (id),
  fecha             date not null,
  hora              time,
  fecha_aproximada  boolean not null default false,
  -- días de antelación con que avisar (0 = el mismo día). Para las notificaciones.
  avisar_dias       integer[] not null default '{7,1,0}'
                      check (avisar_dias <@ array[0,1,2,3,7,14,30,60]::integer[]),
  repetir           text not null default 'no' check (repetir in ('no', 'anual')),
  estado            text not null default 'pendiente'
                      check (estado in ('pendiente', 'hecho', 'anulado')),
  hecho_en          timestamptz,
  -- si se creó al completar el del año anterior
  viene_de          uuid references public.hitos (id),
  origen            text not null default 'app'
                      check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.hitos is
  'Fechas a tener presentes (cortes, plazos, tratamientos…). Se cierran con estado = hecho/anulado; nunca se borran.';
comment on column public.hitos.fecha_aproximada is
  'true = fecha orientativa («principios de noviembre»); la app la muestra con ≈.';
comment on column public.hitos.repetir is
  'anual = al marcarlo como hecho, la app crea el del año siguiente (viene_de apunta a este).';


-- ---------------------------------------------------------------------
-- 2. Seguridad, auditoría e índices
-- ---------------------------------------------------------------------
alter table public.hitos enable row level security;

create policy hitos_select on public.hitos
  for select to authenticated using ((select private.is_member()));
create policy hitos_insert on public.hitos
  for insert to authenticated with check ((select private.is_writer()));
create policy hitos_update on public.hitos
  for update to authenticated
  using ((select private.is_writer())) with check ((select private.is_writer()));

revoke all on public.hitos from anon;
revoke delete, truncate on public.hitos from authenticated;

create trigger trg_hitos_updated_at before update on public.hitos
  for each row execute function private.set_updated_at();
create trigger trg_hitos_audit after insert or update or delete on public.hitos
  for each row execute function private.audit_row();

create index hitos_estado_fecha_idx on public.hitos (estado, fecha);
create index hitos_finca_idx        on public.hitos (finca_id);
create index hitos_viene_de_idx     on public.hitos (viene_de);

-- Fin de la migración 0003
