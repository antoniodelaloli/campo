-- =====================================================================
-- CAMPO · Migración 0020: albaranes de báscula (las hojas de cada corte)
-- Cada fila es un camión: albarán, fecha, cajas, pesada, kilos buenos, kilos de
-- cítrica (destrío) e importe, con la campaña, la finca, el corte y a nombre de
-- quién va. Es de donde se sacan los kilos de cada finca (las facturas dicen a
-- nombre de quién, pero no siempre de qué finca salió el limón).
-- Se meten también las 9 hojas buenas de los Excel de Juan Carlos (5/11/2026):
--   2024/25: Corvera 1º corte de Carlos y de Maite; Valladolises 1º y 2º corte (JHSYO)
--   2025/26: las cinco hojas del año (finca por confirmar)
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

-- Las hojas buenas de la carpeta de Excel de Juan Carlos (5/11/2026) ----------
-- De cada corte y persona se ha cogido la versión más completa (ver
-- docs/albaranes-excel.md). En 2025/26 la finca queda «por confirmar»: los
-- nombres de los archivos dicen Valladolises, pero los kilos no cuadran con la
-- liquidación si todo fuera de Valladolises.

-- Si se ejecutó la primera versión de esta migración, sus tres hojas se anulan
-- (se sustituyen por las de abajo, sacadas de los Excel originales).
update public.albaranes set anulado = true
 where origen = 'import' and not anulado
   and hoja in ('LIMON - CORVERA 2024-2025 · 1º CORTE (todos a nombre de Mª Teresa)',
                'VALLADOLISES.--MªTERESA 2026',
                '3er. CORTE JUAN HERNANDEZ SAEZ Y OTROS SC. 2026');

insert into public.albaranes
  (campana, finca_id, corte, titular_id, hoja, albaran, fecha, cajas, bruto_kg, tara_camion_kg, tara_cajas_kg,
   kg_buenos, kg_citrica, importe_eur, notas, origen)
select v.campana, f.id, v.corte, t.id, v.hoja, v.albaran, v.fecha::date, v.cajas, v.bruto, v.tara_c, v.tara_k,
       v.kg_b, v.kg_c, v.importe, v.notas, 'import'
