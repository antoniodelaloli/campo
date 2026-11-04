-- =====================================================================
-- CAMPO · Migración 0015 · Facturas de gasto y archivo de cada factura
--
-- 1. Facturas de gasto: nueva columna «categoria» (agua, abonos, productos,
--    mano de obra, luz, gasoil, maquinaria, alquiler, seguros, otros).
--    Los gastos no cuentan para el límite de ventas.
-- 2. Archivo de la factura (foto o PDF): se guarda en Supabase Storage, en un
--    cajón privado «facturas». Solo lo ven los usuarios activos de Campo; solo
--    suben los que pueden apuntar (editor o admin). No se puede borrar desde la app.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Gastos ---------------------------------------------------------------
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

-- los gastos nunca cuentan para el límite de ventas
update public.facturas set cuenta_limite = false where tipo = 'gasto' and cuenta_limite;

create index if not exists facturas_tipo_fecha_idx on public.facturas (tipo, fecha desc);

-- 2. Cajón privado para los archivos -------------------------------------------
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

-- Comprobación
select id, public, file_size_limit from storage.buckets where id = 'facturas';

-- Fin de la migración 0015
