-- =====================================================================
-- CAMPO · pendiente_0002_0003.sql · TODO LO PENDIENTE EN UNA SOLA VEZ
--
-- Junta, en este orden:
--   1. migrations/0002_avisos_y_fuentes_agua.sql  (tablas avisos y fuentes_agua)
--   2. datos_0002.sql                             (tareas, avisos y datos de agua del diseño)
--   3. migrations/0003_hitos.sql                  (tabla de fechas de la agenda)
--   4. datos_0003.sql                             (primeras fechas)
--
-- Versión «se puede repetir»: lo que ya exista se respeta (tablas, índices)
-- o se vuelve a dejar igual (permisos y disparadores), y los datos comprueban
-- antes si ya están. Se puede ejecutar aunque parte ya estuviera hecha.
--
-- Requisito: tener ya aplicados 0001_esquema_base.sql y seed.sql.
-- Cómo: Supabase → SQL Editor → New query → pegar ESTE archivo entero → Run.
-- Va todo en una transacción: o se aplica entero o no se aplica nada.
-- =====================================================================

begin;

-- #####################################################################
-- migrations/0002_avisos_y_fuentes_agua.sql
-- #####################################################################

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
create table if not exists public.avisos (
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
create table if not exists public.fuentes_agua (
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

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
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
      'create or replace trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      'trg_' || t || '_updated_at', t);
    execute format(
      'create or replace trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
      'trg_' || t || '_audit', t);
  end loop;
end;
$$;

create index if not exists avisos_estado_idx       on public.avisos (estado, fecha desc);
create index if not exists avisos_categoria_idx    on public.avisos (categoria, estado);
create index if not exists avisos_finca_idx        on public.avisos (finca_id);
create index if not exists fuentes_agua_finca_idx  on public.fuentes_agua (finca_id);

-- Fin de la migración 0002


-- #####################################################################
-- datos_0002.sql
-- #####################################################################

-- =====================================================================
-- CAMPO · datos_0002.sql · Tareas, avisos y datos de agua y tratamientos
--
-- Son los mismos que se ven en el diseño de la app, sacados del documento
-- de la familia (30-31/10/2026) y de la carpeta de Drive. Nada inventado:
-- lo que no se sabe va como "por confirmar" o "pendiente de conciliar".
--
-- Ejecutar DESPUÉS de 0001, seed.sql y 0002_avisos_y_fuentes_agua.sql,
-- desde el SQL Editor de Supabase. Se puede lanzar más de una vez:
-- cada bloque comprueba antes si el dato ya existe.
-- =====================================================================

do $$
declare
  v_valladolises uuid;
  v_corvera      uuid;
  p_pencho       uuid;
  p_salah        uuid;
  c_entrada      uuid;
  c_salida       uuid;
  t_id           uuid;
begin
  select id into v_valladolises from public.fincas where nombre = 'Valladolises';
  select id into v_corvera      from public.fincas where nombre = 'Corvera';
  select id into p_pencho       from public.personas where nombre = 'Pencho' limit 1;
  select id into p_salah        from public.personas where nombre = 'Salah' limit 1;

  if v_valladolises is null or v_corvera is null then
    raise exception 'Faltan las fincas: ejecuta antes seed.sql';
  end if;

  -- ------------------------------------------------------------------
  -- Tareas (las del diseño)
  -- ------------------------------------------------------------------
  if not exists (select 1 from public.tareas where titulo = 'Fumigar contra piojo y araña roja' and finca_id = v_corvera) then
    insert into public.tareas (titulo, descripcion, tipo, estado, prioridad, finca_id, fecha_prevista, origen)
    values ('Fumigar contra piojo y araña roja',
            'Cuba de 2.000 L con Suporter, Quassar, Azupec y Acrux Flow. Va lenta; se esperaba terminar el 30/10 (sin confirmar).',
            'tratamiento', 'en_curso', 'normal', v_corvera, date '2026-10-30', 'import')
    returning id into t_id;
    if p_pencho is not null then
      insert into public.tareas_personas (tarea_id, persona_id) values (t_id, p_pencho);
    end if;
  end if;

  if not exists (select 1 from public.tareas where titulo = 'Limpieza de calles' and finca_id = v_valladolises) then
    insert into public.tareas (titulo, tipo, estado, prioridad, finca_id, fecha_prevista, origen)
    values ('Limpieza de calles', 'mantenimiento', 'prevista', 'normal', v_valladolises, date '2026-10-31', 'import')
    returning id into t_id;
    if p_salah is not null then
      insert into public.tareas_personas (tarea_id, persona_id) values (t_id, p_salah);
    end if;
  end if;

  if not exists (select 1 from public.tareas where titulo = 'Pedir dos días de agua' and finca_id = v_valladolises) then
    insert into public.tareas (titulo, descripcion, tipo, estado, prioridad, finca_id, fecha_prevista, origen)
    values ('Pedir dos días de agua',
            'Por la app de la Comunidad de Regantes del Campo de Cartagena (cupo por superficie).',
            'riego', 'prevista', 'normal', v_valladolises, date '2026-10-31', 'import');
  end if;

  if not exists (select 1 from public.tareas where titulo = 'Preparar el primer corte' and finca_id = v_valladolises) then
    insert into public.tareas (titulo, descripcion, tipo, estado, prioridad, finca_id, fecha_prevista, origen)
    values ('Preparar el primer corte',
            'Falta la analítica de residuos. Previsto a finales de octubre o principios de noviembre; dos cortes.',
            'cosecha', 'prevista', 'alta', v_valladolises, null, 'import');
  end if;

  if not exists (select 1 from public.tareas where titulo = 'Foto de la placa del programador' and finca_id = v_corvera) then
    insert into public.tareas (titulo, descripcion, tipo, estado, prioridad, finca_id, fecha_prevista, origen)
    values ('Foto de la placa del programador',
            'En la caseta del cabezal. Para confirmar marca y modelo (¿Agrónic?). El de Valladolises es idéntico.',
            'revision', 'prevista', 'normal', v_corvera, null, 'import');
  end if;

  -- ------------------------------------------------------------------
  -- Avisos (los del diseño)
  -- ------------------------------------------------------------------
  if not exists (select 1 from public.avisos where titulo = 'Analítica de residuos pendiente') then
    insert into public.avisos (titulo, texto, nivel, categoria, finca_id, fecha, origen)
    values ('Analítica de residuos pendiente',
            'Condiciona el primer corte de Valladolises. En 2025 se empezó a cortar tras una analítica favorable.',
            'urgente', 'tratamientos', v_valladolises, date '2026-10-31', 'import');
  end if;

  if not exists (select 1 from public.avisos where titulo = 'Desaladora: comprobar si se contestó a la CHS') then
    insert into public.avisos (titulo, texto, nivel, categoria, finca_id, fecha, origen)
    values ('Desaladora: comprobar si se contestó a la CHS',
            'Oficio de la CHS del 24/11/2025 (ref. CSR-0008/2018): pedía documentación en 15 días. Renuncia compatible de hasta 112.995 m³ de agua subterránea; necesita la conformidad de Pozo Villalba S.A. Mientras tanto el plazo está suspendido.',
            'atencion', 'agua', v_corvera, date '2025-11-24', 'import');
  end if;

  if not exists (select 1 from public.avisos where titulo = 'Cosecha 25/26: cifras pendientes de conciliar') then
    insert into public.avisos (titulo, texto, nivel, categoria, finca_id, fecha, origen)
    values ('Cosecha 25/26: cifras pendientes de conciliar',
            'La liquidación suma 1.854.256 kg y las cuentas de la familia 2.032.042 kg: 177.786 kg de diferencia.',
            'atencion', 'cosecha', null, date '2026-10-31', 'import');
  end if;

  -- ------------------------------------------------------------------
  -- De dónde viene el agua (precios de referencia 2025, declarados)
  -- ------------------------------------------------------------------
  insert into public.fuentes_agua (finca_id, origen_agua, proveedor, precio_ref_eur_m3, anio_ref, fiabilidad, notas)
  values
    (v_valladolises, 'trasvase', 'Comunidad de Regantes del Campo de Cartagena', 0.43, 2025, 'declarado',
     'Se pide por la app de la comunidad (código o tarjeta de puntos; cupo por superficie y plazo). Mejor calidad relativa.'),
    (v_corvera, 'pozo', 'Pozo Villalba', 0.85, 2025, 'declarado',
     'Se pide llamando a Francisco, encargado del pozo. Agua más salina. Paso a agua desalada en trámite.')
  on conflict (finca_id, origen_agua, proveedor) do nothing;

  -- ------------------------------------------------------------------
  -- Lecturas de 2022 de los contadores de Corvera (control manual de Drive)
  -- Qué contador es cada uno está POR CONFIRMAR: van marcadas para conciliar
  -- y no cuentan en los cálculos de consumo.
  -- ------------------------------------------------------------------
  select id into c_entrada from public.contadores where finca_id = v_corvera and nombre = 'Entrada Pozo Villalba (propio)';
  select id into c_salida  from public.contadores where finca_id = v_corvera and nombre = 'Salida total (3 sectores)';

  if c_entrada is not null and not exists (
    select 1 from public.lecturas_contador where contador_id = c_entrada and fecha = date '2022-07-30') then
    insert into public.lecturas_contador (contador_id, fecha, lectura_m3, pendiente_conciliar, notas, origen)
    values (c_entrada, date '2022-07-30', 126420, true,
            '«Contador azul» del control de 2022 (se comparaba con la factura de Pozo Villalba). Que sea este contador está por confirmar.',
            'import');
  end if;

  if c_salida is not null and not exists (
    select 1 from public.lecturas_contador where contador_id = c_salida and fecha = date '2022-07-30') then
    insert into public.lecturas_contador (contador_id, fecha, lectura_m3, pendiente_conciliar, notas, origen)
    values (c_salida, date '2022-07-30', 1208075, true,
            '«Contador blanco» del control de 2022. Que sea este contador está por confirmar.',
            'import');
  end if;

  -- ------------------------------------------------------------------
  -- Tratamiento histórico de julio de 2022 (Corvera)
  -- ------------------------------------------------------------------
  if not exists (select 1 from public.tratamientos where finca_id = v_corvera and fecha = date '2022-07-01') then
    insert into public.tratamientos (finca_id, fecha, fecha_aproximada, estado, objetivo, notas, origen)
    values (v_corvera, date '2022-07-01', false, 'realizada', 'Piojo, araña y «coto» (¿cotonet?)',
            'Del 1 al 4/7/2022. Se paró por viento y hubo una rotura de cuba el 4/7/2022. Productos sin anotar.',
            'import');
  end if;

  -- ------------------------------------------------------------------
  -- Productos con ficha técnica en Drive (2013-2016) · SIN validar
  -- ------------------------------------------------------------------
  insert into public.productos (nombre, tipo, validado, notas)
  values
    ('Movento 150 O-Teq', 'fitosanitario', false, 'Ficha técnica en Drive («Fichas productos», 2013-2016). Comprobar que sigue autorizado.'),
    ('Reldan E',          'fitosanitario', false, 'Ficha técnica en Drive («Fichas productos», 2013-2016). Comprobar que sigue autorizado.'),
    ('Goal Supreme',      'herbicida',     false, 'Ficha técnica en Drive («Fichas productos», 2013-2016). Comprobar que sigue autorizado.'),
    ('Torneo Top',        'por_confirmar', false, 'Ficha técnica en Drive («Fichas productos», 2013-2016). Tipo y autorización por confirmar.'),
    ('Metal D',           'por_confirmar', false, 'Ficha técnica en Drive («Fichas productos», 2013-2016). Tipo y autorización por confirmar.'),
    ('Abamectina',        'fitosanitario', false, 'Materia activa con ficha en Drive (2013-2016); marca comercial por confirmar.'),
    ('Sulfato de cobre',  'fitosanitario', false, 'Ficha técnica en Drive («Fichas productos», 2013-2016). Comprobar que sigue autorizado.'),
    ('Nitrato cálcico',   'fertilizante',  false, 'Ficha técnica en Drive («Fichas productos», 2013-2016).'),
    ('Ácido nítrico',     'fertilizante',  false, 'Ficha técnica en Drive («Fichas productos», 2013-2016).')
  on conflict (nombre) do nothing;

  raise notice 'datos_0002.sql: datos cargados.';
end;
$$;


-- #####################################################################
-- migrations/0003_hitos.sql
-- #####################################################################

-- =====================================================================
-- CAMPO · Migración 0003 · Hitos del calendario
--
-- Contenido:
--   1. hitos: fechas que hay que tener presentes (cortes, tratamientos,
--      plazos de papeles, agua, revisiones…). No son tareas: una tarea es
--      algo que hacer; un hito es una fecha que no se puede pasar.
--      Lo que sale solo (plazos de seguridad, tareas con fecha) NO se guarda
--      aquí: la app lo calcula al vuelo.
--   2. Mismo modelo de seguridad que la 0001: leer = miembro activo,
--      escribir = editor/admin, sin DELETE, con auditoría y updated_at.
--
-- Cómo aplicarlo: SQL Editor de Supabase → pegar el archivo completo → Run.
-- Requiere haber aplicado antes la 0001 y la 0002. Ejecutar una sola vez.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Hitos
-- ---------------------------------------------------------------------
create table if not exists public.hitos (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null check (char_length(titulo) between 3 and 200),
  texto             text check (texto is null or char_length(texto) <= 500),
  tipo              text not null default 'otro'
                      check (tipo in ('corte', 'tratamiento', 'plazo', 'agua', 'revision', 'compra', 'otro')),
  finca_id          uuid references public.fincas (id),
  fecha             date not null,
  hora              time,
  fecha_aproximada  boolean not null default false,
  -- días de antelación con que avisar (0 = el mismo día). Para las notificaciones.
  avisar_dias       integer[] not null default '{7,1,0}'
                      check (avisar_dias <@ array[0,1,2,3,7,14,30,60]::integer[]),
  repetir           text not null default 'no' check (repetir in ('no', 'anual')),
  estado            text not null default 'pendiente'
                      check (estado in ('pendiente', 'hecho', 'anulado')),
  hecho_en          timestamptz,
  -- si se creó al completar el del año anterior
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


-- ---------------------------------------------------------------------
-- 2. Seguridad, auditoría e índices
-- ---------------------------------------------------------------------
alter table public.hitos enable row level security;

drop policy if exists hitos_select on public.hitos;
drop policy if exists hitos_insert on public.hitos;
drop policy if exists hitos_update on public.hitos;
create policy hitos_select on public.hitos
  for select to authenticated using ((select private.is_member()));
create policy hitos_insert on public.hitos
  for insert to authenticated with check ((select private.is_writer()));
create policy hitos_update on public.hitos
  for update to authenticated
  using ((select private.is_writer())) with check ((select private.is_writer()));

revoke all on public.hitos from anon;
revoke delete, truncate on public.hitos from authenticated;

create or replace trigger trg_hitos_updated_at before update on public.hitos
  for each row execute function private.set_updated_at();
create or replace trigger trg_hitos_audit after insert or update or delete on public.hitos
  for each row execute function private.audit_row();

create index if not exists hitos_estado_fecha_idx on public.hitos (estado, fecha);
create index if not exists hitos_finca_idx        on public.hitos (finca_id);
create index if not exists hitos_viene_de_idx     on public.hitos (viene_de);

-- Fin de la migración 0003


-- #####################################################################
-- datos_0003.sql
-- #####################################################################

-- =====================================================================
-- CAMPO · datos_0003.sql · Primeros hitos del calendario
--
-- Sacados del documento de la familia (30-31/10/2026) y de la normativa.
-- Las fechas que no son exactas van marcadas como aproximadas (≈).
--
-- Ejecutar DESPUÉS de 0003_hitos.sql, desde el SQL Editor de Supabase.
-- Se puede lanzar más de una vez: cada hito comprueba antes si ya existe.
-- =====================================================================

do $$
declare
  v_valladolises uuid;
  v_corvera      uuid;
begin
  select id into v_valladolises from public.fincas where nombre = 'Valladolises';
  select id into v_corvera      from public.fincas where nombre = 'Corvera';

  if v_valladolises is null or v_corvera is null then
    raise exception 'Faltan las fincas: ejecuta antes seed.sql';
  end if;

  -- Primer corte de Valladolises (fecha orientativa)
  if not exists (select 1 from public.hitos where titulo = 'Primer corte de Valladolises') then
    insert into public.hitos (titulo, texto, tipo, finca_id, fecha, fecha_aproximada, avisar_dias, origen)
    values ('Primer corte de Valladolises',
            'Previsto a finales de octubre o principios de noviembre, según la analítica de residuos. Se esperan dos cortes. Fecha sin confirmar.',
            'corte', v_valladolises, date '2026-11-02', true, '{7,1,0}', 'import');
  end if;

  -- Contrato 2026/27: cambio de precio de referencia
  if not exists (select 1 from public.hitos where titulo = 'Precio de referencia: de «un corte» a «todo limón»') then
    insert into public.hitos (titulo, texto, tipo, finca_id, fecha, fecha_aproximada, avisar_dias, origen)
    values ('Precio de referencia: de «un corte» a «todo limón»',
            'Contrato 2026/27 de Valladolises y Corvera: se liquida con el precio medio de la Consejería para «un corte» mientras exista y luego «todo limón». El cambio suele ser antes de Navidad.',
            'corte', null, date '2026-12-15', true, '{14,7,1}', 'import');
  end if;

  -- Normativa: registro electrónico de tratamientos
  if not exists (select 1 from public.hitos where titulo = 'Tratamientos en el cuaderno digital (CUE)') then
    insert into public.hitos (titulo, texto, tipo, finca_id, fecha, fecha_aproximada, avisar_dias, origen)
    values ('Tratamientos en el cuaderno digital (CUE)',
            'Desde el 1 de enero de 2027 los tratamientos fitosanitarios se tienen que anotar por medios electrónicos (CUE digital); en papel solo hasta el 31/12/2026. Hablarlo con el técnico.',
            'plazo', null, date '2027-01-01', false, '{30,7,1}', 'import');
  end if;
end;
$$;


commit;

-- Comprobación: deberían salir 3 avisos, 2 fuentes de agua y 3 fechas (o más, si ya habías apuntado alguno).
select
  (select count(*) from public.avisos)       as avisos,
  (select count(*) from public.fuentes_agua) as fuentes_agua,
  (select count(*) from public.hitos)        as fechas;
