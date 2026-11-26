-- =====================================================================
-- CAMPO · Versión sencilla · Esquema completo SIN datos
-- Generado con supabase/sencilla/generar.py a partir de supabase/migrations.
-- NO lo edites a mano: cambia la migración y vuelve a generarlo.
--
-- Cómo aplicarlo en un Supabase NUEVO (vacío):
--   SQL Editor → pegar el archivo completo → Run. Solo una vez.
-- Después: supabase/sencilla/LEEME.md (OAuth, primer usuario, datos de la finca).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Migración 0001
-- ---------------------------------------------------------------------
create extension if not exists postgis  with schema extensions;

create extension if not exists unaccent with schema extensions;

create schema if not exists private;

revoke all on schema private from public, anon;

grant usage on schema private to authenticated;

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  nombre      text,
  rol         text not null default 'lector' check (rol in ('admin', 'editor', 'lector')),
  activo      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Un perfil por usuario de auth. Nace inactivo: hasta que un admin lo activa no ve ni escribe nada.';

create or replace function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.activo
  );
$$;

create or replace function private.is_writer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.activo and p.rol in ('admin', 'editor')
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.activo and p.rol = 'admin'
  );
$$;

revoke all on function private.is_member() from public, anon;

revoke all on function private.is_writer() from public, anon;

revoke all on function private.is_admin()  from public, anon;

grant execute on function private.is_member() to authenticated;

grant execute on function private.is_writer() to authenticated;

grant execute on function private.is_admin()  to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nombre)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_member()));

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create table public.fincas (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null unique,
  alias                 text[] not null default '{}',
  regimen               text not null default 'por_confirmar'
                          check (regimen in ('convencional', 'ecologico', 'por_confirmar')),
  superficie_ha         numeric(8, 2),
  superficie_fiabilidad text not null default 'pendiente'
                          check (superficie_fiabilidad in ('medido', 'declarado', 'pendiente')),
  n_arboles_aprox       integer,
  activa                boolean not null default true,
  notas                 text,
  geom                  extensions.geometry(MultiPolygon, 4326),
  created_by            uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column public.fincas.superficie_ha is 'Superficie productiva aproximada; ver superficie_fiabilidad. No es dato catastral.';

create table public.zonas (
  id                    uuid primary key default gen_random_uuid(),
  finca_id              uuid not null references public.fincas (id),
  nombre                text not null,
  alias                 text[] not null default '{}',
  especie               text,
  variedad              text,
  edad_aprox_anios      integer,
  n_arboles             integer,
  superficie_ha         numeric(8, 2),
  referencia_catastral  text,
  recinto_sigpac        text,
  fiabilidad            text not null default 'pendiente'
                          check (fiabilidad in ('medido', 'declarado', 'pendiente')),
  activa                boolean not null default true,
  notas                 text,
  geom                  extensions.geometry(MultiPolygon, 4326),
  created_by            uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (finca_id, nombre),
  unique (id, finca_id)
);

create table public.personas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  tipo        text not null default 'otro'
                check (tipo in ('trabajador', 'tecnico', 'asesor', 'proveedor', 'familia', 'otro')),
  empresa     text,
  telefono    text,
  profile_id  uuid references public.profiles (id) on delete set null,
  activa      boolean not null default true,
  notas       text,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.programadores (
  id          uuid primary key default gen_random_uuid(),
  finca_id    uuid not null references public.fincas (id),
  nombre      text not null,
  marca       text,
  modelo      text,
  tiene_red   boolean not null default false,
  activo      boolean not null default true,
  notas       text,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, finca_id)
);

create table public.sectores_riego (
  id              uuid primary key default gen_random_uuid(),
  finca_id        uuid not null references public.fincas (id),
  numero          integer not null,
  nombre          text,
  alias           text[] not null default '{}',
  programador_id  uuid,
  activo          boolean not null default true,
  notas           text,
  geom            extensions.geometry(MultiPolygon, 4326),
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (finca_id, numero),
  unique (id, finca_id),
  foreign key (programador_id, finca_id) references public.programadores (id, finca_id)
);

create table public.zona_sector (
  zona_id            uuid not null,
  sector_id          uuid not null,
  finca_id           uuid not null,
  porcentaje_aprox   numeric(5, 2) check (porcentaje_aprox is null or (porcentaje_aprox >= 0 and porcentaje_aprox <= 100)),
  notas              text,
  created_at         timestamptz not null default now(),
  primary key (zona_id, sector_id),
  foreign key (zona_id, finca_id)   references public.zonas (id, finca_id),
  foreign key (sector_id, finca_id) references public.sectores_riego (id, finca_id)
);

create table public.campanas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  inicio      date,
  fin         date,
  notas       text,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (fin is null or inicio is null or fin >= inicio)
);

create table public.pantanos (
  id                  uuid primary key default gen_random_uuid(),
  finca_id            uuid not null references public.fincas (id),
  nombre              text not null,
  capacidad_m3        numeric(10, 0),
  capacidad_util_m3   numeric(10, 0),
  fiabilidad          text not null default 'pendiente'
                        check (fiabilidad in ('medido', 'declarado', 'pendiente')),
  activo              boolean not null default true,
  notas               text,
  created_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, finca_id),
  unique (finca_id, nombre)
);

