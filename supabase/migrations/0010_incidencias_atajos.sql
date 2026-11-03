-- =====================================================================
-- CAMPO · Migración 0010 · Incidencias con ubicación (atajo «Incidencia» de Siri)
--
-- Juan Carlos dice «Oye Siri, incidencia» (o pulsa el botón) junto al sitio:
-- el iPhone manda su posición a Campo, que la guarda como incidencia con su
-- punto exacto en el mapa, la finca y la zona puestas solas.
--
-- 1. Incidencias: nuevo tipo «arbol» (árbol a revisar), origen «atajo» y la
--    posición en números (lat, lon y precisión en metros) además de geom.
-- 2. Claves de atajo: cada usuario crea su clave en Campo (/atajos) y la pega
--    en su atajo. Solo se guarda su huella (sha-256), nunca la clave. Se puede
--    anular cuando se quiera.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Incidencias ------------------------------------------------------
alter table public.incidencias drop constraint if exists incidencias_tipo_check;
alter table public.incidencias add constraint incidencias_tipo_check
  check (tipo in ('fuga_riego', 'averia', 'plaga', 'piscina', 'arbol', 'otro'));

alter table public.incidencias drop constraint if exists incidencias_origen_check;
alter table public.incidencias add constraint incidencias_origen_check
  check (origen in ('app', 'chatgpt', 'conector', 'atajo', 'import', 'manual', 'dron'));

alter table public.incidencias add column if not exists lat double precision
  check (lat is null or lat between -90 and 90);
alter table public.incidencias add column if not exists lon double precision
  check (lon is null or lon between -180 and 180);
alter table public.incidencias add column if not exists precision_m numeric(7, 1)
  check (precision_m is null or precision_m >= 0);

comment on column public.incidencias.lat is 'Latitud del sitio exacto (atajo de Siri). Para el mapa y «Cómo llegar».';
comment on column public.incidencias.lon is 'Longitud del sitio exacto (atajo de Siri).';

-- 2. Claves de atajo ---------------------------------------------------
create table if not exists public.claves_atajo (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nombre      text not null default 'iPhone' check (char_length(nombre) between 1 and 60),
  -- huella sha-256 (hex) de la clave; la clave en sí no se guarda
  hash        text not null unique check (hash ~ '^[0-9a-f]{64}$'),
  -- primeros caracteres, para reconocerla en la lista
  prefijo     text not null check (char_length(prefijo) between 4 and 16),
  activa      boolean not null default true,
  ultimo_uso  timestamptz,
  created_at  timestamptz not null default now()
);
comment on table public.claves_atajo is
  'Claves personales para los atajos de Siri (incidencia, ¿dónde estoy?). Solo la huella. No se borran: se anulan.';

alter table public.claves_atajo enable row level security;

drop policy if exists claves_atajo_select on public.claves_atajo;
create policy claves_atajo_select on public.claves_atajo
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists claves_atajo_insert on public.claves_atajo;
create policy claves_atajo_insert on public.claves_atajo
  for insert to authenticated with check (user_id = (select auth.uid()) and (select private.is_member()));
drop policy if exists claves_atajo_update on public.claves_atajo;
create policy claves_atajo_update on public.claves_atajo
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.claves_atajo from anon;
revoke delete, truncate on public.claves_atajo from authenticated;

create index if not exists claves_atajo_user_idx on public.claves_atajo (user_id);

-- Fin de la migración 0010
