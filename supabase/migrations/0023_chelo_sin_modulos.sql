-- =====================================================================
-- CAMPO · Migración 0023: quién está en módulos y quién factura
-- Dos marcas por titular:
--   en_modulos = tiene límite de 250.000 € (tarjeta en Cuentas y calculadora).
--   factura    = sale en los desplegables de «Se factura a».
-- Chelo ni factura ni está en módulos: solo aparece como socia de JHSYO
-- (Antonio, 7/11/2026). Sigue siendo socia (un tercio) para el reparto.
-- Requiere 0014 y 0021. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.titulares
  add column if not exists en_modulos boolean not null default true;

alter table public.titulares
  add column if not exists factura boolean not null default true;

comment on column public.titulares.en_modulos is
  'true = tiene límite de módulos (250.000 €/año). false = no va por módulos (Chelo, una comunidad de bienes y sus comuneros).';
comment on column public.titulares.factura is
  'true = factura a su nombre (sale en «Se factura a»). false = solo es socio o comunero (Chelo).';

update public.titulares
   set en_modulos = false,
       factura = false,
       notas = 'Socia de JHSYO (un tercio). No está en módulos ni factura a su nombre: solo aparece en la sociedad.'
 where nombre = 'Chelo';

select nombre, tipo, en_modulos, factura from public.titulares where activo order by nombre;

-- Fin de la migración 0023
