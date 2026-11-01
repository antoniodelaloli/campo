-- =====================================================================
-- CAMPO · seed.sql · Datos iniciales confirmados (31/10/2026)
--
-- Fuente: documento de descubrimiento del tío (ChatGPT) filtrado el 31/10/2026.
-- Todo son datos DECLARADOS por la familia, no mediciones ni datos catastrales.
-- Lo que no se sabe queda en NULL con fiabilidad 'pendiente'; no se inventa nada.
--
-- Ejecutar DESPUÉS de 0001_esquema_base.sql, desde el SQL Editor de Supabase
-- (se ejecuta como postgres, por lo que no le afecta RLS).
-- Es seguro lanzarlo una sola vez: si ya hay fincas, no hace nada.
-- =====================================================================

do $$
declare
  v_valladolises uuid;
  v_corvera      uuid;
  v_lobosillo    uuid;

  -- Corvera
  z_c_rect       uuid;
  z_c_panadero   uuid;
  s_c1           uuid;
  s_c2           uuid;
  s_c3           uuid;
  prog_c         uuid;

  -- Valladolises
  z_v_casa       uuid;
  z_v_olivos     uuid;
  z_v_abajo      uuid;
  z_v_pozo       uuid;
  z_v_trivino    uuid;
  z_v_mari       uuid;
  s_v1           uuid;
  s_v2           uuid;
  prog_v         uuid;

  -- Personas
  p_pencho       uuid;
  p_salah        uuid;

  -- Productos
  pr_suporter    uuid;
  pr_quassar     uuid;
  pr_azupec      uuid;
  pr_acrux       uuid;
  pr_ionblue     uuid;
  pr_nemerys     uuid;
  pr_katanga     uuid;
  pr_mojante     uuid;

  -- Tratamientos
  t_c_2026       uuid;
  t_c_2025       uuid;
  t_v_2025       uuid;
