-- =====================================================================
-- CAMPO · Versión sencilla · Permisos de las tablas (proyectos nuevos)
--
-- Los proyectos de Supabase creados desde finales de 2026 ya no dan
-- permisos automáticos sobre las tablas a los usuarios conectados
-- («authenticated»). Sin esto la app no puede leer ni el perfil y manda
-- a todo el mundo a «pendiente de activación».
--
-- Aplicar DESPUÉS de esquema.sql. Se puede repetir sin problema.
-- Las filas siguen protegidas por las políticas (RLS) de cada tabla.
-- «anon» (sin iniciar sesión) sigue sin acceso a nada.
-- =====================================================================

-- 1. Lo que antes daba Supabase por defecto (sin anon)
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;

-- 2. Lo que las migraciones quitan a propósito («nada se borra»)
revoke delete, truncate on all tables in schema public from authenticated;
revoke insert, update on public.audit_log from authenticated;
revoke insert, update, delete, truncate on public.suscripciones_push from authenticated;
revoke insert, update, delete, truncate on public.envios_push from authenticated;
revoke insert, update, delete, truncate on public.dictados from authenticated;

-- 3. anon, sin nada
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Comprobación: debe salir true, true, false, false
select
  has_table_privilege('authenticated', 'public.profiles', 'select') as lee_perfiles,
  has_table_privilege('authenticated', 'public.tareas', 'insert')  as apunta_tareas,
  has_table_privilege('authenticated', 'public.tareas', 'delete')  as borra_tareas,
  has_table_privilege('anon', 'public.profiles', 'select')         as anon_lee;
