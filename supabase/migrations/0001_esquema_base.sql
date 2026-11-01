-- =====================================================================
-- CAMPO · Migración 0001 · Esquema base
-- Gestión interna de fincas (Valladolises, Corvera, Lobosillo)
--
-- Contenido:
--   1. Extensiones y esquema privado
--   2. Perfiles de usuario (vinculados a auth.users) y funciones de permisos
--   3. Tablas de dominio (fincas, zonas, sectores, agua, riego, tareas,
--      tratamientos, incidencias, diario, adjuntos, auditoría)
--   4. RLS: lectura para miembros, escritura para editores/admin,
--      SIN política de DELETE y con DELETE revocado a "authenticated"
--   5. Auditoría y updated_at automáticos
--   6. Índices
--   7. Función resolver_ubicacion() para textos tipo "finca 4" o "Los Nuevos"
--   8. Bucket privado de adjuntos
--
-- Cómo aplicarlo:
--   - Supabase CLI:  supabase migration new esquema_base  (pegar este contenido)
--                    supabase db push
--   - O bien SQL Editor del panel de Supabase (ejecutar el archivo completo).
--
-- Después de aplicarlo:
--   1. En Authentication > Sign In / Providers: desactivar "Allow new users to sign up".
--   2. Crear los usuarios a mano (Authentication > Users > Add user).
--   3. Activar al primer admin (ver final de seed.sql).
--
-- Notas de diseño:
--   - Zonas agronómicas (apodos: "Los Nuevos", "La Casa"...) y sectores de riego
--     (hidráulicos) son capas independientes, enlazadas muchos a muchos.
--   - Las cifras aproximadas llevan "fiabilidad" (medido / declarado / pendiente).
--   - No se borra nada: se usa estado / anulado / activo.
--   - Cosecha, contratos, analíticas y administración van en la migración 0002.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Extensiones y esquema privado
-- ---------------------------------------------------------------------
create extension if not exists postgis  with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;


-- ---------------------------------------------------------------------
-- 2. Perfiles y funciones de permisos
-- ---------------------------------------------------------------------
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

-- Funciones de permisos (SECURITY DEFINER para poder leer profiles dentro de las políticas)
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

-- updated_at automático
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

-- Al crearse un usuario en auth.users se crea su perfil INACTIVO
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

-- Políticas de profiles
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_member()));

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
-- Sin INSERT (lo hace el trigger) y sin DELETE.


-- ---------------------------------------------------------------------
-- 3. Tablas de dominio
-- ---------------------------------------------------------------------

-- 3.1 Fincas -----------------------------------------------------------
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

-- 3.2 Zonas agronómicas (apodos locales) -------------------------------
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

-- 3.3 Personas (trabajadores, técnicos, proveedores) -------------------
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

-- 3.4 Programadores de riego y sectores hidráulicos --------------------
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

-- Zonas <-> sectores (muchos a muchos, siempre de la misma finca)
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

-- 3.5 Campañas ---------------------------------------------------------
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

-- 3.6 Agua: pantanos, contadores, lecturas, suministros ----------------
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

-- 3.7 Riego ------------------------------------------------------------
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

-- 3.8 Tareas (espejo en Google Calendar "CAMPO") -----------------------
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

-- 3.9 Productos y tratamientos -----------------------------------------
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

-- 3.10 Incidencias (fugas, averías, plagas, piscina...) ----------------
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

-- 3.11 Diario ----------------------------------------------------------
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

-- 3.12 Adjuntos (fotos, PDFs, albaranes) -------------------------------
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

-- 3.13 Auditoría -------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- 4. RLS uniforme: leer = miembro activo · insertar/editar = editor o admin
--    Sin política DELETE y DELETE/TRUNCATE revocado a "authenticated".
-- ---------------------------------------------------------------------
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

-- audit_log: solo lectura para admin; las escrituras las hace el trigger
alter table public.audit_log enable row level security;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using ((select private.is_admin()));

-- Permisos a nivel de tabla
revoke all on all tables in schema public from anon;
revoke delete, truncate on all tables in schema public from authenticated;
revoke insert, update on public.audit_log from authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke delete, truncate on tables from authenticated;

revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on sequences from anon;


-- ---------------------------------------------------------------------
-- 5. Triggers: updated_at y auditoría
-- ---------------------------------------------------------------------
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
  -- updated_at en todas las tablas que tengan esa columna
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

  -- auditoría
  foreach t in array tablas_audit loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
      'trg_' || t || '_audit', t);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Índices
-- ---------------------------------------------------------------------
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

-- Alias y geometrías
create index fincas_alias_gin      on public.fincas using gin (alias);
create index zonas_alias_gin       on public.zonas using gin (alias);
create index sectores_alias_gin    on public.sectores_riego using gin (alias);
create index fincas_geom_gist      on public.fincas using gist (geom);
create index zonas_geom_gist       on public.zonas using gist (geom);
create index sectores_geom_gist    on public.sectores_riego using gist (geom);
create index incidencias_geom_gist on public.incidencias using gist (geom);


-- ---------------------------------------------------------------------
-- 7. resolver_ubicacion(): de texto libre a finca / zona / sector
--    Ej.: select * from resolver_ubicacion('Los Nuevos');
--         select * from resolver_ubicacion('sector 2');   -- puede devolver varias fincas
--    Si devuelve varias filas, quien llama debe desambiguar (nunca adivinar).
-- ---------------------------------------------------------------------
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
  -- fincas por nombre
  select 'finca'::text as tipo, f.id, f.id as finca_id, f.nombre, 'nombre'::text as coincidencia
  from public.fincas f, n
  where extensions.unaccent(lower(f.nombre)) = n.q
  union all
  -- fincas por alias
  select 'finca'::text, f.id, f.id, f.nombre, 'alias'::text
  from public.fincas f, n
  where exists (
    select 1 from unnest(f.alias) a where extensions.unaccent(lower(a)) = n.q
  )
  union all
  -- zonas por nombre
  select 'zona'::text, z.id, z.finca_id, z.nombre, 'nombre'::text
  from public.zonas z, n
  where extensions.unaccent(lower(z.nombre)) = n.q
  union all
  -- zonas por alias
  select 'zona'::text, z.id, z.finca_id, z.nombre, 'alias'::text
  from public.zonas z, n
  where exists (
    select 1 from unnest(z.alias) a where extensions.unaccent(lower(a)) = n.q
  )
  union all
  -- sectores por número ("sector 2", "sector2") o por nombre / alias
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


-- ---------------------------------------------------------------------
-- 8. Bucket privado de adjuntos (solo SELECT e INSERT; sin update ni delete)
-- ---------------------------------------------------------------------
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

-- Fin de la migración 0001
