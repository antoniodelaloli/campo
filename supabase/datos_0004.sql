-- =====================================================================
-- CAMPO · datos_0004.sql · Primera tarea colgada de su fecha clave
--
-- «Preparar el primer corte» pasa a pertenecer a «Primer corte de Valladolises».
-- Ejecutar DESPUÉS de 0004. Se puede lanzar más de una vez.
-- =====================================================================

update public.tareas t
   set hito_id = h.id
  from public.hitos h, public.fincas f
 where f.nombre = 'Valladolises'
   and t.finca_id = f.id
   and t.titulo = 'Preparar el primer corte'
   and h.titulo = 'Primer corte de Valladolises'
   and t.hito_id is null;
