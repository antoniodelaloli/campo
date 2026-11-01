-- =====================================================================
-- CAMPO · Migración 0005 · Avisos en el móvil (notificaciones push)
--
-- Contenido:
--   1. suscripciones_push: cada móvil (o navegador) que ha pulsado
--      «Avisarme en este móvil», a nombre de su usuario. No se borran:
--      se desactivan (activa = false) al pulsar «Dejar de avisar» o cuando
--      el móvil ya no acepta avisos.
--   2. envios_push: registro de lo enviado (para no repetir el aviso del
--      día si el aviso diario se ejecuta dos veces, y para ver qué llegó).
--   3. Funciones para guardar/desactivar la suscripción del propio usuario.
--
-- El envío lo hace el servidor de la app (ruta /api/avisos/diario) con la
-- clave secreta de Supabase, que se salta RLS. Los usuarios solo ven y
-- tocan sus propias suscripciones.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Suscripciones
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
-- Altas y bajas solo por las funciones de abajo (comprueban usuario y endpoint).
revoke insert, update, delete, truncate on public.suscripciones_push from authenticated;

create or replace trigger trg_suscripciones_push_updated_at before update on public.suscripciones_push
  for each row execute function private.set_updated_at();

create index if not exists suscripciones_push_user_idx on public.suscripciones_push (user_id) where activa;


-- ---------------------------------------------------------------------
-- 2. Registro de envíos
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- 3. Funciones para el propio usuario
-- ---------------------------------------------------------------------

-- Guarda (o reactiva) la suscripción de este móvil a nombre de quien la pide.
-- Si el mismo móvil estaba a nombre de otra persona (otro usuario entró en
-- ese móvil), pasa a ser de quien la pide ahora.
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

-- Desactiva la suscripción de este móvil (solo si es del propio usuario).
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

-- Fin de la migración 0005
