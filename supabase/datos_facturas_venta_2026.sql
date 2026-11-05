-- =====================================================================
-- CAMPO · Facturas de venta de 2026 (García Aranda) y una de luz de Corvera
-- Leídas de la carpeta de Drive de Antonio (5/11/2026). Se puede ejecutar más de
-- una vez: no duplica. Requiere las migraciones 0014 y 0015.
--
-- VENTAS (cuentan para el límite de módulos de 2026, año natural):
--   1. García Aranda → Maite (Mª Teresa Hernández García), 361.183,68 kg de limón.
--      La factura dice «Corvera» y así se guarda. Sus kilos son los de la hoja de
--      albaranes «VALLADOLISES.--MªTERESA» (361.174 kg, del 2 al 11/2/2026), pero
--      el análisis de todos los Excel apunta a que esa hoja es de Corvera (la
--      liquidación de 2025/26 no cuadra si fuera de Valladolises). Por confirmar.
--      Base 210.208,91 €, compensación 12 % 25.225,07 €,
--      retención IRPF 4.708,68 €, total a cobrar 230.725,30 €.
--      En la foto la fecha está cortada (solo se ve «…3/26»): es de marzo de 2026
--      y se pone el 02/03/2026, como la de Carlos. Para el límite da igual el día.
--   2. García Aranda → Carlos (Juan Carlos Hernández García), 02/03/2026,
--      352.723,40 kg de limón Primofiori a 0,582 €/kg (albaranes del 2 al 5/2/2026),
--      base 205.285,00 €, compensación 12 % 24.634,20 €, IRPF 4.598,38 €,
--      total a cobrar 225.320,82 €. Lugar de la explotación: «MURCIA»; se pone
--      Corvera. Puede ser parte de Corvera y parte de Valladolises: solo cambia el
--      coste y el margen por finca, no el límite de Carlos.
-- GASTO:
--   3. Axpo SCOMPW-26-0045437 (13/04/2026), luz de marzo de 2026 de Corvera
--      (Paraje Lomas del Villar), a nombre de Carlos: base 258,32 €, IVA 54,25 €.
-- =====================================================================

do $$
declare
  v_maite uuid;
  v_carlos uuid;
  v_corvera uuid;
  v_vall uuid;
begin
  select id into v_maite from public.titulares where nombre = 'Maite';
  select id into v_carlos from public.titulares where nombre = 'Carlos';
  select id into v_corvera from public.fincas where nombre = 'Corvera';
  select id into v_vall from public.fincas where nombre = 'Valladolises';
  if v_maite is null or v_carlos is null then
    raise exception 'No encuentro los titulares Maite y Carlos (¿falta la migración 0014?)';
  end if;

  insert into public.facturas
    (tipo, estado, titular_id, finca_id, campana, fecha, numero, contraparte, concepto, categoria,
     kg, base_eur, impuesto_eur, cuenta_limite, origen, notas)
  select v.tipo, 'emitida', v.titular, v.finca, '2025/26', v.fecha::date, v.numero, v.contraparte, v.concepto,
         v.categoria, v.kg, v.base, v.imp, v.tipo = 'venta', 'import', v.notas
  from (values
    ('venta', v_maite, v_corvera, '2026-03-02', null::text, 'García Aranda, S.L.',
     'Limón (361.183,68 kg buenos)', null::text, 361183.68, 210208.91, 25225.07,
     'Compensación agraria 12 %. Retención IRPF 4.708,68 €. Total a cobrar 230.725,30 €. Fecha cortada en la foto («…3/26»): es de marzo de 2026, el día es aproximado. La factura pone «Corvera». Sus kilos son los de la hoja de albaranes «VALLADOLISES.--MªTERESA» de febrero (361.174 kg): finca por confirmar con Juan Carlos. PDF: https://drive.google.com/file/d/18u3c5Hb7kmCFLjYAzr2f9LD_SrkFOgnL/view'),
    ('venta', v_carlos, v_corvera, '2026-03-02', null::text, 'García Aranda, S.L.',
     'Limón Primofiori, 352.723,40 kg a 0,582 €/kg (albaranes HUE 786 a 840, del 2 al 5/2/2026)', null::text,
     352723.40, 205285.00, 24634.20,
     'Compensación agraria 12 %. Retención IRPF 4.598,38 €. Total a cobrar 225.320,82 €. Lugar de la explotación «MURCIA»: puesta en Corvera; puede ser parte de Corvera y parte de Valladolises (por mirar). PDF: https://drive.google.com/file/d/1nbUxfqC7t4UENc7HtA_CPMZhKGuT2GtA/view'),
    ('gasto', v_carlos, v_corvera, '2026-04-13', 'SCOMPW-26-0045437', 'Axpo Iberia',
     'Luz de marzo de 2026 (01/03-31/03), tarifa 3.0TD, Paraje Lomas del Villar', 'luz', null::numeric, 258.32, 54.25,
     'IVA 21 %. Total 312,57 €. PDF: https://drive.google.com/file/d/1UwQ3SbO9tK_DsGy_gEmCKr7xdpym3Ueg/view')
  ) as v(tipo, titular, finca, fecha, numero, contraparte, concepto, categoria, kg, base, imp, notas)
  where not exists (
    select 1 from public.facturas f
    where f.tipo = v.tipo and f.titular_id = v.titular and f.contraparte = v.contraparte
      and f.fecha = v.fecha::date and f.base_eur = v.base and not f.anulado
  );

  -- Venta de Maite: si una versión anterior de este archivo la pasó a Valladolises,
  -- vuelve a Corvera (lo que dice la factura)
  update public.facturas
     set finca_id = v_corvera,
         notas = 'Compensación agraria 12 %. Retención IRPF 4.708,68 €. Total a cobrar 230.725,30 €. Fecha cortada en la foto («…3/26»): es de marzo de 2026, el día es aproximado. La factura pone «Corvera». Sus kilos son los de la hoja de albaranes «VALLADOLISES.--MªTERESA» de febrero (361.174 kg): finca por confirmar con Juan Carlos. PDF: https://drive.google.com/file/d/18u3c5Hb7kmCFLjYAzr2f9LD_SrkFOgnL/view'
   where tipo = 'venta' and titular_id = v_maite and base_eur = 210208.91 and finca_id is distinct from v_corvera;

  -- Ruraltech (si ya se metió con la nota antigua): tratamientos al 50 %
  update public.facturas
     set notas = replace(notas, 'Sin finca: por confirmar a cuál va.',
                         'Sin finca a propósito: los tratamientos se imputan al 50 % a Valladolises y Corvera.')
   where numero = '26F3789' and notas like '%por confirmar a cuál va%';
end;
$$;

-- Comprobación: ventas de 2026 por titular frente al límite de 250.000 €
select t.nombre,
       sum(f.base_eur) as ventas_base_2026,
       round(100 * sum(f.base_eur) / t.limite_eur, 1) as pct_limite,
       t.tope_seguridad_eur - sum(f.base_eur) as margen_hasta_tope
from public.facturas f
join public.titulares t on t.id = f.titular_id
where f.tipo = 'venta' and f.cuenta_limite and not f.anulado
  and f.fecha between '2026-01-01' and '2026-12-31'
group by t.nombre, t.limite_eur, t.tope_seguridad_eur
order by t.nombre;