create table public.contadores (
  id            uuid primary key default gen_random_uuid(),
  finca_id      uuid not null references public.fincas (id),
  nombre        text not null,
  tipo          text not null check (tipo in ('entrada', 'salida')),
  origen_agua   text check (origen_agua in ('trasvase', 'pozo', 'desaladora', 'pantano', 'otro')),
  es_digital    boolean,
  es_contraste  boolean not null default false,
  sector_id     uuid,
  numero_serie  text,
  activo        boolean not null default true,
  notas         text,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (finca_id, nombre),
  foreign key (sector_id, finca_id) references public.sectores_riego (id, finca_id)
);

create table public.lecturas_contador (
  id                  uuid primary key default gen_random_uuid(),
  contador_id         uuid not null references public.contadores (id),
  fecha               date not null,
  lectura_m3          numeric(12, 2) not null,
  pendiente_conciliar boolean not null default false,
  anulada             boolean not null default false,
  persona_id          uuid references public.personas (id),
  notas               text,
  origen              text not null default 'app'
                        check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.suministros_agua (
  id                  uuid primary key default gen_random_uuid(),
  finca_id            uuid not null references public.fincas (id),
  fecha               date not null,
  origen_agua         text check (origen_agua in ('trasvase', 'pozo', 'desaladora', 'pantano', 'otro')),
  volumen_m3          numeric(12, 2),
  coste_eur           numeric(12, 2),
  proveedor           text,
  fiabilidad          text not null default 'pendiente'
                        check (fiabilidad in ('medido', 'declarado', 'pendiente')),
  pendiente_conciliar boolean not null default false,
  anulado             boolean not null default false,
  notas               text,
  origen              text not null default 'app'
                        check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.niveles_pantano (
  id          uuid primary key default gen_random_uuid(),
  pantano_id  uuid not null references public.pantanos (id),
  fecha       date not null,
  nivel_m3    numeric(10, 0),
  metodo      text not null default 'a_ojo' check (metodo in ('a_ojo', 'sensor', 'calculado')),
  persona_id  uuid references public.personas (id),
  anulado     boolean not null default false,
  notas       text,
  origen      text not null default 'app'
                check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.registros_riego (
  id            uuid primary key default gen_random_uuid(),
  finca_id      uuid not null references public.fincas (id),
  sector_id     uuid not null,
  inicio        timestamptz not null,
  fin           timestamptz,
  duracion_min  integer,
  volumen_m3    numeric(10, 2),
  estado        text not null default 'realizado' check (estado in ('realizado', 'parcial', 'anulado')),
  persona_id    uuid references public.personas (id),
  notas         text,
  origen        text not null default 'app'
                  check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (fin is null or fin >= inicio),
  foreign key (sector_id, finca_id) references public.sectores_riego (id, finca_id)
);

create table public.cambios_programacion (
  id              uuid primary key default gen_random_uuid(),
  programador_id  uuid not null references public.programadores (id),
  sector_id       uuid references public.sectores_riego (id),
  fecha           date not null default current_date,
  descripcion     text not null,
  valor_anterior  text,
  valor_nuevo     text,
  persona_id      uuid references public.personas (id),
  origen          text not null default 'app'
                    check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.tareas (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,
  descripcion       text,
  tipo              text not null default 'otro'
                      check (tipo in ('riego', 'tratamiento', 'poda', 'revision', 'mantenimiento',
                                      'cosecha', 'administrativa', 'otro')),
  estado            text not null default 'prevista'
                      check (estado in ('prevista', 'en_curso', 'terminada', 'verificada', 'aplazada', 'cancelada')),
  prioridad         text not null default 'normal' check (prioridad in ('baja', 'normal', 'alta')),
  finca_id          uuid references public.fincas (id),
  zona_id           uuid,
  sector_id         uuid,
  ubicacion_texto   text,
  fecha_prevista    date,
  hora_prevista     time,
  duracion_min      integer,
  recurrencia_rrule text,
  google_event_id   text,
  completada_en     timestamptz,
  notas_cierre      text,
  origen            text not null default 'app'
                      check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((zona_id is null and sector_id is null) or finca_id is not null),
  foreign key (zona_id, finca_id)   references public.zonas (id, finca_id),
  foreign key (sector_id, finca_id) references public.sectores_riego (id, finca_id)
);

comment on column public.tareas.ubicacion_texto is
  'Texto libre tal como se dijo ("finca 4", "Los Nuevos"). Se resuelve con resolver_ubicacion().';

create table public.tareas_personas (
  tarea_id    uuid not null references public.tareas (id),
  persona_id  uuid not null references public.personas (id),
  created_at  timestamptz not null default now(),
  primary key (tarea_id, persona_id)
);

create table public.productos (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null unique,
  tipo                  text not null default 'por_confirmar'
                          check (tipo in ('fitosanitario', 'fertilizante', 'herbicida', 'adyuvante',
                                          'desinfectante', 'otro', 'por_confirmar')),
  materias_activas      text[] not null default '{}',
  numero_registro       text,
  plazo_seguridad_dias  integer,
  uso_ecologico         boolean,
  validado              boolean not null default false,
  activo                boolean not null default true,
  notas                 text,
  created_by            uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column public.productos.validado is
  'false = nombre transcrito de un registro; sin confirmar nombre exacto, nº de registro, dosis ni plazo de seguridad.';

comment on column public.productos.uso_ecologico is 'null = desconocido.';

create table public.tratamientos (
  id                  uuid primary key default gen_random_uuid(),
  finca_id            uuid not null references public.fincas (id),
  campana_id          uuid references public.campanas (id),
  fecha               date not null,
  fecha_aproximada    boolean not null default false,
  estado              text not null default 'prevista'
                        check (estado in ('prevista', 'en_curso', 'realizada', 'anulada')),
  objetivo            text,
  n_cubas             integer,
  litros_cuba         numeric(8, 0),
  aplicador_id        uuid references public.personas (id),
  maquina             text,
  condiciones         text,
  notas               text,
  origen              text not null default 'app'
                        check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, finca_id)
);

comment on table public.tratamientos is
  'Registro de lo aplicado. No son recomendaciones. El cuaderno oficial (CUE digital desde 1/1/2027) se exporta/conecta, no se reemplaza.';

create table public.tratamiento_zonas (
  tratamiento_id  uuid not null,
  zona_id         uuid not null,
  finca_id        uuid not null,
  created_at      timestamptz not null default now(),
  primary key (tratamiento_id, zona_id),
  foreign key (tratamiento_id, finca_id) references public.tratamientos (id, finca_id),
  foreign key (zona_id, finca_id)        references public.zonas (id, finca_id)
);

create table public.tratamiento_productos (
  id              uuid primary key default gen_random_uuid(),
  tratamiento_id  uuid not null references public.tratamientos (id),
  producto_id     uuid not null references public.productos (id),
  dosis_por_cuba  numeric(10, 3),
  dosis_por_ha    numeric(10, 3),
  dosis_total     numeric(10, 3),
  unidad          text check (unidad in ('L', 'kg', 'cc', 'g', 'mL')),
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.incidencias (
  id            uuid primary key default gen_random_uuid(),
  finca_id      uuid not null references public.fincas (id),
  zona_id       uuid,
  sector_id     uuid,
  tipo          text not null default 'otro'
                  check (tipo in ('fuga_riego', 'averia', 'plaga', 'piscina', 'otro')),
  titulo        text not null,
  descripcion   text,
  severidad     text not null default 'media' check (severidad in ('baja', 'media', 'alta')),
  estado        text not null default 'abierta'
                  check (estado in ('abierta', 'en_curso', 'resuelta', 'descartada')),
  fecha         date not null default current_date,
  resuelta_en   timestamptz,
  persona_id    uuid references public.personas (id),
  geom          extensions.geometry(Point, 4326),
  origen        text not null default 'app'
                  check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (zona_id, finca_id)   references public.zonas (id, finca_id),
  foreign key (sector_id, finca_id) references public.sectores_riego (id, finca_id)
);

create table public.diario (
  id          uuid primary key default gen_random_uuid(),
  finca_id    uuid references public.fincas (id),
  fecha       date not null default current_date,
  texto       text not null,
  persona_id  uuid references public.personas (id),
  origen      text not null default 'app'
                check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.adjuntos (
  id            uuid primary key default gen_random_uuid(),
  entidad       text not null
                  check (entidad in ('finca', 'zona', 'sector', 'tarea', 'tratamiento', 'incidencia',
                                     'diario', 'lectura_contador', 'suministro_agua', 'otro')),
  entidad_id    uuid,
  storage_path  text not null,
  nombre        text,
  mime_type     text,
  tamano_bytes  bigint,
  notas         text,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.adjuntos.storage_path is 'Ruta dentro del bucket privado campo-adjuntos.';

create table public.audit_log (
  id            bigint generated always as identity primary key,
  tabla         text not null,
  registro_id   text,
  accion        text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id    uuid,
  antes         jsonb,
  despues       jsonb,
  created_at    timestamptz not null default now()
);

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_log (tabla, registro_id, accion, usuario_id, antes, despues)
    values (tg_table_name, to_jsonb(new) ->> 'id', tg_op, auth.uid(), null, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_log (tabla, registro_id, accion, usuario_id, antes, despues)
    values (tg_table_name, to_jsonb(new) ->> 'id', tg_op, auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_log (tabla, registro_id, accion, usuario_id, antes, despues)
    values (tg_table_name, to_jsonb(old) ->> 'id', tg_op, auth.uid(), to_jsonb(old), null);
    return old;
  end if;
end;
$$;

revoke all on function private.audit_row()       from public, anon, authenticated;

revoke all on function private.handle_new_user() from public, anon, authenticated;

revoke all on function private.set_updated_at()  from public, anon, authenticated;

do $$
declare
  t text;
  tablas text[] := array[
    'fincas', 'zonas', 'personas', 'programadores', 'sectores_riego', 'zona_sector',
    'campanas', 'pantanos', 'contadores', 'lecturas_contador', 'suministros_agua',
    'niveles_pantano', 'registros_riego', 'cambios_programacion', 'tareas',
    'tareas_personas', 'productos', 'tratamientos', 'tratamiento_zonas',
    'tratamiento_productos', 'incidencias', 'diario', 'adjuntos'
  ];
begin
  foreach t in array tablas loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_member()))',
      t || '_select', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_writer()))',
      t || '_insert', t);

    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_writer())) with check ((select private.is_writer()))',
      t || '_update', t);
  end loop;
end;
$$;

alter table public.audit_log enable row level security;

create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using ((select private.is_admin()));

revoke all on all tables in schema public from anon;

revoke delete, truncate on all tables in schema public from authenticated;

revoke insert, update on public.audit_log from authenticated;

alter default privileges in schema public revoke all on tables from anon;

alter default privileges in schema public revoke delete, truncate on tables from authenticated;

revoke all on all sequences in schema public from anon;

alter default privileges in schema public revoke all on sequences from anon;

do $$
declare
  r record;
  t text;
  tablas_audit text[] := array[
    'profiles', 'fincas', 'zonas', 'personas', 'programadores', 'sectores_riego', 'zona_sector',
    'campanas', 'pantanos', 'contadores', 'lecturas_contador', 'suministros_agua',
    'niveles_pantano', 'registros_riego', 'cambios_programacion', 'tareas',
    'tareas_personas', 'productos', 'tratamientos', 'tratamiento_zonas',
    'tratamiento_productos', 'incidencias', 'diario', 'adjuntos'
  ];
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      'trg_' || r.table_name || '_updated_at', r.table_name);
  end loop;

  foreach t in array tablas_audit loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
      'trg_' || t || '_audit', t);
  end loop;
