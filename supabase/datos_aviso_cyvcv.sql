-- =====================================================================
-- CAMPO · Aviso: virus CYVCV en cítricos (ficha de Sanidad Vegetal, CARM, 2026)
-- Sale en el inicio (Avisos) para todas las fincas. Se puede ejecutar más de una vez.
-- =====================================================================

insert into public.avisos (titulo, texto, nivel, categoria, fecha, origen)
select
  'Virus CYVCV en cítricos: vigilar los limoneros',
  'Clorosis nervial amarilla de los cítricos (ficha 2026 de Sanidad Vegetal de la CARM). El limonero es de lo más sensible. '
  || 'Síntomas: nervios de las hojas muy amarillos, hojas deformadas y árbol sin fuerza. '
  || 'Lo pasan la mosca blanca de los cítricos y los pulgones (Aphis spiraecola y A. gossypii), el injerto y las tijeras de poda: desinfectarlas entre árbol y árbol. '
  || 'Si se ve algo raro: foto, apuntarlo en Campo y avisar a Sanidad Vegetal (968 365 439, sanidadvegetalmurcia@carm.es). '
  || 'Vigilar sobre todo la planta puesta en 2025-2026 que venga de Cataluña, la Comunidad Valenciana o Italia. '
  || 'En mayo de 2026 había 5 casos confirmados en Murcia; la Región no obliga a arrancar.',
  'atencion',
  'tratamientos',
  current_date,
  'manual'
where not exists (
  select 1 from public.avisos where titulo = 'Virus CYVCV en cítricos: vigilar los limoneros' and estado = 'abierto'
);

select titulo, nivel, categoria, fecha, estado from public.avisos where titulo like 'Virus CYVCV%';
