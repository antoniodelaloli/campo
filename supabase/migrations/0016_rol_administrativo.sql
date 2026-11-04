-- =====================================================================
-- CAMPO · Migración 0016 · Usuario «administrativo»
--
-- Nuevo tipo de usuario para la oficina (Maite): lo VE todo, pero solo
-- puede APUNTAR lo de administración:
--   · facturas de venta y de gasto (y subir su foto o PDF),
--   · pagos y compras de agua (pagos_agua, suministros_agua),
--   · los titulares (límite y tope de seguridad).
-- No puede crear ni cambiar tareas, fechas clave, tratamientos, lecturas,
-- incidencias, etc. (eso sigue siendo de admin y editor).
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Nuevo rol --------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles add constraint profiles_rol_check
  check (rol in ('admin', 'editor', 'administrativo', 'lector'));

-- 2. Quién puede apuntar lo de administración --------------------------------
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

-- 3. Permisos de las tablas de administración -----------------------------------
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

-- 4. Archivos de las facturas ---------------------------------------------------
drop policy if exists facturas_archivos_insert on storage.objects;
create policy facturas_archivos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'facturas' and (select private.is_admin_writer()));

-- Comprobación: políticas de escritura de las tablas de administración
select tablename, policyname from pg_policies
where schemaname = 'public' and tablename in ('facturas', 'titulares', 'pagos_agua', 'suministros_agua')
  and policyname like '%\_insert' escape '\'
order by tablename;

-- Fin de la migración 0016