end;
$$;

create index zonas_finca_idx             on public.zonas (finca_id);

create index programadores_finca_idx     on public.programadores (finca_id);

create index sectores_finca_idx          on public.sectores_riego (finca_id);

create index zona_sector_sector_idx      on public.zona_sector (sector_id);

create index pantanos_finca_idx          on public.pantanos (finca_id);

create index contadores_finca_idx        on public.contadores (finca_id);

create index lecturas_contador_idx       on public.lecturas_contador (contador_id, fecha desc);

create index suministros_finca_fecha_idx on public.suministros_agua (finca_id, fecha desc);

create index niveles_pantano_idx         on public.niveles_pantano (pantano_id, fecha desc);

create index registros_riego_sector_idx  on public.registros_riego (sector_id, inicio desc);

create index registros_riego_finca_idx   on public.registros_riego (finca_id, inicio desc);

create index cambios_prog_idx            on public.cambios_programacion (programador_id, fecha desc);

create index tareas_fecha_estado_idx     on public.tareas (fecha_prevista, estado);

create index tareas_finca_idx            on public.tareas (finca_id);

create index tratamientos_finca_idx      on public.tratamientos (finca_id, fecha desc);

create index tratamiento_prod_trat_idx   on public.tratamiento_productos (tratamiento_id);

