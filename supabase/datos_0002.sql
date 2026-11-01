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
