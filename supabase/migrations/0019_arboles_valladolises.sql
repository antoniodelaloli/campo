-- =====================================================================
-- CAMPO · Migración 0019: número de árboles de Valladolises
-- Juan Carlos, 4/11/2026: «unos 6.000 árboles» en Valladolises (aproximado).
-- Es un dato reciente, así que no lleva la nota de «dato antiguo».
-- Con esto, Cosecha ya calcula kilos y euros por árbol también en Valladolises.
-- =====================================================================

update public.fincas
   set n_arboles_aprox = 6000,
       arboles_nota = null
 where nombre = 'Valladolises';

select nombre, n_arboles_aprox, arboles_nota from public.fincas order by nombre;

-- Fin de la migración 0019