create index incidencias_estado_idx      on public.incidencias (estado, fecha desc);

create index incidencias_finca_idx       on public.incidencias (finca_id);

create index diario_finca_fecha_idx      on public.diario (finca_id, fecha desc);

create index adjuntos_entidad_idx        on public.adjuntos (entidad, entidad_id);

create index audit_log_tabla_idx         on public.audit_log (tabla, registro_id, created_at desc);

create index fincas_alias_gin      on public.fincas using gin (alias);

create index zonas_alias_gin       on public.zonas using gin (alias);

create index sectores_alias_gin    on public.sectores_riego using gin (alias);

create index fincas_geom_gist      on public.fincas using gist (geom);

create index zonas_geom_gist       on public.zonas using gist (geom);

create index sectores_geom_gist    on public.sectores_riego using gist (geom);

create index incidencias_geom_gist on public.incidencias using gist (geom);

create or replace function public.resolver_ubicacion(q text)
returns table (tipo text, id uuid, finca_id uuid, nombre text, coincidencia text)
language sql
stable
security invoker
set search_path = ''
as $$
  with n as (
    select extensions.unaccent(lower(btrim(q))) as q
  )
  select distinct on (u.tipo, u.id) u.tipo, u.id, u.finca_id, u.nombre, u.coincidencia
  from (
  select 'finca'::text as tipo, f.id, f.id as finca_id, f.nombre, 'nombre'::text as coincidencia
  from public.fincas f, n
  where extensions.unaccent(lower(f.nombre)) = n.q
  union all
  select 'finca'::text, f.id, f.id, f.nombre, 'alias'::text
  from public.fincas f, n
  where exists (
    select 1 from unnest(f.alias) a where extensions.unaccent(lower(a)) = n.q
  )
  union all
  select 'zona'::text, z.id, z.finca_id, z.nombre, 'nombre'::text
  from public.zonas z, n
  where extensions.unaccent(lower(z.nombre)) = n.q
  union all
  select 'zona'::text, z.id, z.finca_id, z.nombre, 'alias'::text
  from public.zonas z, n
  where exists (
    select 1 from unnest(z.alias) a where extensions.unaccent(lower(a)) = n.q
  )
  union all
  select 'sector'::text, s.id, s.finca_id, coalesce(s.nombre, 'Sector ' || s.numero), 'numero'::text
  from public.sectores_riego s, n
  where s.numero::text = substring(n.q from '^sector\s*(\d+)$')
  union all
  select 'sector'::text, s.id, s.finca_id, coalesce(s.nombre, 'Sector ' || s.numero), 'nombre'::text
  from public.sectores_riego s, n
  where s.nombre is not null and extensions.unaccent(lower(s.nombre)) = n.q
  union all
  select 'sector'::text, s.id, s.finca_id, coalesce(s.nombre, 'Sector ' || s.numero), 'alias'::text
  from public.sectores_riego s, n
  where exists (
    select 1 from unnest(s.alias) a where extensions.unaccent(lower(a)) = n.q
  )
  ) u
  order by u.tipo, u.id, u.coincidencia;
$$;

revoke all on function public.resolver_ubicacion(text) from public, anon;

grant execute on function public.resolver_ubicacion(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campo-adjuntos',
  'campo-adjuntos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

create policy campo_adjuntos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'campo-adjuntos' and (select private.is_member()));

create policy campo_adjuntos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'campo-adjuntos' and (select private.is_writer()));

