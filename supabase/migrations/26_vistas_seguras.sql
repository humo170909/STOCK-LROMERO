-- ============================================================================
-- 26_vistas_seguras.sql                                     (C-01, A-08)
-- Las vistas se ejecutaban con los permisos de su dueño y se saltaban RLS.
-- Ahora usan security_invoker (respetan RLS del usuario que consulta; requiere
-- PostgreSQL 15+), se les quita el acceso a anon y los días se agrupan en hora
-- de Perú (America/Lima) en vez de UTC. Idempotente.
-- ============================================================================

create or replace view public.v_ventas_por_dia with (security_invoker = true) as
select
  v.sede_id,
  (v.fecha at time zone 'America/Lima')::date as dia,
  count(*) as cantidad_ventas,
  sum(v.total) as total_vendido,
  sum(v.costo_total) as costo_total,
  sum(v.ganancia_total) as ganancia_total
from public.ventas v
where v.estado = 'confirmada'
group by v.sede_id, (v.fecha at time zone 'America/Lima')::date;

create or replace view public.v_ventas_por_medio_pago with (security_invoker = true) as
select sede_id, medio_pago, (fecha at time zone 'America/Lima')::date as dia,
       count(*) as cantidad_ventas, sum(total) as total_vendido
from public.ventas
where estado = 'confirmada'
group by sede_id, medio_pago, (fecha at time zone 'America/Lima')::date;

create or replace view public.v_ventas_por_trabajador with (security_invoker = true) as
select
  v.usuario_id,
  pr.nombre as nombre_usuario,
  v.sede_id,
  (v.fecha at time zone 'America/Lima')::date as dia,
  count(*) as cantidad_ventas,
  sum(v.total) as total_vendido
from public.ventas v
join public.profiles pr on pr.id = v.usuario_id
where v.estado = 'confirmada'
group by v.usuario_id, pr.nombre, v.sede_id, (v.fecha at time zone 'America/Lima')::date;

alter view public.v_stock_critico          set (security_invoker = true);
alter view public.v_ganancia_por_producto  set (security_invoker = true);
alter view public.v_productos_mas_vendidos set (security_invoker = true);
alter view public.v_ventas_por_dia         set (security_invoker = true);
alter view public.v_ventas_por_medio_pago  set (security_invoker = true);
alter view public.v_ventas_por_trabajador  set (security_invoker = true);

revoke all on public.v_stock_critico, public.v_ventas_por_dia, public.v_ganancia_por_producto,
              public.v_ventas_por_medio_pago, public.v_ventas_por_trabajador,
              public.v_productos_mas_vendidos from anon, public;
grant select on public.v_stock_critico, public.v_ventas_por_dia, public.v_ganancia_por_producto,
                public.v_ventas_por_medio_pago, public.v_ventas_por_trabajador,
                public.v_productos_mas_vendidos to authenticated;