from (values
  -- Corvera 2024-2025 1er CORTE JUAN CARLOS: 78 albaranes, 559227.5 kg buenos, 317581 kg cítrica
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '58563', '2024-12-24', null, null, null, null, 0, 12220, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '58562', '2024-12-24', null, null, null, null, 0, 11680, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66178', '2024-12-24', null, null, null, null, 0, 12440, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66176', '2024-12-24', null, null, null, null, 0, 11320, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '58561', '2024-12-24', null, null, null, null, 0, 13460, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66175', '2024-12-24', null, null, null, null, 0, 12700, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65041', '2024-12-27', 510, 20180, 8700, 1275, 10205, 0, 3673.8, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65042', '2024-12-27', 462, 19120, 8700, 1155, 9265, 0, 3335.4, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64845', '2024-12-27', 594, 24880, 11560, 1485, 11835, 0, 4260.6, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64847', '2024-12-27', 531, 23440, 11560, 1327.5, 10552.5, 0, 3798.9, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64846', '2024-12-27', 594, 24840, 11560, 1485, 11795, 0, 4246.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '61079', '2024-12-28', null, null, null, null, 0, 12200, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '61078', '2024-12-28', null, null, null, null, 0, 10180, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '61077', '2024-12-28', null, null, null, null, 0, 10220, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '61076', '2024-12-28', null, null, null, null, 0, 9120, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66187', '2024-12-28', null, null, null, null, 0, 11020, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66188', '2024-12-28', null, null, null, null, 0, 10840, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66189', '2024-12-28', null, null, null, null, 0, 11060, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66190', '2024-12-28', null, null, null, null, 0, 11940, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65044', '2024-12-30', 510, 20160, 8700, 1275, 10185, 0, 3666.6, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64848', '2024-12-30', 594, 24840, 11560, 1485, 11795, 0, 4246.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65045', '2024-12-30', 510, 20200, 8700, 1275, 10225, 0, 3681, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65043', '2024-12-30', 510, 20120, 8700, 1275, 10145, 0, 3652.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64849', '2024-12-30', 594, 24900, 11560, 1485, 11855, 0, 4267.8, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66368', '2024-12-30', null, null, null, null, 0, 12620, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66194', '2024-12-31', null, null, null, null, 0, 12680, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64850', '2024-12-31', 594, 24900, 11560, 1485, 11855, 0, 4267.8, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65046', '2024-12-31', 510, 20140, 8700, 1275, 10165, 0, 3659.4, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65047', '2025-01-02', 510, 20120, 8700, 1275, 10145, 0, 3652.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '68286', '2025-01-31', 699, 27620, 11900, 1747.5, 13972.5, 0, 5030.1, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64754', '2025-01-02', 594, 24880, 11560, 1485, 11835, 0, 4260.6, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66372', '2025-01-02', null, null, null, null, 0, 13480, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64755', '2025-01-02', 594, 24980, 11560, 1485, 11935, 0, 4296.6, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '60249', '2025-01-02', 510, 19600, 8160, 1275, 10165, 0, 3659.4, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65048', '2025-01-02', 510, 20220, 8700, 1275, 10245, 0, 3688.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '58581', '2025-01-03', null, null, null, null, 0, 13300, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64756', '2025-01-03', 594, 24780, 11560, 1485, 11735, 0, 4224.6, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65049', '2025-01-03', 510, 20180, 8700, 1275, 10205, 0, 3673.8, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64757', '2025-01-03', 594, 24740, 11560, 1485, 11695, 0, 4210.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64758', '2025-01-03', 432, 21260, 11560, 1080, 8620, 0, 3103.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65050', '2025-01-03', 510, 20160, 8700, 1275, 10185, 0, 3666.6, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65267', '2025-01-03', 465, 21640, 11300, 1162.5, 9177.5, 0, 3303.9, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66254', '2025-01-03', null, null, null, null, 0, 13280, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64759', '2025-01-07', 594, 24820, 11560, 1485, 11775, 0, 4239, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65052', '2025-01-07', 510, 20100, 8700, 1275, 10125, 0, 3645, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65051', '2025-01-07', 510, 20080, 8700, 1275, 10105, 0, 3637.8, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '58589', '2025-01-07', null, null, null, null, 0, 13600, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65053', '2025-01-07', 510, 20060, 8700, 1275, 10085, 0, 3630.6, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64760', '2025-01-07', 594, 24820, 11560, 1485, 11775, 0, 4239, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '61099', '2025-01-08', null, null, null, null, 0, 13220, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66259', '2025-01-08', null, null, null, null, 0, 13220, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64761', '2025-01-08', 594, 24660, 11560, 1485, 11615, 0, 4181.4, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65054', '2025-01-08', 510, 20040, 8700, 1275, 10065, 0, 3623.4, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64762', '2025-01-08', 594, 24600, 11560, 1485, 11555, 0, 4159.8, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64764', '2025-01-09', 594, 24820, 11560, 1485, 11775, 0, 4239, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65056', '2025-01-09', 510, 20200, 8700, 1275, 10225, 0, 3681, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65057', '2025-01-09', 510, 19980, 8700, 1275, 10005, 0, 3601.8, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '68092', '2025-01-08', 509, 19280, 8100, 1272.5, 9907.5, 0, 3566.7, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65055', '2025-01-08', 510, 20120, 8700, 1275, 10145, 0, 3652.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64763', '2025-01-08', 594, 24680, 11560, 1485, 11635, 0, 4188.6, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64765', '2025-01-09', 594, 24640, 11560, 1485, 11595, 0, 4174.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65058', '2025-01-09', 510, 20140, 8700, 1275, 10165, 0, 3659.4, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64257', '2025-01-09', 702, 26740, 10940, 1755, 14045, 0, 5056.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66266', '2025-01-09', null, null, null, null, 0, 10260, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '46163', '2025-01-10', 687, 28420, 13000, 1717.5, 13702.5, 0, 4932.9, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64768', '2025-01-10', 594, 24760, 11560, 1485, 11715, 0, 4217.4, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65060', '2025-01-10', 510, 20100, 8700, 1275, 10125, 0, 3645, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64767', '2025-01-10', 594, 24680, 11560, 1485, 11635, 0, 4188.6, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65059', '2025-01-10', 510, 20140, 8700, 1275, 10165, 0, 3659.4, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64766', '2025-01-10', 594, 24760, 11560, 1485, 11715, 0, 4217.4, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66270', '2025-01-10', null, null, null, null, 0, 14000, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', 's/n', '2025-01-10', null, null, null, null, 0, 9720, null, 'En la hoja no tiene nº de albarán: se pone la fecha del anterior.'),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65061', '2025-01-11', 510, 20120, 8700, 1275, 10145, 0, 3652.2, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64769', '2025-01-11', 594, 24860, 11560, 1485, 11815, 0, 4253.4, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '65062', '2025-01-11', 510, 20000, 8700, 1275, 10025, 0, 3609, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '64770', '2025-01-11', 594, 24840, 11560, 1485, 11795, 0, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66278', '2025-01-11', null, null, null, null, 0, 6040, null, null),
  ('2024/25', 'Corvera', 1, 'Carlos', 'Corvera 2024-2025 1er CORTE JUAN CARLOS', '66277', '2025-01-11', null, null, null, null, 0, 11761, null, null),

  -- Corvera 2024-2025 1er CORTE MªTERESA: 42 albaranes, 335260 kg buenos, 161072 kg cítrica
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '53085', '2025-01-15', null, null, null, null, 0, 12040, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '66428', '2025-01-20', null, null, null, null, 0, 12980, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '66430', '2025-01-20', null, null, null, null, 0, 11860, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '669429', '2025-01-20', null, null, null, null, 0, 11100, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64781', '2025-01-20', 594, 24780, 11560, 1485, 11735, 0, 4224.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64780', '2025-01-20', 594, 24780, 11560, 1485, 11735, 0, 4224.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65071', '2025-01-20', 510, 20060, 8700, 1275, 10085, 0, 3630.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65073', '2025-01-20', 510, 20040, 8700, 1275, 10065, 0, 3623.4, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64782', '2025-01-20', 594, 24720, 11560, 1485, 11675, 0, 4203, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65075', '2025-01-21', 510, 19980, 8700, 1275, 10005, 0, 3601.8, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64783', '2025-01-21', 594, 24660, 11560, 1485, 11615, 0, 4181.4, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65074', '2025-01-21', 510, 20020, 8700, 1275, 10045, 0, 3616.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65076', '2025-01-21', 510, 20060, 8700, 1275, 10085, 0, 3630.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64784', '2025-01-21', 594, 24580, 11560, 1485, 11535, 0, 4152.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64785', '2025-01-22', 594, 25000, 11560, 1485, 11955, 0, 4303.8, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65077', '2025-01-22', 510, 20040, 8700, 1275, 10065, 0, 3623.4, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65762', '2025-01-22', 804, 32640, 14720, 2010, 15910, 0, 5727.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64786', '2025-01-22', 594, 24880, 11560, 1485, 11835, 0, 4260.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65078', '2025-01-22', 510, 20080, 8700, 1275, 10105, 0, 3637.8, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '66300', '2025-01-22', null, null, null, null, 0, 12940, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '61251', '2025-01-22', null, null, null, null, 0, 10900, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '53089', '2025-01-22', null, null, null, null, 0, 14400, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '53092', '2025-01-23', null, null, null, null, 0, 13350, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '53091', '2025-01-23', null, null, null, null, 0, 13200, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '53090', '2025-01-23', null, null, null, null, 0, 13800, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64787', '2025-01-23', 594, 24780, 11560, 1485, 11735, 0, 4224.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '66763', '2025-01-23', 804, 32620, 14720, 2010, 15890, 0, 5720.4, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65764', '2025-01-23', 804, 32600, 14720, 2010, 15870, 0, 5713.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64788', '2025-01-23', 594, 24740, 11560, 1485, 11695, 0, 4210.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65079', '2025-01-27', 510, 19960, 8700, 1275, 9985, 0, 3594.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64789', '2025-01-27', 594, 24700, 11560, 1485, 11655, 0, 4195.8, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64856', '2025-01-27', null, null, null, null, 0, 11880, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65080', '2025-01-27', 510, 19860, 8700, 1275, 9885, 0, 3558.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64790', '2025-01-27', 597, 24700, 11560, 1492.5, 11647.5, 0, 4193.1, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '61671', '2025-01-27', 594, 23820, 10460, 1485, 11875, 0, 4275, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64792', '2025-01-28', 594, 24740, 11560, 1485, 11695, 0, 4210.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65356', '2025-01-28', 659, 25140, 10440, 1647.5, 13052.5, 0, 4698.9, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65082', '2025-01-28', 510, 20120, 8700, 1275, 10145, 0, 3652.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '65081', '2025-01-28', 510, 19920, 8700, 1275, 9945, 0, 3580.2, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64791', '2025-01-28', 594, 24780, 11560, 1485, 11735, 0, 4224.6, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64859', '2025-01-28', null, null, null, null, 0, 10742, null, null),
  ('2024/25', 'Corvera', 1, 'Maite', 'Corvera 2024-2025 1er CORTE MªTERESA', '64857', '2025-01-28', null, null, null, null, 0, 11880, null, null),

  -- JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024): 16 albaranes, 175110 kg buenos
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '64912', '2024-10-28', 419, 22420, 11900, 1162.5, 9357.5, 0, 5801.65, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63363', '2024-10-28', 558, 24780, 11560, 1485, 11735, 0, 7275.7, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63364', '2024-10-30', 564, 24660, 11560, 1485, 11615, 0, 7201.3, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63365', '2024-10-30', 594, 24640, 11560, 1485, 11595, 0, 7188.9, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63464', '2024-10-30', 474, 19940, 8700, 1275, 9965, 0, 6178.3, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63366', '2024-10-30', 594, 24580, 11560, 1485, 11535, 0, 7151.7, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63368', '2024-10-31', 564, 24800, 11560, 1485, 11755, 0, 7288.1, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63465', '2024-10-31', 474, 19980, 8700, 1275, 10005, 0, 6203.1, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63367', '2024-10-31', 474, 24720, 11560, 1485, 11675, 0, 7238.5, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63466', '2024-10-31', 450, 20040, 8700, 1275, 10065, 0, 6240.3, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63369', '2024-10-31', 558, 25320, 11560, 1555, 12205, 0, 7567.1, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63371', '2024-11-04', 594, 24780, 11560, 1485, 11735, 0, 7275.7, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63470', '2024-11-04', 487, 20060, 8700, 1277.5, 10082.5, 0, 6251.15, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63468', '2024-11-04', 480, 20020, 8700, 1275, 10045, 0, 6227.9, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63370', '2024-11-04', 534, 24740, 11560, 1485, 11695, 0, 7250.9, null),
  ('2024/25', 'Valladolises', 1, 'JHSYO', 'JHSYO-corte 2024-2025 (Valladolises, oct-nov 2024)', '63469', '2024-11-04', 462, 20020, 8700, 1275, 10045, 0, 6227.9, null),

  -- JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025): 45 albaranes, 495162.5 kg buenos
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '68754', '2025-03-10', 504, 19280, 8740, 1260, 9280, 0, 3897.6, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65542', '2025-03-10', 510, 19480, 8700, 1275, 9505, 0, 3992.1, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65509', '2025-03-10', 594, 24140, 11560, 1485, 11095, 0, 4659.9, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64543', '2025-03-10', 510, 19460, 8700, 1275, 9485, 0, 3983.7, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '68334', '2025-03-10', 702, 26140, 10940, 1755, 13445, 0, 5646.9, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64544', '2025-03-10', 510, 19740, 8700, 1275, 9765, 0, 4101.3, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65510', '2025-03-10', 594, 24140, 11560, 1485, 11095, 0, 4659.9, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64572', '2025-03-10', null, null, null, null, 14560, 0, null, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64573', '2025-03-11', null, null, null, null, 12880, 0, null, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65512', '2025-03-11', 594, 24340, 11560, 1485, 11295, 0, 4743.9, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64546', '2025-03-11', 510, 19600, 8700, 1275, 9625, 0, 4042.5, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65511', '2025-03-11', 594, 24460, 11560, 1485, 11415, 0, 4794.3, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65513', '2025-03-11', 602, 24680, 11560, 1505, 11615, 0, 4878.3, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64336', '2025-03-11', 683, 26320, 11660, 1707.5, 12952.5, 0, 5440.05, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64545', '2025-03-11', 510, 19800, 8700, 1275, 9825, 0, 4126.5, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64549', '2025-03-13', 510, 19560, 8700, 1275, 9585, 0, 4025.7, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64550', '2025-03-13', 510, 19700, 8700, 1275, 9725, 0, 4084.5, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65518', '2025-03-13', 666, 25720, 11560, 1665, 12495, 0, 5247.9, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '66499', '2025-03-13', null, null, null, null, 11580, 0, null, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '68196', '2025-03-13', 528, 22460, 11040, 1320, 10100, 0, 4242, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65484', '2025-03-13', 280, 14040, 8100, 700, 5240, 0, 2200.8, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '66688', '2025-03-14', null, null, null, null, 11480, 0, 4821.6, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64337', '2025-03-14', 678, 26240, 11660, 1695, 12885, 0, 5411.7, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '67301', '2025-03-14', 510, 19660, 8700, 1275, 9685, 0, 4067.7, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '68342', '2025-03-14', 702, 25940, 10940, 1755, 13245, 0, 5562.9, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '68198', '2025-03-14', 682, 25600, 11040, 1705, 12855, 0, 5399.1, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '67302', '2025-03-14', 510, 19620, 8700, 1275, 9645, 0, 4050.9, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64575', '2025-03-18', null, null, null, null, 6560, 0, 2755.2, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65524', '2025-03-18', 594, 24200, 11560, 1485, 11155, 0, 4685.1, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65525', '2025-03-18', 426, 20720, 11560, 1065, 8095, 0, 3399.9, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '68532', '2025-03-18', 816, 32000, 14720, 2040, 15240, 0, 6400.8, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '63517', '2025-03-18', 678, 25220, 10800, 1695, 12725, 0, 5344.5, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '63518', '2025-03-18', 429, 20000, 10800, 1072.5, 8127.5, 0, 3413.55, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '64576', '2025-03-19', null, null, null, null, 12160, 0, 5107.2, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '63519', '2025-03-19', 678, 25320, 10800, 1695, 12825, 0, 5386.5, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '63520', '2025-03-19', 678, 25340, 10800, 1695, 12845, 0, 5394.9, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '68347', '2025-03-19', 702, 25800, 10940, 1755, 13105, 0, 5504.1, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65527', '2025-03-19', 594, 24160, 11560, 1485, 11115, 0, 4668.3, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '63521', '2025-03-19', 678, 25220, 10800, 1695, 12725, 0, 5344.5, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65526', '2025-03-19', 594, 24020, 11560, 1485, 10975, 0, 4609.5, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '67313', '2025-03-20', 510, 19540, 8700, 1275, 9565, 0, 4017.3, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65529', '2025-03-20', 594, 24220, 11560, 1485, 11175, 0, 4693.5, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65530', '2025-03-20', 594, 24180, 11560, 1485, 11135, 0, 4676.7, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '65531', '2025-03-20', 673, 24920, 11560, 1682.5, 11677.5, 0, 4904.55, null),
  ('2024/25', 'Valladolises', 2, 'JHSYO', 'JHSYO-2ºCORTE 2025 (Valladolises, marzo 2025)', '66864', '2025-03-20', null, null, null, null, 7600, 0, 3192, null),

  -- VALLADOLISES 25-26 0,60 € (1-5 dic 2025): 24 albaranes, 291432.5 kg buenos
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '72561', '2025-12-01', 594, 24560, 11600, 1485, 11475, 0, 6885, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '72562', '2025-12-01', 594, 24620, 11600, 1485, 11535, 0, 6921, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '69821', '2025-12-01', 702, 26660, 11120, 1755, 13785, 0, 8271, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '77761', '2025-12-02', 636, 24700, 10600, 1590, 12510, 0, 7506, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '77760', '2025-12-02', 636, 24680, 10600, 1590, 12490, 0, 7494, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '72563', '2025-12-02', 594, 24700, 11600, 1485, 11615, 0, 6969, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '77762', '2025-12-03', 636, 24680, 10600, 1590, 12490, 0, 7494, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '76123', '2025-12-03', 510, 19460, 8120, 1275, 10065, 0, 6039, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '72639', '2025-12-03', 804, 32800, 14720, 2010, 16070, 0, 9642, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '76124', '2025-12-03', 522, 19700, 8120, 1305, 10275, 0, 6165, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '72640', '2025-12-03', 804, 32860, 14720, 2010, 16130, 0, 9678, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '77763', '2025-12-03', 636, 24520, 10600, 1590, 12330, 0, 7398, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '76291', '2025-12-03', 594, 24520, 11600, 1485, 11435, 0, 6861, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '74154', '2025-12-03', 900, 35300, 15340, 2250, 17710, 0, 10626, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '70411', '2025-12-03', null, null, null, null, 4688, 0, 2812, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '70172', '2025-12-03', null, null, null, null, 8851, 0, 5310, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '69827', '2025-12-04', 702, 26380, 10940, 1755, 13685, 0, 8211, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '69828', '2025-12-04', 702, 26420, 10940, 1755, 13725, 0, 8235, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '77764', '2025-12-04', 636, 24660, 10600, 1590, 12470, 0, 7482, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '69829', '2025-12-05', 702, 26640, 10940, 1755, 13945, 0, 8367, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '69830', '2025-12-05', 702, 26640, 10940, 1755, 13945, 0, 8367, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '72566', '2025-12-05', 594, 24760, 11600, 1485, 11675, 0, 7005, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '72567', '2025-12-05', 603, 24860, 11600, 1507.5, 11752.5, 0, 7051.5, null),
  ('2025/26', null, 1, 'JHSYO', 'VALLADOLISES 25-26 0,60 € (1-5 dic 2025)', '66833', '2025-12-05', null, null, null, null, 6781, 0, 4068, null),

  -- VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025): 13 albaranes, 162748.5 kg buenos
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '76297', '2025-12-09', 594, 24700, 11600, 1485, 11615, 0, 6969, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '73626', '2025-12-09', 678, 26260, 11040, 1695, 13525, 0, 8115, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '73627', '2025-12-09', 678, 26140, 11040, 1695, 13405, 0, 8043, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '76298', '2025-12-09', 594, 24760, 11600, 1485, 11675, 0, 7005, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '76299', '2025-12-10', 594, 24740, 11600, 1485, 11655, 0, 6993, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '63105', '2025-12-10', 678, 26600, 11660, 1695, 13245, 0, 7947, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '63104', '2025-12-10', 678, 26640, 11660, 1695, 13285, 0, 7971, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '63106', '2025-12-11', 678, 26820, 11660, 1695, 13465, 0, 8079, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '76300', '2025-12-10', 594, 24740, 11600, 1485, 11655, 0, 6993, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '63107', '2025-12-11', 678, 26700, 11660, 1695, 13345, 0, 8007, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '74983', '2025-12-11', 523, 19680, 8160, 1307.5, 10212.5, 0, 6127.5, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '72111', '2025-12-12', 720, 28040, 11900, 1800, 14340, 0, 8604, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES 25-26 0,60 MAITE (9-12 dic 2025)', '70415', '2025-12-11', null, null, null, null, 11326, 0, 6795.6, null),

  -- VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026): 35 albaranes, 441332 kg buenos
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75502', '2025-12-12', 594, 24720, 11600, 1485, 11635, 0, 6981, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75501', '2025-12-12', 594, 24780, 11600, 1485, 11695, 0, 7017, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '70227', '2025-12-12', null, null, null, null, 4362, 0, 2617.2, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75503', '2025-12-12', 603, 24940, 11600, 1507.5, 11832.5, 0, 7099.5, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '72582', '2025-12-17', 594, 24660, 11600, 1485, 11575, 0, 6945, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '72581', '2025-12-17', 594, 24700, 11600, 1485, 11615, 0, 6969, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '63113', '2025-12-17', 678, 26820, 11660, 1695, 13465, 0, 8079, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '63114', '2025-12-17', 678, 26700, 11660, 1695, 13345, 0, 8007, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '72583', '2025-12-18', 594, 24600, 11600, 1485, 11515, 0, 6909, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '63115', '2025-12-18', 678, 26580, 11660, 1695, 13225, 0, 7935, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '63116', '2025-12-18', 678, 26640, 11660, 1695, 13285, 0, 7971, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '72584', '2025-12-18', 594, 24580, 11600, 1485, 11495, 0, 6897, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '71632', '2025-12-19', 972, 36580, 15100, 2430, 19050, 0, 11430, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75509', '2025-12-19', 594, 24620, 11600, 1485, 11535, 0, 6921, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '70421', '2025-12-19', null, null, null, null, 9945, 0, 5967, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '71633', '2025-12-19', 972, 36600, 15100, 2430, 19070, 0, 11442, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75510', '2025-12-19', 597, 24560, 11600, 1492.5, 11467.5, 0, 6880.5, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '71634', '2025-12-22', 972, 36540, 15100, 2430, 19010, 0, 11406, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '62178', '2025-12-22', 510, 19280, 8100, 1275, 9905, 0, 5943, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75511', '2025-12-22', 594, 24620, 11600, 1485, 11535, 0, 6921, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '71635', '2025-12-22', 972, 36460, 15100, 2430, 18930, 0, 11017, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75512', '2025-12-23', 594, 24540, 11600, 1485, 11455, 0, 6873, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75513', '2025-12-23', 594, 24560, 11600, 1485, 11475, 0, 6885, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '69848', '2025-12-23', 702, 26500, 10940, 1755, 13805, 0, 8283, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75514', '2025-12-23', 602, 24680, 11600, 1505, 11575, 0, 6945, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75518', '2025-12-26', 594, 24680, 11600, 1485, 11595, 0, 6957, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75517', '2025-12-26', 594, 24560, 11600, 1485, 11475, 0, 6885, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '74175', '2025-12-26', 900, 35420, 15340, 2250, 17830, 0, 10698, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '74176', '2025-12-26', 760, 32540, 15340, 1900, 15300, 0, 8904.6, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75555', '2025-12-26', null, null, null, null, 9980, 0, 5988, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '72597', '2025-12-26', 594, 24620, 11600, 1485, 11535, 0, 6921, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75519', '2025-12-26', 596, 24580, 11600, 1490, 11490, 0, 6894, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '72596', '2025-12-26', 594, 24720, 11600, 1485, 11635, 0, 6981, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '74427', '2026-01-22', 594, 24520, 11700, 1485, 11335, 0, 6801, null),
  ('2025/26', null, null, 'JHSYO', 'VALLADOLISES 25-26 2 0,60 JHSYOTROS (12 dic 2025-22 ene 2026)', '75549', '2026-01-22', 594, 24520, 11680, 1485, 11355, 0, 6813, null),

  -- VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026): 31 albaranes, 361174 kg buenos
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '70148', '2026-02-02', null, null, null, null, 12054, 0, 7232.4, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '70149', '2026-02-02', null, null, null, null, 11299, 0, 6779.4, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '70110', '2026-02-05', null, null, null, null, 11298, 0, 6778.8, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113758', '2026-02-05', 510, 19760, 8725, 1275, 9760, 0, 5856, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113984', '2026-02-05', 912, 35180, 15665, 2280, 17235, 0, 10341, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '70111', '2026-02-05', null, null, null, null, 11053, 0, 6631.8, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113760', '2026-02-06', 510, 19780, 8790, 1275, 9715, 0, 5829, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '71428', '2026-02-06', null, null, null, null, 12170, 0, 7302, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113160', '2026-02-06', 900, 34720, 15200, 2250, 17270, 0, 10362, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113761', '2026-02-06', 510, 19780, 8790, 1275, 9715, 0, 5829, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113762', '2026-02-06', 510, 19760, 8790, 1275, 9695, 0, 5817, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113115', '2026-02-07', 594, 24400, 11630, 1485, 11285, 0, 6771, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113763', '2026-02-07', 510, 19720, 8710, 1275, 9735, 0, 5841, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113092', '2026-02-07', 594, 24540, 11700, 1485, 11355, 0, 6813, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113116', '2026-02-07', 594, 24400, 11630, 1485, 11285, 0, 6771, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '70118', '2026-02-07', null, null, null, null, 6366, 0, 3819.6, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '70117', '2026-02-07', null, null, null, null, 12193, 0, 7315.8, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113764', '2026-02-07', 510, 19680, 8710, 1275, 9695, 0, 5817, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113091', '2026-02-07', 594, 24480, 11700, 1485, 11295, 0, 6777, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113766', '2026-02-09', 510, 19880, 8780, 1275, 9825, 0, 5895, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113765', '2026-02-09', 510, 19840, 8780, 1275, 9785, 0, 5871, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113165', '2026-02-09', 900, 34620, 14940, 2250, 17430, 0, 10458, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113768', '2026-02-10', 510, 19820, 8750, 1275, 9795, 0, 5877, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113767', '2026-02-10', 510, 19860, 8750, 1275, 9835, 0, 5901, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '70029', '2026-02-10', null, null, null, null, 12293, 0, 7375.8, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113167', '2026-02-10', 900, 34420, 14880, 2250, 17290, 0, 10374, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '70033', '2026-02-11', null, null, null, null, 8180, 0, 4908, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '71431', '2026-02-11', null, null, null, null, 12008, 0, 7204.8, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113171', '2026-02-11', 900, 34840, 15360, 2250, 17230, 0, 10338, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113122', '2026-02-11', 594, 24540, 11660, 1485, 11395, 0, 6837, null),
  ('2025/26', null, null, 'Maite', 'VALLADOLISES.--MªTERESA 2026 (2-11 feb 2026)', '113121', '2026-02-11', 594, 24480, 11160, 1485, 11635, 0, 6981, null),

  -- 3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026): 22 albaranes, 237755.5 kg buenos
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '71359', '2026-02-24', null, null, null, null, 11528, 0, 6916.8, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117939', '2026-02-24', 594, 24320, 11560, 1485, 11275, 0, 6765, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '71360', '2026-02-24', null, null, null, null, 9646, 0, 5787.6, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '113785', '2026-02-24', 510, 19740, 8710, 1275, 9755, 0, 5853, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117940', '2026-02-24', 604, 24540, 11560, 1510, 11470, 0, 6882, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '71361', '2026-02-25', null, null, null, null, 11005, 0, 6603, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '113787', '2026-02-25', 510, 19600, 8750, 1275, 9575, 0, 5745, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117941', '2026-02-25', 594, 24280, 11610, 1485, 11185, 0, 6711, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117941', '2026-02-25', 598, 24460, 11610, 1495, 11355, 0, 6813, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '71364', '2026-02-26', null, null, null, null, 11804, 0, 7082.4, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '71363', '2026-02-26', null, null, null, null, 11985, 0, 7191, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117944', '2026-02-26', 594, 24260, 11600, 1485, 11175, 0, 6705, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117945', '2026-02-26', 595, 24220, 11600, 1487.5, 11132.5, 0, 6679.5, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '71366', '2026-02-26', null, null, null, null, 11325, 0, 6795, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '113789', '2026-02-26', 510, 19580, 8740, 1275, 9565, 0, 5739, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '71368', '2026-02-27', null, null, null, null, 11750, 0, 7050, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117947', '2026-02-27', 594, 24320, 11630, 1485, 11205, 0, 6723, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117896', '2026-02-27', 594, 24260, 11580, 1485, 11195, 0, 6717, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117946', '2026-02-27', 594, 24260, 11630, 1485, 11145, 0, 6687, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117895', '2026-02-27', 594, 24200, 11580, 1485, 11135, 0, 6681, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '117948', '2026-02-27', 634, 21600, 11630, 1585, 8385, 0, 5031, null),
  ('2025/26', null, 3, 'JHSYO', '3º CORTE LIMONES JHSYO 2026 (24-27 feb 2026)', '713773', '2026-02-27', null, null, null, null, 9160, 0, 5496, 'En la hoja pone «27-07-2026»: fecha corregida a la del albarán anterior.')
) as v(campana, finca, corte, titular, hoja, albaran, fecha, cajas, bruto, tara_c, tara_k, kg_b, kg_c, importe, notas)
left join public.fincas f on f.nombre = v.finca
left join public.titulares t on t.nombre = v.titular
where not exists (select 1 from public.albaranes a where a.hoja = v.hoja and not a.anulado);

-- Comprobación: kilos por hoja
select campana, hoja, count(*) as camiones, sum(kg_buenos) as kg_buenos, sum(kg_citrica) as kg_citrica, sum(importe_eur) as importe
from public.albaranes where not anulado group by campana, hoja order by campana, hoja;

-- Fin de la migración 0020