-- ---------------------------------------------------------------------
-- Migración 0002
-- ---------------------------------------------------------------------
create table public.avisos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  texto         text,
  nivel         text not null default 'atencion'
                  check (nivel in ('urgente', 'atencion', 'info')),
  categoria     text not null default 'otro'
                  check (categoria in ('agua', 'riego', 'tratamientos', 'cosecha', 'administracion', 'otro')),
  finca_id      uuid references public.fincas (id),
  estado        text not null default 'abierto'
                  check (estado in ('abierto', 'resuelto', 'descartado')),
  fecha         date not null default current_date,
  resuelto_en   timestamptz,
  notas_cierre  text,
  origen        text not null default 'app'
                  check (origen in ('app', 'chatgpt', 'import', 'manual', 'dron')),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.avisos is
  'Pendientes que hay que tener a la vista (no son tareas ni incidencias). Se cierran con estado = resuelto/descartado; nunca se borran.';

create table public.fuentes_agua (
  id                  uuid primary key default gen_random_uuid(),
  finca_id            uuid not null references public.fincas (id),
  origen_agua         text not null
                        check (origen_agua in ('trasvase', 'pozo', 'desaladora', 'pantano', 'otro')),
  proveedor           text,
  precio_ref_eur_m3   numeric(8, 3),
  anio_ref            integer,
  fiabilidad          text not null default 'declarado'
                        check (fiabilidad in ('medido', 'declarado', 'pendiente')),
  activa              boolean not null default true,
  notas               text,
  created_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (finca_id, origen_agua, proveedor)
);

comment on column public.fuentes_agua.precio_ref_eur_m3 is
  'Precio de referencia (no de factura). Las facturas reales van en suministros_agua.';

do $$
declare
  t text;
begin
  foreach t in array array['avisos', 'fuentes_agua'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_member()))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_writer()))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_writer())) with check ((select private.is_writer()))',
      t || '_update', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('revoke delete, truncate on public.%I from authenticated', t);

    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      'trg_' || t || '_updated_at', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
      'trg_' || t || '_audit', t);
  end loop;
end;
$$;

create index avisos_estado_idx       on public.avisos (estado, fecha desc);

create index avisos_categoria_idx    on public.avisos (categoria, estado);

create index avisos_finca_idx        on public.avisos (finca_id);

create index fuentes_agua_finca_idx  on public.fuentes_agua (finca_id);

-- ---------------------------------------------------------------------
-- Migración 0003
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
  avisar_dias       integer[] not null default '{7,1,0}'
                      check (avisar_dias <@ array[0,1,2,3,7,14,30,60]::integer[]),
  repetir           text not null default 'no' check (repetir in ('no', 'anual')),
  estado            text not null default 'pendiente'
                      check (estado in ('pendiente', 'hecho', 'anulado')),
  hecho_en          timestamptz,
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

-- ---------------------------------------------------------------------
-- Migración 0004
-- ---------------------------------------------------------------------
alter table public.tareas
  add column if not exists hito_id uuid references public.hitos (id);

comment on column public.tareas.hito_id is
  'Fecha clave a la que pertenece la tarea (opcional).';

create index if not exists tareas_hito_idx on public.tareas (hito_id);

-- ---------------------------------------------------------------------
-- Migración 0005
-- ---------------------------------------------------------------------
create table if not exists public.suscripciones_push (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint     text not null unique check (char_length(endpoint) between 10 and 1000),
  p256dh       text not null check (char_length(p256dh) between 10 and 200),
  auth         text not null check (char_length(auth) between 8 and 100),
  dispositivo  text check (dispositivo is null or char_length(dispositivo) <= 120),
  activa       boolean not null default true,
  fallos       integer not null default 0,
  ultimo_envio timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.suscripciones_push is
  'Móviles/navegadores que reciben avisos de Campo. No se borran: activa = false.';

alter table public.suscripciones_push enable row level security;

drop policy if exists suscripciones_push_select on public.suscripciones_push;

create policy suscripciones_push_select on public.suscripciones_push
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_member()));

revoke all on public.suscripciones_push from anon;

revoke insert, update, delete, truncate on public.suscripciones_push from authenticated;

create or replace trigger trg_suscripciones_push_updated_at before update on public.suscripciones_push
  for each row execute function private.set_updated_at();

create index if not exists suscripciones_push_user_idx on public.suscripciones_push (user_id) where activa;

create table if not exists public.envios_push (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  fecha       date not null,
  tipo        text not null check (tipo in ('diario', 'semanal', 'prueba')),
  titulo      text not null,
  cuerpo      text not null,
  enviados    integer not null default 0,
  fallidos    integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.envios_push is
  'Avisos enviados. Un aviso diario/semanal por persona y día como máximo.';

create unique index if not exists envios_push_un_dia_idx
  on public.envios_push (user_id, fecha, tipo) where tipo <> 'prueba';

create index if not exists envios_push_fecha_idx on public.envios_push (fecha desc);

alter table public.envios_push enable row level security;

drop policy if exists envios_push_select on public.envios_push;

create policy envios_push_select on public.envios_push
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

revoke all on public.envios_push from anon;

revoke insert, update, delete, truncate on public.envios_push from authenticated;

create or replace function public.guardar_suscripcion_push(
  p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_member() then
    raise exception 'Sin permiso para recibir avisos';
  end if;
  if p_endpoint !~ '^https://' then
    raise exception 'Dirección de avisos no válida';
  end if;

  insert into public.suscripciones_push (user_id, endpoint, p256dh, auth, dispositivo, activa, fallos)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_dispositivo, 120), true, 0)
  on conflict (endpoint) do update
    set user_id     = excluded.user_id,
        p256dh      = excluded.p256dh,
        auth        = excluded.auth,
        dispositivo = coalesce(excluded.dispositivo, public.suscripciones_push.dispositivo),
        activa      = true,
        fallos      = 0;