begin
  if exists (select 1 from public.fincas) then
    raise notice 'seed.sql: ya existen fincas; no se inserta nada.';
    return;
  end if;

  -- ------------------------------------------------------------------
  -- Fincas
  -- ------------------------------------------------------------------
  insert into public.fincas (nombre, alias, regimen, superficie_ha, superficie_fiabilidad, notas)
  values (
    'Valladolises', '{}', 'por_confirmar', 22, 'declarado',
    '~22 ha productivas (estimación 30/10/2026; referencias antiguas ~24 ha, pendiente de conciliar). '
    'Finca antigua formada por compra de parcelas pequeñas, parcialmente abancalada, con vivienda y zona deportiva. '
    'Limonero Fino 49 y mandarino Clemenvilla/Nova. Planos disponibles, a aportar.'
  )
  returning id into v_valladolises;

  insert into public.fincas (nombre, alias, regimen, superficie_ha, superficie_fiabilidad, n_arboles_aprox, notas)
  values (
    'Corvera', '{}', 'por_confirmar', 22, 'declarado', 6000,
    '~22 ha productivas (estimación 30/10/2026; referencias antiguas ~20 ha, pendiente de conciliar). '
    '~6.000 limoneros Fino 49. Gran rectángulo con dos caminos en cruz + parcela anexa. '
    'Descrita como "dos parcelas" y como "tres parcelas catastrales" (por aclarar). Planos disponibles, a aportar.'
  )
  returning id into v_corvera;

  insert into public.fincas (nombre, alias, regimen, superficie_ha, superficie_fiabilidad, notas)
  values (
    'Lobosillo', '{}', 'por_confirmar', null, 'pendiente',
    'Finca nueva, recién comprada. Descrita como ecológica: certificación y documentación por confirmar '
    '(no extender el régimen ecológico a Valladolises ni Corvera). Sin datos de superficie, cultivo, agua ni riego. '
    'El hermano de Antonio se implicará más en esta finca.'
  )
  returning id into v_lobosillo;

  -- ------------------------------------------------------------------
  -- Personas
  -- ------------------------------------------------------------------
  insert into public.personas (nombre, tipo, notas)
  values ('Pencho', 'trabajador', 'Trabaja en Valladolises y Corvera. Fumigaba Corvera el 30/10/2026.')
  returning id into p_pencho;

  insert into public.personas (nombre, tipo, notas)
  values ('Salah', 'trabajador', 'Trabaja en Valladolises y Corvera. 30/10/2026: retiraba plantas trepadoras/invasoras de los troncos en Corvera.')
  returning id into p_salah;

  insert into public.personas (nombre, tipo, notas)
  values ('Diego Vélez', 'tecnico', 'Técnico agrícola vinculado. Funciones actuales sin confirmar.');

  insert into public.personas (nombre, tipo, empresa, notas)
  values ('Antonio Cánovas', 'asesor', 'Ruraltech', 'Asesor; aparece en el contexto histórico. Rol actual sin confirmar.');

  insert into public.personas (nombre, tipo, empresa, notas)
  values ('Francisco', 'proveedor', 'Pozo Villalba', 'Encargado del Pozo Villalba. A él se llama para pedir agua para Corvera.');

  -- ------------------------------------------------------------------
  -- Campañas (sin fechas: no constan)
  -- ------------------------------------------------------------------
  insert into public.campanas (nombre, notas) values
    ('2025/26', 'Cifras de cosecha cerradas el 10/08/2026.'),
    ('2026/27', 'Primer corte de Valladolises previsto a finales de octubre / inicios de noviembre de 2026, condicionado a analítica de residuos. Dos cortes previstos. Contrato firmado pendiente.');

  -- ------------------------------------------------------------------
  -- CORVERA: programador, sectores, zonas, relación zona-sector
  -- ------------------------------------------------------------------
  insert into public.programadores (finca_id, nombre, marca, tiene_red, notas)
  values (
    v_corvera, 'Programador de riego Corvera', null, false,
    'Antiguo, configurado a mano en el lugar, sin conexión a red. Idéntico al de Valladolises. '
    'Marca/modelo sin confirmar ("creo que son Agrónic"): pendiente foto de la placa.'
  )
  returning id into prog_c;

  insert into public.sectores_riego (finca_id, numero, nombre, alias, programador_id, notas)
  values (v_corvera, 1, null, '{}', prog_c, 'Banda longitudinal del rectángulo grande.')
  returning id into s_c1;

  insert into public.sectores_riego (finca_id, numero, nombre, alias, programador_id, notas)
  values (v_corvera, 2, null, '{}', prog_c, 'Banda longitudinal del rectángulo grande.')
  returning id into s_c2;

  insert into public.sectores_riego (finca_id, numero, nombre, alias, programador_id, notas)
  values (v_corvera, 3, 'Parcela del panadero', array['parcela del panadero', 'panadero'], prog_c,
          'Parcela anexa junto a la entrada, comprada a un panadero.')
  returning id into s_c3;

  insert into public.zonas (finca_id, nombre, alias, especie, variedad, fiabilidad, notas)
  values (v_corvera, 'Rectángulo grande', array['rectángulo grande', 'rectangulo'], 'Limonero', 'Fino 49', 'declarado',
          'Bloque principal atravesado por dos caminos en cruz. Sectores 1 y 2. Marco, calles y edad sin datos.')
  returning id into z_c_rect;

  insert into public.zonas (finca_id, nombre, alias, especie, variedad, fiabilidad, notas)
  values (v_corvera, 'Parcela del panadero', array['panadero'], 'Limonero', 'Fino 49', 'declarado',
          'Parcela anexa junto a la entrada. Sector 3. Referencia catastral / recinto SIGPAC pendientes.')
  returning id into z_c_panadero;

  insert into public.zona_sector (zona_id, sector_id, finca_id) values
    (z_c_rect,     s_c1, v_corvera),
    (z_c_rect,     s_c2, v_corvera),
    (z_c_panadero, s_c3, v_corvera);

  -- ------------------------------------------------------------------
  -- VALLADOLISES: programador, sectores, zonas (sin relación zona-sector:
  -- los dos sectores riegan zonas mezcladas y el reparto aún no está definido)
  -- ------------------------------------------------------------------
  insert into public.programadores (finca_id, nombre, marca, tiene_red, notas)
  values (
    v_valladolises, 'Programador de riego Valladolises', null, false,
    'Antiguo, configurado a mano en el lugar, sin conexión a red. Idéntico al de Corvera. '
    'Marca/modelo sin confirmar ("creo que son Agrónic"): pendiente foto de la placa.'
  )
  returning id into prog_v;

  insert into public.sectores_riego (finca_id, numero, nombre, alias, programador_id, notas)
  values (v_valladolises, 1, null, '{}', prog_v,
          'Riega zonas mezcladas; reparto zona-sector por definir. Alimentado desde el pantano.')
  returning id into s_v1;

  insert into public.sectores_riego (finca_id, numero, nombre, alias, programador_id, notas)
  values (v_valladolises, 2, null, '{}', prog_v,
          'Riega zonas mezcladas; reparto zona-sector por definir. Alimentado desde el pantano.')
  returning id into s_v2;

  insert into public.zonas (finca_id, nombre, alias, fiabilidad, notas)
  values (v_valladolises, 'La Casa', array['alrededor de la casa', 'la casa'], 'pendiente',
          'Unidad cercada inicial, zona continua alrededor de la vivienda. Variedad, edad y nº de árboles sin detallar.')
  returning id into z_v_casa;

  insert into public.zonas (finca_id, nombre, alias, especie, variedad, n_arboles, fiabilidad, notas)
  values (v_valladolises, 'Los Olivos', array['olivos'], 'Mandarino', 'Clemenvilla / Nova', null, 'pendiente',
          'Pendiente de conciliar: ~800 nuevos + ~1.500 antiguos (~2.300), y en otra intervención ~2.000 en total.')
  returning id into z_v_olivos;

  insert into public.zonas (finca_id, nombre, alias, especie, variedad, fiabilidad, notas)
  values (v_valladolises, 'Abajo', array['abajo'], 'Limonero', 'Fino 49', 'declarado',
          'Zona más cuadrada, sin bancales. Desarrollada después de La Casa.')
  returning id into z_v_abajo;

  insert into public.zonas (finca_id, nombre, alias, especie, edad_aprox_anios, fiabilidad, notas)
  values (v_valladolises, 'Del Pozo', array['los nuevos', 'del pozo'], 'Limonero', 30, 'declarado',
          '"Del Pozo" y "Los Nuevos" son dos nombres de la misma zona. Limoneros de treinta y tantos años sobre "bancas" (bancos de tierra elevados). Variedad sin confirmar.')
  returning id into z_v_pozo;

  insert into public.zonas (finca_id, nombre, alias, fiabilidad, notas)
  values (v_valladolises, 'Triviño', array['trivino'], 'pendiente',
          'Zona pequeña al fondo, árboles algo más nuevos. Especie y variedad sin confirmar.')
  returning id into z_v_trivino;

  insert into public.zonas (finca_id, nombre, alias, fiabilidad, notas)
  values (v_valladolises, 'La Mari', array['pantano de la mari', 'la mari'], 'pendiente',
          'Parcela pequeña anexa. NO es la balsa de riego, a pesar del nombre "Pantano de la Mari".')
  returning id into z_v_mari;

  -- ------------------------------------------------------------------
  -- Pantanos
  -- ------------------------------------------------------------------
  insert into public.pantanos (finca_id, nombre, capacidad_m3, capacidad_util_m3, fiabilidad, notas)
  values (v_valladolises, 'Pantano Valladolises', 30000, 25000, 'declarado',
          '~30.000 m³ originales; ~25.000 m³ útiles como máximo. Nivel valorado a ojo, por experiencia. Calibración pendiente.');

  insert into public.pantanos (finca_id, nombre, capacidad_m3, capacidad_util_m3, fiabilidad, notas)
  values (v_corvera, 'Pantano Corvera', 50000, null, 'declarado',
          '~50.000 m³. Nivel valorado a ojo, por experiencia. Capacidad útil y calibración pendientes.');

  -- ------------------------------------------------------------------
  -- Contadores
  -- ------------------------------------------------------------------
  insert into public.contadores (finca_id, nombre, tipo, origen_agua, es_digital, es_contraste, notas) values
    (v_valladolises, 'Entrada trasvase (digital)', 'entrada', 'trasvase', true, false,
      'Contador digital del trasvase. La app de la Comunidad de Regantes muestra gasto y cupo restante.'),
    (v_valladolises, 'Entrada propio (contraste)', 'entrada', 'trasvase', null, true,
      'Contador propio para contrastar con el digital del trasvase.'),
    (v_corvera, 'Entrada Pozo Villalba (propio)', 'entrada', 'pozo', null, false,
      'Se contrasta con la factura de Pozo Villalba (lecturas anterior/actual). Se fotografía el contador.'),
    (v_corvera, 'Salida total (3 sectores)', 'salida', null, null, false,
      'Un único contador de salida para los 3 sectores; no hay medición por sector.');

  insert into public.contadores (finca_id, nombre, tipo, sector_id, notas)
  values
    (v_valladolises, 'Salida sector 1', 'salida', s_v1, 'Un contador de salida por sector.'),
    (v_valladolises, 'Salida sector 2', 'salida', s_v2, 'Un contador de salida por sector.');

  -- ------------------------------------------------------------------
  -- Productos transcritos de registros (SIN validar)
  -- ------------------------------------------------------------------
  insert into public.productos (nombre, tipo, validado, notas) values
    ('Suporter',       'por_confirmar', false, 'Transcrito del registro 30/10/2026 (Corvera). Nombre exacto, nº de registro, dosis/ha y plazo de seguridad sin validar.')
    returning id into pr_suporter;
  insert into public.productos (nombre, tipo, validado, notas) values
    ('Quassar',        'por_confirmar', false, 'Transcrito del registro 30/10/2026 (Corvera). Sin validar. (Se mencionó también "cuásar" en nov. 2025.)')
    returning id into pr_quassar;
  insert into public.productos (nombre, tipo, validado, notas) values
    ('Azupec',         'por_confirmar', false, 'Transcrito del registro 30/10/2026 (Corvera). Sin validar.')
    returning id into pr_azupec;
  insert into public.productos (nombre, tipo, validado, notas) values
    ('Acrux Flow',     'por_confirmar', false, 'Transcrito del registro 30/10/2026 (Corvera). Sin validar.')
    returning id into pr_acrux;
  insert into public.productos (nombre, tipo, validado, notas) values
    ('Ion Blue',       'por_confirmar', false, 'Transcrito del registro ~28/10/2025 (Corvera). Sin validar.')
    returning id into pr_ionblue;
  insert into public.productos (nombre, tipo, validado, notas) values
    ('Nemerys Filo',   'por_confirmar', false, 'Transcrito del registro ~28/10/2025 (Corvera). Sin validar.')
    returning id into pr_nemerys;
  insert into public.productos (nombre, tipo, validado, notas) values
    ('Katanga Expres', 'por_confirmar', false, 'Transcrito del registro ~28/10/2025 (Valladolises). Sin validar.')
    returning id into pr_katanga;
  insert into public.productos (nombre, tipo, validado, notas) values
    ('Mojante (sin marca)', 'adyuvante', false, 'Aparece como "mojante" sin marca en los registros de ~28/10/2025. Producto concreto por confirmar.')
    returning id into pr_mojante;

  -- ------------------------------------------------------------------
  -- Tratamientos históricos (transcripciones, NO recomendaciones)
  -- ------------------------------------------------------------------
  -- 30/10/2026 · Corvera · piojo y araña roja · en curso
  insert into public.tratamientos
    (finca_id, fecha, fecha_aproximada, estado, objetivo, litros_cuba, aplicador_id, maquina, notas, origen)
  values
    (v_corvera, date '2026-10-30', false, 'en_curso', 'Piojo y araña roja', 2000, p_pencho, null,
     'Marcha lenta. Previsión de terminar ese día (sin confirmar finalización, sectores, hectáreas ni nº de cubas).',
     'import')
  returning id into t_c_2026;

  insert into public.tratamiento_productos (tratamiento_id, producto_id, dosis_por_cuba, unidad) values
    (t_c_2026, pr_suporter, 1,     'L'),
    (t_c_2026, pr_quassar,  5,     'L'),
    (t_c_2026, pr_azupec,   10,    'kg'),
    (t_c_2026, pr_acrux,    0.150, 'L');

  -- ~28/10/2025 · Corvera · objetivo sin confirmar
  insert into public.tratamientos
    (finca_id, fecha, fecha_aproximada, estado, objetivo, litros_cuba, notas, origen)
  values
    (v_corvera, date '2025-10-28', true, 'realizada', null, 2000,
     'Fecha aproximada. Objetivo sin confirmar.', 'import')
  returning id into t_c_2025;

  insert into public.tratamiento_productos (tratamiento_id, producto_id, dosis_por_cuba, unidad) values
    (t_c_2025, pr_mojante,  2,   'L'),
    (t_c_2025, pr_ionblue,  2,   'L'),
    (t_c_2025, pr_nemerys,  1.5, 'L');

  -- ~28/10/2025 · Valladolises · objetivo sin confirmar
  insert into public.tratamientos
    (finca_id, fecha, fecha_aproximada, estado, objetivo, litros_cuba, notas, origen)
  values
    (v_valladolises, date '2025-10-28', true, 'realizada', null, 2000,
     'Fecha aproximada. Objetivo sin confirmar.', 'import')
  returning id into t_v_2025;

  insert into public.tratamiento_productos (tratamiento_id, producto_id, dosis_por_cuba, unidad) values
    (t_v_2025, pr_mojante, 2, 'L'),
    (t_v_2025, pr_katanga, 5, 'kg');

  -- ------------------------------------------------------------------
  -- Incidencia: piscina de Valladolises (no es una fuga del riego)
  -- ------------------------------------------------------------------
  insert into public.incidencias (finca_id, tipo, titulo, descripcion, severidad, estado, fecha, origen)
  values (
    v_valladolises, 'piscina', 'Piscina: comprobar si pierde agua',
    'El 27/10/2026 se dejó llenando la piscina para ver si pierde agua. Se pretende repararla antes del verano de 2027. No es una fuga del riego.',
    'baja', 'en_curso', date '2026-10-27', 'import'
  );

  -- ------------------------------------------------------------------
  -- Diario: cifras pendientes de conciliar (para no perderlas de vista)
  -- ------------------------------------------------------------------
  insert into public.diario (finca_id, fecha, texto, origen) values
    (v_valladolises, date '2026-10-31',
     'Pendiente de conciliar (campaña 25/26): buenos + destrío = 760.585 kg, 940 kg menos que el total declarado de 761.525 kg.',
     'import'),
    (null, date '2026-10-31',
     'Pendiente de conciliar: consumos de agua 2025 de 14.050 m³ y 19.270 m³, atribuidos de forma distinta según la fuente (por finca vs. contador de entrada/salida de Corvera, posible agua almacenada).',
     'import'),
    (v_corvera, date '2026-10-31',
     'Pendiente de aclarar: Corvera descrita como "dos parcelas" y como "tres parcelas catastrales".',
     'import'),
    (null, date '2026-10-31',
     'Carta de la CHS (octubre 2026) sobre la parcela 236, indicada como fuera de regadío. Finca afectada sin determinar: no atribuir a ninguna todavía.',
     'import');

  raise notice 'seed.sql: datos iniciales insertados correctamente.';
end;
$$;


-- =====================================================================
-- ACTIVAR AL PRIMER ADMIN
-- 1) Crea tu usuario en Authentication > Users > Add user (con contraseña; el acceso por GitHub al panel NO crea un usuario de la app).
-- 2) Ejecuta:
--
--    update public.profiles
--       set activo = true, rol = 'admin', nombre = 'Antonio'
--     where email = 'antonioeldelaloli@gmail.com';
--
-- Para activar a tu hermano / tu tío como editores:
--
--    update public.profiles
--       set activo = true, rol = 'editor'
--     where email = 'EMAIL_DE_ELLOS';
-- =====================================================================
