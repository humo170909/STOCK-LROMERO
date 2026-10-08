-- ============================================================================
-- 29_dashboard_resumen_seguro.sql                             (A-03, A-08)
-- fn_dashboard_resumen ahora:
--  * exige sesión (auth.uid()) y permiso ventas.ver;
--  * solo responde para sedes de la empresa del usuario (y, si no es
--    administrador/supervisor, solo su propia sede); si no cumple, devuelve 0 filas;
--  * calcula "el día" en hora de Perú (America/Lima), no en UTC.
-- Misma firma (uuid, date) y mismas columnas de salida. Idempotente.
-- ============================================================================

create or replace function public.fn_dashboard_resumen(p_sede_id uuid, p_fecha date default null)
returns table (
  ventas_dia         numeric,
  costo_dia          numeric,
  ganancia_dia       numeric,
  cantidad_ventas    bigint,
  productos_vendidos numeric,
  stock_critico      bigint,
  productos_agotados bigint
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with ctx as (
    select coalesce(p_fecha, (now() at time zone 'America/Lima')::date) as dia
    where auth.uid() is not null
      and public.has_permiso('ventas', 'ver')
      and exists (
        select 1 from public.sedes s
        where s.id = p_sede_id
          and s.empresa_id = public.mi_empresa_id()
          and (public.puede_ver_todas_las_sedes() or s.id = public.mi_sede_id())
      )
  ), v as (
    select vt.*
    from public.ventas vt, ctx
    where vt.sede_id = p_sede_id
      and vt.estado = 'confirmada'
      and (vt.fecha at time zone 'America/Lima')::date = ctx.dia
  )
  select
    coalesce((select sum(total) from v), 0),
    coalesce((select sum(costo_total) from v), 0),
    coalesce((select sum(ganancia_total) from v), 0),
    coalesce((select count(*) from v), 0),
    coalesce((select sum(vd.cantidad) from public.venta_detalles vd join v on v.id = vd.venta_id), 0),
    coalesce((select count(*) from public.inventario i
              where i.sede_id = p_sede_id and i.stock_actual > 0 and i.stock_actual <= i.stock_minimo), 0),
    coalesce((select count(*) from public.inventario i
              where i.sede_id = p_sede_id and i.stock_actual = 0), 0)
  from ctx;
$$;

revoke execute on function public.fn_dashboard_resumen(uuid, date) from public, anon;
grant execute on function public.fn_dashboard_resumen(uuid, date) to authenticated;