end;
$$;

create or replace function public.desactivar_suscripcion_push(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.suscripciones_push
     set activa = false
   where endpoint = p_endpoint
     and user_id = auth.uid();
end;
$$;

revoke all on function public.guardar_suscripcion_push(text, text, text, text) from public, anon;

revoke all on function public.desactivar_suscripcion_push(text) from public, anon;

grant execute on function public.guardar_suscripcion_push(text, text, text, text) to authenticated;

grant execute on function public.desactivar_suscripcion_push(text) to authenticated;

-- ---------------------------------------------------------------------
-- Migración 0006
-- ---------------------------------------------------------------------
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
      and pg_get_constraintdef(c.oid) like '%''chatgpt''%'
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
    execute format(
      'alter table %s add constraint %I check (origen in (''app'', ''chatgpt'', ''conector'', ''import'', ''manual'', ''dron''))',
      r.tabla, r.conname);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Migración 0007
-- ---------------------------------------------------------------------
create table if not exists public.ideas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (char_length(titulo) between 3 and 200),
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

-- ---------------------------------------------------------------------
-- Migración 0008
-- ---------------------------------------------------------------------
create table if not exists public.respuestas (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null check (codigo ~ '^[A-Z]{3}-[0-9]{2}$'),
  pregunta    text not null check (char_length(pregunta) between 3 and 500),
  respuesta   text not null check (char_length(respuesta) between 1 and 8000),
  seguridad   text not null default 'seguro'
                check (seguridad in ('seguro', 'mas_o_menos', 'no_sabe')),
  quien_sabe  text check (quien_sabe is null or char_length(quien_sabe) <= 200),
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

-- ---------------------------------------------------------------------
-- Migración 0010
-- ---------------------------------------------------------------------
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

create table if not exists public.claves_atajo (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nombre      text not null default 'iPhone' check (char_length(nombre) between 1 and 60),
  hash        text not null unique check (hash ~ '^[0-9a-f]{64}$'),
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

-- ---------------------------------------------------------------------
-- Migración 0011
-- ---------------------------------------------------------------------
alter table public.zonas  add column if not exists arboles_nota text
  check (arboles_nota is null or char_length(arboles_nota) <= 300);

alter table public.fincas add column if not exists arboles_nota text
  check (arboles_nota is null or char_length(arboles_nota) <= 300);

comment on column public.zonas.arboles_nota  is 'De dónde sale n_arboles y si puede estar desfasado (la app pone un asterisco).';

comment on column public.fincas.arboles_nota is 'De dónde sale n_arboles_aprox y si puede estar desfasado (la app pone un asterisco).';

-- ---------------------------------------------------------------------
-- Migración 0013
-- ---------------------------------------------------------------------
alter table public.suministros_agua add column if not exists talon text;

alter table public.suministros_agua add column if not exists arqueta text;

alter table public.suministros_agua add column if not exists precio_eur_m3 numeric(8, 3);

comment on column public.suministros_agua.talon is 'Nº de talón de riego de la Comunidad de Regantes (se repite cada año: va con la fecha).';

comment on column public.suministros_agua.arqueta is 'Arqueta o toma por la que entra el agua (p. ej. 22.32.1).';

create unique index if not exists suministros_talon_uidx
  on public.suministros_agua (finca_id, proveedor, talon, fecha)
  where talon is not null;

create table if not exists public.pagos_agua (
  id          uuid primary key default gen_random_uuid(),
  finca_id    uuid not null references public.fincas (id),
  fecha       date not null,
  importe_eur numeric(12, 2) not null check (importe_eur > 0),
  proveedor   text,
  concepto    text not null default 'Ingreso para riego',
  anulado     boolean not null default false,
  notas       text,
  origen      text not null default 'app'
                check (origen in ('app', 'chatgpt', 'conector', 'import', 'manual', 'dron')),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (finca_id, proveedor, fecha, importe_eur)
);

comment on table public.pagos_agua is
  'Dinero ingresado en la cuenta de la Comunidad de Regantes para pagar riegos. No se borra: se anula.';

alter table public.pagos_agua enable row level security;

drop policy if exists pagos_agua_select on public.pagos_agua;

create policy pagos_agua_select on public.pagos_agua
  for select to authenticated using ((select private.is_member()));

drop policy if exists pagos_agua_insert on public.pagos_agua;

create policy pagos_agua_insert on public.pagos_agua
  for insert to authenticated with check ((select private.is_writer()));

drop policy if exists pagos_agua_update on public.pagos_agua;

create policy pagos_agua_update on public.pagos_agua
  for update to authenticated using ((select private.is_writer())) with check ((select private.is_writer()));

revoke all on public.pagos_agua from anon;

revoke delete, truncate on public.pagos_agua from authenticated;

drop trigger if exists trg_pagos_agua_updated_at on public.pagos_agua;

create trigger trg_pagos_agua_updated_at before update on public.pagos_agua
  for each row execute function private.set_updated_at();

drop trigger if exists trg_pagos_agua_audit on public.pagos_agua;

create trigger trg_pagos_agua_audit after insert or update or delete on public.pagos_agua
  for each row execute function private.audit_row();

create index if not exists pagos_agua_finca_fecha_idx on public.pagos_agua (finca_id, fecha desc);

-- ---------------------------------------------------------------------
-- Migración 0014
-- ---------------------------------------------------------------------
create table if not exists public.titulares (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null unique,
  nombre_completo     text,
  tipo                text not null default 'persona' check (tipo in ('persona', 'sociedad')),
  limite_eur          numeric(12, 2) not null default 250000,
  tope_seguridad_eur  numeric(12, 2) not null default 240000,
  aviso_pct           numeric(5, 2) not null default 80 check (aviso_pct between 1 and 100),
  activo              boolean not null default true,
  notas               text,
  created_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.titulares is
  'Quien factura las ventas. Límite de ventas al año (módulos), tope de seguridad y % de aviso.';

create table if not exists public.facturas (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null default 'venta' check (tipo in ('venta', 'gasto')),
  estado        text not null default 'emitida' check (estado in ('emitida', 'prevista')),
  titular_id    uuid not null references public.titulares (id),
  finca_id      uuid references public.fincas (id),
  campana       text check (campana is null or campana ~ '^\d{4}/\d{2}$'),
  fecha         date not null,
  numero        text,
  contraparte   text,
  concepto      text,
  kg            numeric(12, 2) check (kg is null or kg >= 0),
  base_eur      numeric(12, 2) not null check (base_eur >= 0),
  impuesto_eur  numeric(12, 2) not null default 0 check (impuesto_eur >= 0),
  total_eur     numeric(12, 2) generated always as (base_eur + impuesto_eur) stored,
  cuenta_limite boolean not null default true,
  archivo_url   text,
  anulado       boolean not null default false,
  notas         text,
  origen        text not null default 'app'
                  check (origen in ('app', 'chatgpt', 'conector', 'import', 'manual', 'dron')),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.facturas is
  'Facturas de venta y de gasto. El límite de cada titular se calcula con base_eur de las ventas del año natural. No se borran: se anulan.';

comment on column public.facturas.base_eur is 'Importe sin IVA ni compensación agraria: es lo que cuenta para el límite.';

do $$
declare
  t text;
begin
  foreach t in array array['titulares', 'facturas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_member()))',
      t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_writer()))',
      t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_writer())) with check ((select private.is_writer()))',
      t || '_update', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke delete, truncate on public.%I from authenticated', t);

    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      'trg_' || t || '_updated_at', t);
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
      'trg_' || t || '_audit', t);
  end loop;
