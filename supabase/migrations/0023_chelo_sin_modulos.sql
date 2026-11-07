-- =====================================================================
-- CAMPO · Migración 0023: quién está en módulos
-- Chelo no está en módulos ni factura a su nombre: solo aparece como socia de
-- JHSYO (Antonio, 7/11/2026). Sigue siendo socia (un tercio) para el reparto,
-- pero no tiene límite de 250.000 €, no sale en la calculadora de «¿a nombre de
-- quién facturo?» ni en los desplegables de «Se factura a».
-- Requiere 0014 y 0021. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.titulares
  add column if not exists en_modulos boolean not null default true;

comment on column public.titulares.en_modulos is
  'true = factura a su nombre y tiene límite de módulos (250.000 €/año). false = solo es socio de una sociedad (Chelo).';

update public.titulares
   set en_modulos = false,
       notas = 'Socia de JHSYO (un tercio). No está en módulos ni factura a su nombre: solo aparece en la sociedad.'
 where nombre = 'Chelo';

select nombre, tipo, en_modulos from public.titulares where activo order by nombre;

-- Fin de la migración 0023
