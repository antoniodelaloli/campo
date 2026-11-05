-- =====================================================================
-- CAMPO · Migración 0021: socios de JHSYO y Chelo
-- JHSYO (Juan Hernández Sáez y otros S.C.) es de los tres hermanos a partes
-- iguales: Maite, Chelo y Juan Carlos (Antonio, 5/11/2026).
-- Para el límite de los módulos, a cada socio se le suman TODAS las ventas de la
-- sociedad, además de las suyas (Antonio, 5/11/2026). Para el reparto de
-- ingresos y beneficios, cada uno se lleva su tercio.
-- Requiere 0014 (titulares) y 0016 (rol administrativo). Se puede ejecutar más de una vez.
-- =====================================================================

insert into public.titulares (nombre, nombre_completo, tipo, notas) values
  ('Chelo', 'Chelo', 'persona', 'Socia de JHSYO (un tercio). No factura limón a su nombre.')
on conflict (nombre) do nothing;

update public.titulares
   set notas = 'Sociedad civil de los tres hermanos: Maite, Chelo y Juan Carlos, un tercio cada uno. Factura casi siempre Valladolises y paga casi todos los gastos. Sus ventas se suman al límite de cada socio.'
 where nombre = 'JHSYO';

create table if not exists public.titular_socios (
  sociedad_id   uuid not null references public.titulares (id) on delete cascade,
  socio_id      uuid not null references public.titulares (id) on delete cascade,
  participacion numeric(6,5) not null check (participacion > 0 and participacion <= 1),
  created_at    timestamptz not null default now(),
  primary key (sociedad_id, socio_id),
  check (sociedad_id <> socio_id)
);
comment on table public.titular_socios is 'Quién es socio de cada sociedad titular y con qué parte (1/3 = 0,33333).';

do $$
begin
  execute 'alter table public.titular_socios enable row level security';
  execute 'drop policy if exists titular_socios_select on public.titular_socios';
  execute 'create policy titular_socios_select on public.titular_socios for select to authenticated using ((select private.is_member()))';
  execute 'drop policy if exists titular_socios_insert on public.titular_socios';
  execute 'create policy titular_socios_insert on public.titular_socios for insert to authenticated with check ((select private.is_admin_writer()))';
  execute 'drop policy if exists titular_socios_update on public.titular_socios';
  execute 'create policy titular_socios_update on public.titular_socios for update to authenticated using ((select private.is_admin_writer())) with check ((select private.is_admin_writer()))';
end;
$$;

insert into public.titular_socios (sociedad_id, socio_id, participacion)
select s.id, p.id, 1.0 / 3
from public.titulares s
join public.titulares p on p.nombre in ('Maite', 'Chelo', 'Carlos')
where s.nombre = 'JHSYO'
on conflict (sociedad_id, socio_id) do update set participacion = excluded.participacion;

select s.nombre as sociedad, p.nombre as socio, round(ts.participacion * 100, 2) as pct
from public.titular_socios ts
join public.titulares s on s.id = ts.sociedad_id
join public.titulares p on p.id = ts.socio_id
order by p.nombre;

-- Fin de la migración 0021
