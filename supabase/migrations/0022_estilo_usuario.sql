-- =====================================================================
-- CAMPO · Migración 0022: estilo de la app por usuario
-- «granja» (el de siempre, pixel art) o «sobrio» (más realista, como el boceto
-- «Inicio · versión realista»). Antonio, 5/11/2026: el sobrio, para Juan Carlos.
-- Cada usuario puede cambiar el suyo desde la barra de arriba.
-- Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.profiles
  add column if not exists estilo text not null default 'granja';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_estilo_check') then
    alter table public.profiles add constraint profiles_estilo_check check (estilo in ('granja', 'sobrio'));
  end if;
end;
$$;

-- Cada uno cambia solo el suyo (la tabla profiles solo la puede editar un admin)
create or replace function public.cambiar_mi_estilo(nuevo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nuevo not in ('granja', 'sobrio') then
    raise exception 'Estilo no válido: %', nuevo;
  end if;
  update public.profiles set estilo = nuevo where id = (select auth.uid());
end;
$$;
revoke all on function public.cambiar_mi_estilo(text) from public, anon;
grant execute on function public.cambiar_mi_estilo(text) to authenticated;

-- Juan Carlos, con el estilo sobrio. Comprueba abajo que sale él (y solo él);
-- si no, cambia el «where» por su email.
update public.profiles set estilo = 'sobrio'
 where lower(coalesce(nombre, '')) like '%carlos%';

select email, nombre, rol, estilo from public.profiles order by nombre;

-- Fin de la migración 0022