end;
$$;

create index if not exists facturas_titular_fecha_idx on public.facturas (titular_id, fecha desc);

create index if not exists facturas_finca_campana_idx on public.facturas (finca_id, campana);

-- ---------------------------------------------------------------------
-- Migración 0015
-- ---------------------------------------------------------------------
alter table public.facturas add column if not exists categoria text;

alter table public.facturas drop constraint if exists facturas_categoria_check;

alter table public.facturas add constraint facturas_categoria_check check (
  categoria is null or categoria in (
    'agua', 'abonos', 'productos', 'mano_obra', 'luz', 'gasoil',
    'maquinaria', 'alquiler', 'seguros', 'gestoria', 'otros'
  )
);

comment on column public.facturas.categoria is 'Tipo de gasto (solo en facturas de gasto).';

comment on column public.facturas.archivo_url is
  'Ruta del archivo en el cajón «facturas» de Supabase Storage (foto o PDF de la factura).';

create index if not exists facturas_tipo_fecha_idx on public.facturas (tipo, fecha desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'facturas', 'facturas', false, 15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists facturas_archivos_select on storage.objects;

create policy facturas_archivos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'facturas' and (select private.is_member()));

drop policy if exists facturas_archivos_insert on storage.objects;

create policy facturas_archivos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'facturas' and (select private.is_writer()));

-- ---------------------------------------------------------------------
-- Migración 0016
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_rol_check;

alter table public.profiles add constraint profiles_rol_check
  check (rol in ('admin', 'editor', 'administrativo', 'lector'));

create or replace function private.is_admin_writer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.activo and p.rol in ('admin', 'editor', 'administrativo')
  );
$$;

revoke all on function private.is_admin_writer() from public, anon;

grant execute on function private.is_admin_writer() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['facturas', 'titulares', 'pagos_agua', 'suministros_agua'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_admin_writer()))',
      t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_admin_writer())) with check ((select private.is_admin_writer()))',
      t || '_update', t);
  end loop;
end;
$$;

drop policy if exists facturas_archivos_insert on storage.objects;

create policy facturas_archivos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'facturas' and (select private.is_admin_writer()));

-- ---------------------------------------------------------------------
-- Migración 0018
-- ---------------------------------------------------------------------
alter table public.zonas add column if not exists patron text;

comment on column public.zonas.patron is 'Pie o portainjerto (Macrophylla, Cleopatra, Citrange…).';

-- ---------------------------------------------------------------------
-- Migración 0020
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private.is_admin_writer()') is null then
    raise exception 'Falta la migración 0016 (rol administrativo): ejecútala antes que esta.';
  end if;
end;
$$;

