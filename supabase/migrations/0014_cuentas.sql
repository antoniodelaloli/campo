-- =====================================================================
-- CAMPO · Migración 0014 · Cuentas: titulares y facturas (primera parte)
--
-- Para vigilar que ningún titular pase de 250.000 € de ventas al año
-- (límite de módulos en la actividad agrícola) y saber cómo va cada finca:
--   1. titulares: quien factura las ventas (Maite, Carlos y la sociedad
--      «Juan Hernández Sáez y otros», JHSYO), con su límite, un tope de
--      seguridad y el % a partir del cual se avisa.
--   2. facturas: cada factura de venta (y, más adelante, de gasto) con su
--      titular, la finca de donde sale el limón y la campaña. El titular y la
--      finca van por separado porque a veces se coge de un sitio y se factura
--      en otro. Estado «prevista» para planear los cortes que faltan.
-- Hoy: Valladolises lo factura casi siempre JHSYO; Corvera, Carlos y Maite.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Titulares -----------------------------------------------------------
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

insert into public.titulares (nombre, nombre_completo, tipo, notas) values
  ('Maite', 'Mª Teresa', 'persona', 'Factura parte de Corvera (paga un alquiler a Carlos por explotarla).'),
  ('Carlos', 'Juan Carlos', 'persona', 'Factura parte de Corvera.'),
  ('JHSYO', 'Juan Hernández Sáez y otros', 'sociedad',
   'Factura casi siempre Valladolises. Ojo: preguntar al gestor si sus ventas cuentan también para el límite de sus socios.')
on conflict (nombre) do nothing;

-- 2. Facturas -------------------------------------------------------------
create table if not exists public.facturas (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null default 'venta' check (tipo in ('venta', 'gasto')),
  estado        text not null default 'emitida' check (estado in ('emitida', 'prevista')),
  titular_id    uuid not null references public.titulares (id),
  -- de qué finca sale el limón (o a qué finca va el gasto); puede ser otra que la del titular
  finca_id      uuid references public.fincas (id),
  campana       text check (campana is null or campana ~ '^\d{4}/\d{2}$'),
  fecha         date not null,
  numero        text,
  contraparte   text,
  concepto      text,
  kg            numeric(12, 2) check (kg is null or kg >= 0),
  base_eur      numeric(12, 2) not null check (base_eur >= 0),
  -- IVA o compensación del régimen especial agrario (no cuenta para el límite)
  impuesto_eur  numeric(12, 2) not null default 0 check (impuesto_eur >= 0),
  total_eur     numeric(12, 2) generated always as (base_eur + impuesto_eur) stored,
  -- si cuenta para el límite de ventas del titular (por defecto, las ventas sí)
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

-- 3. Seguridad, auditoría e índices -----------------------------------------
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

-- Comprobación
select nombre, nombre_completo, tipo, limite_eur, tope_seguridad_eur, aviso_pct from public.titulares order by nombre;

-- Fin de la migración 0014
