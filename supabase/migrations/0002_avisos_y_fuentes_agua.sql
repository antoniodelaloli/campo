-- =====================================================================
-- CAMPO · Migración 0002 · Avisos y fuentes de agua
--
-- Contenido:
--   1. avisos: cosas pendientes que hay que tener a la vista
--      (analíticas, expedientes, cifras por conciliar…). No son incidencias
--      del campo (esas siguen en "incidencias") ni tareas.
--   2. fuentes_agua: de dónde viene el agua de cada finca y su precio de referencia.
--   3. Mismo modelo de seguridad que la 0001: leer = miembro activo,
--      escribir = editor/admin, sin DELETE, con auditoría y updated_at.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Requiere haber aplicado antes la 0001. Es seguro ejecutarlo una sola vez.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Avisos
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


-- ---------------------------------------------------------------------
-- 2. Fuentes de agua
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- 3. Seguridad, auditoría e índices
-- ---------------------------------------------------------------------
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

-- Fin de la migración 0002
