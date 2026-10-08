-- ============================================================================
-- 21_views.sql
-- Las views heredan RLS de las tablas base (security_invoker), así que no hace
-- falta — ni conviene — crear policies aparte para ellas.
-- ============================================================================

create view public.v_stock_critico as
select
  i.id as inventario_id,
  i.sede_id,
  p.id as producto_id,
  p.empresa_id,
  p.codigo,
  p.nombre,
  i.stock_actual,
  i.stock_minimo,
  case
    when i.stock_actual <= 0 then 'agotado'
    when i.stock_actual <= i.stock_minimo then 'stock_bajo'
    else 'disponible'
  end as estado_stock
from public.inventario i
join public.productos p on p.id = i.producto_id
where p.deleted_at is null and i.stock_actual <= i.stock_minimo;

create view public.v_ventas_por_dia as
select
  v.sede_id,
  v.fecha::date as dia,
  count(*) as cantidad_ventas,
  sum(v.total) as total_vendido,
  sum(v.costo_total) as costo_total,
  sum(v.ganancia_total) as ganancia_total
from public.ventas v
where v.estado = 'confirmada'
group by v.sede_id, v.fecha::date;

create view public.v_ganancia_por_producto as
select
  vd.producto_id,
  p.empresa_id,
  p.codigo,
  p.nombre,
  sum(vd.cantidad) as cantidad_vendida,
  sum(vd.subtotal) as venta_total,
  sum(vd.costo_total) as costo_total,
  sum(vd.ganancia) as ganancia_total,
  case when sum(vd.subtotal) > 0
    then round(sum(vd.ganancia) / sum(vd.subtotal) * 100, 2)
    else 0
  end as margen_pct
from public.venta_detalles vd
join public.ventas v on v.id = vd.venta_id and v.estado = 'confirmada'
join public.productos p on p.id = vd.producto_id
group by vd.producto_id, p.empresa_id, p.codigo, p.nombre;

create view public.v_ventas_por_medio_pago as
select sede_id, medio_pago, fecha::date as dia, count(*) as cantidad_ventas, sum(total) as total_vendido
from public.ventas
where estado = 'confirmada'
group by sede_id, medio_pago, fecha::date;

create view public.v_ventas_por_trabajador as
select
  v.usuario_id,
  pr.nombre as nombre_usuario,
  v.sede_id,
  v.fecha::date as dia,
  count(*) as cantidad_ventas,
  sum(v.total) as total_vendido
from public.ventas v
join public.profiles pr on pr.id = v.usuario_id
where v.estado = 'confirmada'
group by v.usuario_id, pr.nombre, v.sede_id, v.fecha::date;

create view public.v_productos_mas_vendidos as
select
  vd.producto_id,
  p.nombre,
  p.empresa_id,
  sum(vd.cantidad) as cantidad_vendida,
  sum(vd.subtotal) as monto_vendido
from public.venta_detalles vd
join public.ventas v on v.id = vd.venta_id and v.estado = 'confirmada'
join public.productos p on p.id = vd.producto_id
group by vd.producto_id, p.nombre, p.empresa_id;
