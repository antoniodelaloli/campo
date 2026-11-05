-- =====================================================================
-- CAMPO · Migración 0020: albaranes de báscula (las hojas de cada corte)
-- Cada fila es un camión: albarán, fecha, cajas, pesada, kilos buenos, kilos de
-- cítrica (destrío) e importe, con la campaña, la finca, el corte y a nombre de
-- quién va. Es de donde se sacan los kilos de cada finca (las facturas dicen a
-- nombre de quién, pero no siempre de qué finca salió el limón).
-- Se meten también las tres primeras hojas (5/11/2026):
--   · Corvera 2024/25, 1º corte, todo a nombre de Maite (42 albaranes)
--   · Valladolises 2025/26, hoja «MªTERESA» de febrero (31 albaranes)
--   · 3er corte 2025/26 de JHSYO (22 albaranes; finca por confirmar)
-- Requiere las migraciones 0014 (titulares) y 0016 (rol administrativo).
-- Se puede ejecutar más de una vez.
-- =====================================================================

do $$
begin
  if to_regprocedure('private.is_admin_writer()') is null then
    raise exception 'Falta la migración 0016 (rol administrativo): ejecútala antes que esta.';
  end if;
end;
$$;

create table if not exists public.albaranes (
  id              uuid primary key default gen_random_uuid(),
  campana         text not null check (campana ~ '^\d{4}/\d{2}$'),
  finca_id        uuid references public.fincas (id) on delete set null,
  corte           smallint check (corte between 1 and 9),
  titular_id      uuid references public.titulares (id) on delete set null,
  hoja            text check (hoja is null or char_length(hoja) <= 300),
  albaran         text not null check (char_length(albaran) <= 40),
  fecha           date not null,
  cajas           integer check (cajas is null or cajas >= 0),
  bruto_kg        numeric(10,2),
  tara_camion_kg  numeric(10,2),
  tara_cajas_kg   numeric(10,2),
  kg_buenos       numeric(10,2) not null default 0 check (kg_buenos >= 0),
  kg_citrica      numeric(10,2) not null default 0 check (kg_citrica >= 0),
  importe_eur     numeric(12,2),
  notas           text check (notas is null or char_length(notas) <= 500),
  origen          text not null default 'app',
  anulado         boolean not null default false,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.albaranes is 'Albaranes de báscula de cada corte (una fila por camión), copiados de las hojas de Excel.';
comment on column public.albaranes.hoja is 'Título de la hoja de Excel de la que sale (para agrupar y para no meterla dos veces).';
comment on column public.albaranes.importe_eur is 'Importe que pone la hoja: kilos buenos × precio, sin el 12 % de compensación.';

create index if not exists albaranes_campana_idx on public.albaranes (campana, finca_id) where not anulado;

do $$
begin
  execute 'alter table public.albaranes enable row level security';
  execute 'drop policy if exists albaranes_select on public.albaranes';
  execute 'create policy albaranes_select on public.albaranes for select to authenticated using ((select private.is_member()))';
  execute 'drop policy if exists albaranes_insert on public.albaranes';
  execute 'create policy albaranes_insert on public.albaranes for insert to authenticated with check ((select private.is_admin_writer()))';
  execute 'drop policy if exists albaranes_update on public.albaranes';
  execute 'create policy albaranes_update on public.albaranes for update to authenticated using ((select private.is_admin_writer())) with check ((select private.is_admin_writer()))';
  execute 'drop trigger if exists trg_albaranes_updated_at on public.albaranes';
  execute 'create trigger trg_albaranes_updated_at before update on public.albaranes for each row execute function private.set_updated_at()';
  execute 'drop trigger if exists trg_albaranes_audit on public.albaranes';
  execute 'create trigger trg_albaranes_audit after insert or update or delete on public.albaranes for each row execute function private.audit_row()';
end;
$$;

-- Las tres primeras hojas -------------------------------------------------
insert into public.albaranes
  (campana, finca_id, corte, titular_id, hoja, albaran, fecha, cajas, bruto_kg, tara_camion_kg, tara_cajas_kg,
   kg_buenos, kg_citrica, importe_eur, notas, origen)
select v.campana, f.id, v.corte, t.id, v.hoja, v.albaran, v.fecha::date, v.cajas, v.bruto, v.tara_c, v.tara_k,
       v.kg_b, v.kg_c, v.importe, v.notas, 'import'
from (values

  -- LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa): 42 albaranes
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '53085', '2025-01-15', null, null, null, null, 0, 12040, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '66428', '2025-01-20', null, null, null, null, 0, 12980, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '66430', '2025-01-20', null, null, null, null, 0, 11860, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '669429', '2025-01-20', null, null, null, null, 0, 11100, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64781', '2025-01-20', 594, 24780, 11560, 1485, 11735, 0, 4224.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64780', '2025-01-20', 594, 24780, 11560, 1485, 11735, 0, 4224.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65071', '2025-01-20', 510, 20060, 8700, 1275, 10085, 0, 3630.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65073', '2025-01-20', 510, 20040, 8700, 1275, 10065, 0, 3623.4, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64782', '2025-01-20', 594, 24720, 11560, 1485, 11675, 0, 4203, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65075', '2025-01-21', 510, 19980, 8700, 1275, 10005, 0, 3601.8, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64783', '2025-01-21', 594, 24660, 11560, 1485, 11615, 0, 4181.4, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65074', '2025-01-21', 510, 20020, 8700, 1275, 10045, 0, 3616.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65076', '2025-01-21', 510, 20060, 8700, 1275, 10085, 0, 3630.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64784', '2025-01-21', 594, 24580, 11560, 1485, 11535, 0, 4152.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64785', '2025-01-22', 594, 25000, 11560, 1485, 11955, 0, 4303.8, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65077', '2025-01-22', 510, 20040, 8700, 1275, 10065, 0, 3623.4, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65762', '2025-01-22', 804, 32640, 14720, 2010, 15910, 0, 5727.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64786', '2025-01-22', 594, 24880, 11560, 1485, 11835, 0, 4260.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65078', '2025-01-22', 510, 20080, 8700, 1275, 10105, 0, 3637.8, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '66300', '2025-01-22', null, null, null, null, 0, 12940, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '61251', '2025-01-22', null, null, null, null, 0, 10900, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '53089', '2025-01-22', null, null, null, null, 0, 14400, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '53092', '2025-01-23', null, null, null, null, 0, 13350, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '53091', '2025-01-23', null, null, null, null, 0, 13200, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '53090', '2025-01-23', null, null, null, null, 0, 13800, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64787', '2025-01-23', 594, 24780, 11560, 1485, 11735, 0, 4224.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '66763', '2025-01-23', 804, 32620, 14720, 2010, 15890, 0, 5720.4, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65764', '2025-01-23', 804, 32600, 14720, 2010, 15870, 0, 5713.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64788', '2025-01-23', 594, 24740, 11560, 1485, 11695, 0, 4210.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65079', '2025-01-27', 510, 19960, 8700, 1275, 9985, 0, 3594.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64789', '2025-01-27', 594, 24700, 11560, 1485, 11655, 0, 4195.8, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64856', '2025-01-27', null, null, null, null, 0, 11880, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65080', '2025-01-27', 510, 19860, 8700, 1275, 9885, 0, 3558.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64790', '2025-01-27', 597, 24700, 11560, 1492.5, 11648, 0, 4193.1, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '61671', '2025-01-27', 594, 23820, 10460, 1485, 11875, 0, 4275, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64792', '2025-01-28', 594, 24740, 11560, 1485, 11695, 0, 4210.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65356', '2025-01-28', 659, 25140, 10440, 1648, 13053, 0, 4698.9, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65082', '2025-01-28', 510, 20120, 8700, 1275, 10145, 0, 3652.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '65081', '2025-01-28', 510, 19920, 8700, 1275, 9945, 0, 3580.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64791', '2025-01-28', 594, 24780, 11560, 1485, 11735, 0, 4224.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64859', '2025-01-28', null, null, null, null, 0, 10742, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)', '64857', '2025-01-28', null, null, null, null, 0, 11880, null, null),
  -- VALLADOLISES.--MªTERESA 2026: 31 albaranes
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '70148', '2026-02-02', null, null, null, null, 12054, 0, 7232.4, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '70149', '2026-02-02', null, null, null, null, 11299, 0, 6779.4, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '70110', '2026-02-05', null, null, null, null, 11298, 0, 6778.8, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113758', '2026-02-05', 510, 19760, 8725, 1275, 9760, 0, 5856, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113984', '2026-02-05', 912, 35180, 15665, 2280, 17235, 0, 10341, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '70111', '2026-02-05', null, null, null, null, 11053, 0, 6631.8, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113760', '2026-02-06', 510, 19780, 8790, 1275, 9715, 0, 5829, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '71428', '2026-02-06', null, null, null, null, 12170, 0, 7302, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113160', '2026-02-06', 900, 34720, 15200, 2250, 17270, 0, 10362, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113761', '2026-02-06', 510, 19780, 8790, 1275, 9715, 0, 5829, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113762', '2026-02-06', 510, 19760, 8790, 1275, 9695, 0, 5817, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113115', '2026-02-07', 594, 24400, 11630, 1485, 11285, 0, 6771, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113763', '2026-02-07', 510, 19720, 8710, 1275, 9735, 0, 5841, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113092', '2026-02-07', 594, 24540, 11700, 1485, 11355, 0, 6813, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113116', '2026-02-07', 594, 24400, 11630, 1485, 11285, 0, 6771, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '70118', '2026-02-07', null, null, null, null, 6366, 0, 3819.6, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '70117', '2026-02-07', null, null, null, null, 12193, 0, 7315.8, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113764', '2026-02-07', 510, 19680, 8710, 1275, 9695, 0, 5817, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113091', '2026-02-07', 594, 24480, 11700, 1485, 11295, 0, 6777, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113766', '2026-02-09', 510, 19880, 8780, 1275, 9825, 0, 5895, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113765', '2026-02-09', 510, 19840, 8780, 1275, 9785, 0, 5871, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113165', '2026-02-09', 900, 34620, 14940, 2250, 17430, 0, 10458, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113768', '2026-02-10', 510, 19820, 8750, 1275, 9795, 0, 5877, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113767', '2026-02-10', 510, 19860, 8750, 1275, 9835, 0, 5901, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '70029', '2026-02-10', null, null, null, null, 12293, 0, 7375.8, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113167', '2026-02-10', 900, 34420, 14880, 2250, 17290, 0, 10374, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '70033', '2026-02-11', null, null, null, null, 8180, 0, 4908, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '71431', '2026-02-11', null, null, null, null, 12008, 0, 7204.8, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113171', '2026-02-11', 900, 34840, 15360, 2250, 17230, 0, 10338, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113122', '2026-02-11', 594, 24540, 11660, 1485, 11395, 0, 6837, null),
  ('2025/26', 'Valladolises', null, 'Maite', 'VALLADOLISES.--MªTERESA 2026', '113121', '2026-02-11', 594, 24480, 11160, 1485, 11635, 0, 6981, null),
  -- 3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026: 22 albaranes
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '71359', '2026-02-24', null, null, null, null, 11528, 0, 6916.8, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117939', '2026-02-24', 594, 24320, 11560, 1485, 11275, 0, 6765, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '71360', '2026-02-24', null, null, null, null, 9646, 0, 5787.6, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '113785', '2026-02-24', 510, 19740, 8710, 1275, 9755, 0, 5853, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117940', '2026-02-24', 604, 24540, 11560, 1510, 11470, 0, 6882, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '71361', '2026-02-25', null, null, null, null, 11005, 0, 6603, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '113787', '2026-02-25', 510, 19600, 8750, 1275, 9575, 0, 5745, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117941', '2026-02-25', 594, 24280, 11610, 1485, 11185, 0, 6711, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117941', '2026-02-25', 598, 24460, 11610, 1495, 11355, 0, 6813, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '71364', '2026-02-26', null, null, null, null, 11804, 0, 7082.4, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '71363', '2026-02-26', null, null, null, null, 11985, 0, 7191, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117944', '2026-02-26', 594, 24260, 11600, 1485, 11175, 0, 6705, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117945', '2026-02-26', 595, 24220, 11600, 1487.5, 11133, 0, 6679.5, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '71366', '2026-02-26', null, null, null, null, 11325, 0, 6795, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '113789', '2026-02-26', 510, 19580, 8740, 1275, 9565, 0, 5739, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '71368', '2026-02-27', null, null, null, null, 11750, 0, 7050, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117947', '2026-02-27', 594, 24320, 11630, 1485, 11205, 0, 6723, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117896', '2026-02-27', 594, 24260, 11580, 1485, 11195, 0, 6717, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117946', '2026-02-27', 594, 24260, 11630, 1485, 11145, 0, 6687, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117895', '2026-02-27', 594, 24200, 11580, 1485, 11135, 0, 6681, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '117948', '2026-02-27', 634, 21600, 11630, 1585, 8385, 0, 5031, null),
  ('2025/26', null, 3, 'JHSYO', '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026', '713773', '2026-02-27', null, null, null, null, 9160, 0, 5496, 'En la hoja pone «27-7»: fecha corregida a la del albarán anterior.')
) as v(campana, finca, corte, titular, hoja, albaran, fecha, cajas, bruto, tara_c, tara_k, kg_b, kg_c, importe, notas)
left join public.fincas f on f.nombre = v.finca
left join public.titulares t on t.nombre = v.titular
where not exists (select 1 from public.albaranes a where a.hoja = v.hoja and not a.anulado);

-- Comprobación: kilos por hoja
select campana, hoja, count(*) as camiones, sum(kg_buenos) as kg_buenos, sum(kg_citrica) as kg_citrica, sum(importe_eur) as importe
from public.albaranes where not anulado group by campana, hoja order by campana, hoja;

-- Fin de la migración 0020