create table if not exists public.albaranes (
  id              uuid primary key default gen_random_uuid(),
  campana         text not null check (campana ~ '^\d{4}/\d{2}$'),
  finca_id        uuid references public.fincas (id) on delete set null,
  corte           smallint check (corte between 1 and 9),
  titular_id      uuid references public.titulares (id) on delete set null,
  hoja            text check (hoja is null or char_length(hoja) <= 300),
  albaran         text not null check (char_length(albaran) <= 40),
  fecha           date not null,
  cajas           integer check (cajas is null or cajas >= 0),
  bruto_kg        numeric(10,2),
  tara_camion_kg  numeric(10,2),
  tara_cajas_kg   numeric(10,2),
  kg_buenos       numeric(10,2) not null default 0 check (kg_buenos >= 0),
  kg_citrica      numeric(10,2) not null default 0 check (kg_citrica >= 0),
  importe_eur     numeric(12,2),
  notas           text check (notas is null or char_length(notas) <= 500),
  origen          text not null default 'app',
  anulado         boolean not null default false,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.albaranes is 'Albaranes de báscula de cada corte (una fila por camión), copiados de las hojas de Excel.';

comment on column public.albaranes.hoja is 'Título de la hoja de Excel de la que sale (para agrupar y para no meterla dos veces).';

comment on column public.albaranes.importe_eur is 'Importe que pone la hoja: kilos buenos × precio, sin el 12 % de compensación.';

create index if not exists albaranes_campana_idx on public.albaranes (campana, finca_id) where not anulado;

do $$
begin
  execute 'alter table public.albaranes enable row level security';
  execute 'drop policy if exists albaranes_select on public.albaranes';
  execute 'create policy albaranes_select on public.albaranes for select to authenticated using ((select private.is_member()))';
  execute 'drop policy if exists albaranes_insert on public.albaranes';
  execute 'create policy albaranes_insert on public.albaranes for insert to authenticated with check ((select private.is_admin_writer()))';
  execute 'drop policy if exists albaranes_update on public.albaranes';
  execute 'create policy albaranes_update on public.albaranes for update to authenticated using ((select private.is_admin_writer())) with check ((select private.is_admin_writer()))';
  execute 'drop trigger if exists trg_albaranes_updated_at on public.albaranes';
  execute 'create trigger trg_albaranes_updated_at before update on public.albaranes for each row execute function private.set_updated_at()';
  execute 'drop trigger if exists trg_albaranes_audit on public.albaranes';
  execute 'create trigger trg_albaranes_audit after insert or update or delete on public.albaranes for each row execute function private.audit_row()';
end;
$$;

-- ---------------------------------------------------------------------
-- Migración 0021
-- ---------------------------------------------------------------------
create table if not exists public.titular_socios (
  sociedad_id   uuid not null references public.titulares (id) on delete cascade,
  socio_id      uuid not null references public.titulares (id) on delete cascade,
  participacion numeric(6,5) not null check (participacion > 0 and participacion <= 1),
  created_at    timestamptz not null default now(),
  primary key (sociedad_id, socio_id),
  check (sociedad_id <> socio_id)
);

comment on table public.titular_socios is 'Quién es socio de cada sociedad titular y con qué parte (1/3 = 0,33333).';

do $$
begin
  execute 'alter table public.titular_socios enable row level security';
  execute 'drop policy if exists titular_socios_select on public.titular_socios';
  execute 'create policy titular_socios_select on public.titular_socios for select to authenticated using ((select private.is_member()))';
  execute 'drop policy if exists titular_socios_insert on public.titular_socios';
  execute 'create policy titular_socios_insert on public.titular_socios for insert to authenticated with check ((select private.is_admin_writer()))';
  execute 'drop policy if exists titular_socios_update on public.titular_socios';
  execute 'create policy titular_socios_update on public.titular_socios for update to authenticated using ((select private.is_admin_writer())) with check ((select private.is_admin_writer()))';
end;
$$;

-- ---------------------------------------------------------------------
-- Migración 0022
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists estilo text not null default 'granja';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_estilo_check') then
    alter table public.profiles add constraint profiles_estilo_check check (estilo in ('granja', 'sobrio'));
  end if;
end;
$$;

create or replace function public.cambiar_mi_estilo(nuevo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nuevo not in ('granja', 'sobrio') then
    raise exception 'Estilo no válido: %', nuevo;
  end if;
  update public.profiles set estilo = nuevo where id = (select auth.uid());
end;
$$;

revoke all on function public.cambiar_mi_estilo(text) from public, anon;

grant execute on function public.cambiar_mi_estilo(text) to authenticated;

-- ---------------------------------------------------------------------
-- Migración 0023
-- ---------------------------------------------------------------------
alter table public.titulares
  add column if not exists en_modulos boolean not null default true;

alter table public.titulares
  add column if not exists factura boolean not null default true;

comment on column public.titulares.en_modulos is
  'true = tiene límite de módulos (250.000 €/año). false = no va por módulos (por ejemplo, una comunidad de bienes y sus comuneros).';

comment on column public.titulares.factura is
  'true = factura a su nombre (sale en «Se factura a»). false = solo es socio o comunero.';

-- ---------------------------------------------------------------------
-- Migración 0024
-- ---------------------------------------------------------------------
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

create table if not exists public.dictados (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  texto       text not null check (char_length(texto) between 1 and 8000),
  estado      text not null default 'repartido' check (estado in ('repartido', 'sin_repartir')),
  reparto     jsonb not null default '[]'::jsonb,
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

-- ---------------------------------------------------------------------
-- Migración 0025
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'titulares' and column_name = 'factura') then
    raise exception 'Falta la migración 0023: ejecútala antes que esta.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Migración 0027
-- ---------------------------------------------------------------------
alter table public.albaranes add column if not exists foto_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'albaranes_foto_url_check') then
    alter table public.albaranes
      add constraint albaranes_foto_url_check
      check (foto_url is null or (foto_url ~ '^https://' and char_length(foto_url) <= 500));
  end if;
end;
$$;

comment on column public.albaranes.foto_url is 'Enlace (Drive) a la foto del albarán de báscula.';
