-- =====================================================================
-- CAMPO · Migración 0006 · Conector para ChatGPT y Claude
--
-- Lo que se apunta desde un asistente (ChatGPT o Claude) a través del
-- conector de Campo queda con origen = 'conector', a nombre de quien
-- inició sesión (created_by = su usuario), igual que desde la app.
--
-- El acceso del asistente lo da el servidor OAuth de Supabase
-- (Authentication → OAuth Server). Los permisos son los del usuario:
-- RLS se aplica igual (lector = solo consultar; editor = apuntar).
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez.
-- =====================================================================

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

-- Fin de la migración 0006
