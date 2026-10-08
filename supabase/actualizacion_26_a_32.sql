-- ============================================================================
-- ACTUALIZACIÓN 26 → 32 (para una base que YA tiene instaladas las migraciones 01..25)
-- Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
-- Es la suma ordenada de las migraciones 26..32. Se puede ejecutar dos veces sin dañar datos.
-- OJO: la 28 pasa a supervisor a cualquier usuario con rol vendedor/almacén/cajero.
-- Si instalas desde cero NO uses este archivo: usa 00_instalacion_completa.sql.
-- ============================================================================


-- >>>>>>>>>>>>>>>>>>>> 26_vistas_seguras.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 27_revocar_ejecucion_publica.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 27_revocar_ejecucion_publica.sql                           (A-03)
-- PostgreSQL concede EXECUTE a PUBLIC en cada función nueva y Supabase además lo
-- concede a anon. Aquí se revoca en todas las funciones existentes del esquema
-- public y en las futuras, y se concede solo a authenticated (+ service_role).
-- Las funciones de trigger no se invocan por API, pero también quedan cerradas.
-- Idempotente.
-- ============================================================================

revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
-- Funciones que creará el rol postgres/supabase_admin en el futuro:
do $$
begin
  execute 'alter default privileges for role postgres in schema public revoke execute on functions from public, anon';
exception when others then
  null; -- si el rol no existe o no hay permiso, el alter anterior ya cubre al rol actual
end;
$$;

grant execute on all functions in schema public to authenticated, service_role;

-- >>>>>>>>>>>>>>>>>>>> 28_roles_dos.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 28_roles_dos.sql                                     (C-02, decisiones 1-3)
-- El sistema queda con 2 roles: administrador y supervisor.
--  * administrador: las 7 acciones en los 14 módulos.
--  * supervisor: las 7 acciones en los 11 módulos de trabajo; ninguna acción en
--    auditoria, usuarios ni configuracion. Incluye inventario.ver/productos.ver
--    (necesarios para buscar productos al vender) y ventas.cancelar (anular).
-- Los perfiles que tuvieran vendedor/almacen/cajero pasan a supervisor.
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================================

-- Los roles existentes se actualizan en su descripción.
update public.roles set descripcion = 'Acceso completo a todos los módulos.' where codigo = 'administrador';
update public.roles set descripcion = 'Acceso completo a los módulos de trabajo, sin auditoría, usuarios ni configuración.'
  where codigo = 'supervisor';

-- 1) Perfiles de roles que se eliminan -> supervisor.
update public.profiles
   set rol_id = (select id from public.roles where codigo = 'supervisor')
 where rol_id in (select id from public.roles where codigo in ('vendedor', 'almacen', 'cajero'))
   and exists (select 1 from public.roles where codigo = 'supervisor');

-- 2) Borrar los roles sobrantes (rol_permisos cae en cascada).
delete from public.roles where codigo in ('vendedor', 'almacen', 'cajero');

-- 3) Administrador: todo (completa lo que falte).
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r cross join public.permisos p
where r.codigo = 'administrador'
on conflict do nothing;

-- 4) Supervisor: exactamente las 7 acciones de los 11 módulos de trabajo.
delete from public.rol_permisos
 where rol_id = (select id from public.roles where codigo = 'supervisor');

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p
  on p.modulo in ('ventas','productos','inventario','compras','proveedores','clientes',
                  'cotizaciones','movimientos','caja','trabajadores','reportes')
where r.codigo = 'supervisor'
on conflict do nothing;

-- 5) Solo se admiten estos dos roles en adelante.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roles_solo_dos_check') then
    alter table public.roles
      add constraint roles_solo_dos_check check (codigo in ('administrador', 'supervisor'));
  end if;
end;
$$;

-- >>>>>>>>>>>>>>>>>>>> 29_dashboard_resumen_seguro.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 30_proteger_permisos.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 30_proteger_permisos.sql                                   (A-07, decisión 4)
-- Defensa en la base de datos para la matriz de permisos: desde la API (usuario
-- autenticado) no se pueden tocar los permisos del administrador ni conceder al
-- supervisor acciones sobre auditoria, usuarios o configuracion. El SQL Editor
-- (sin sesión de usuario) no se ve afectado. Idempotente.
-- ============================================================================

create or replace function public.fn_proteger_rol_permisos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rol_id     uuid;
  v_permiso_id uuid;
  v_rol        text;
  v_modulo     text;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    v_rol_id := old.rol_id; v_permiso_id := old.permiso_id;
  else
    v_rol_id := new.rol_id; v_permiso_id := new.permiso_id;
  end if;

  select codigo into v_rol from public.roles where id = v_rol_id;
  select modulo into v_modulo from public.permisos where id = v_permiso_id;

  if v_rol = 'administrador' then
    raise exception 'Los permisos del administrador no se pueden modificar.' using errcode = '42501';
  end if;
  if v_modulo in ('auditoria', 'usuarios', 'configuracion') then
    raise exception 'Este módulo es exclusivo del administrador.' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_rol_permisos_proteger on public.rol_permisos;
create trigger trg_rol_permisos_proteger
  before insert or update or delete on public.rol_permisos
  for each row execute function public.fn_proteger_rol_permisos();

revoke execute on function public.fn_proteger_rol_permisos() from public, anon;

-- >>>>>>>>>>>>>>>>>>>> 31_funciones_integridad.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 31_funciones_integridad.sql        (A-01, A-02, A-06, M-06, M-12, M-14, B-10)
-- Reemplaza (create or replace, misma firma) las funciones transaccionales para:
--  * validar empresa y sede del objeto recibido (caja, sesión, venta, producto,
--    proveedor, cliente, cotización) — un usuario no puede operar sobre datos de
--    otra empresa ni de otra sede (salvo el administrador, dentro de su empresa);
--  * fn_convertir_cotizacion bloquea la fila (for update): un doble clic no crea
--    dos ventas; rechaza cotizaciones vencidas;
--  * fn_anular_venta revierte la caja (egreso en la caja abierta de la sede) y
--    exige motivo;
--  * fn_registrar_venta bloquea el inventario en orden de producto (sin
--    deadlocks), valida descuentos y no inserta movimiento de caja si total = 0;
--  * fn_registrar_auditoria solo admite módulos conocidos.
-- No cambia la regla de "caja abierta para vender" (decisión pendiente del dueño).
-- Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- fn_registrar_venta
-- ---------------------------------------------------------------------------
create or replace function public.fn_registrar_venta(
  p_sede_id          uuid,
  p_cliente_id       uuid,
  p_medio_pago       text,
  p_lineas           jsonb,
  p_observaciones    text default null
)
returns public.ventas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil           record;
  v_empresa_id        uuid;
  v_linea             jsonb;
  v_producto_id       uuid;
  v_cantidad          integer;
  v_descuento_linea   numeric(12,2);
  v_inv               record;
  v_producto          record;
  v_subtotal_bruto    numeric(12,2) := 0;
  v_descuento_total   numeric(12,2) := 0;
  v_costo_total       numeric(12,2) := 0;
  v_base              numeric(12,2);
  v_tasa_impuesto     numeric(5,4);
  v_impuesto          numeric(12,2);
  v_total             numeric(12,2);
  v_venta             public.ventas;
  v_correlativo       integer;
  v_detalle_lineas    jsonb := '[]'::jsonb;
  v_caja_sesion_id    uuid;
  v_stock_anterior    integer;
  v_stock_nuevo       integer;
begin
  select * into v_perfil from public.current_profile();
  if v_perfil.profile_id is null or not v_perfil.activo then
    raise exception 'Usuario no autenticado o inactivo.' using errcode = '28000';
  end if;
  if not public.has_permiso('ventas', 'crear') then
    raise exception 'No tiene permiso para registrar ventas.' using errcode = '42501';
  end if;
  if not public.es_administrador() and v_perfil.sede_id is distinct from p_sede_id then
    raise exception 'No puede registrar ventas para otra sede.' using errcode = '42501';
  end if;

  v_empresa_id := v_perfil.empresa_id;

  if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Agregue al menos un producto a la venta.';
  end if;
  if not exists (select 1 from public.sedes where id = p_sede_id and empresa_id = v_empresa_id) then
    raise exception 'La sede no existe.';
  end if;
  if not exists (
    select 1 from public.clientes
    where id = p_cliente_id and empresa_id = v_empresa_id and estado and deleted_at is null
  ) then
    raise exception 'El cliente no existe o está inactivo.';
  end if;

  select impuesto into v_tasa_impuesto from public.empresas where id = v_empresa_id;

  -- Primera pasada: bloquear inventario en orden de producto (evita deadlocks entre
  -- ventas simultáneas) y acumular totales.
  for v_linea in select e from jsonb_array_elements(p_lineas) as e order by e->>'producto_id'
  loop
    v_producto_id     := (v_linea->>'producto_id')::uuid;
    v_cantidad        := (v_linea->>'cantidad')::integer;
    v_descuento_linea := coalesce((v_linea->>'descuento')::numeric, 0);

    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida para el producto %.', v_producto_id;
    end if;
    if v_descuento_linea < 0 then
      raise exception 'El descuento no puede ser negativo.';
    end if;

    select p.id, p.nombre, p.precio_venta, p.estado
      into v_producto
      from public.productos p
      where p.id = v_producto_id and p.empresa_id = v_empresa_id and p.deleted_at is null
      for update;

    if v_producto.id is null or not v_producto.estado then
      raise exception 'El producto % no existe o está inactivo.', v_producto_id;
    end if;
    if v_descuento_linea > v_producto.precio_venta * v_cantidad then
      raise exception 'El descuento de "%" supera el importe de la línea.', v_producto.nombre;
    end if;

    select stock_actual, costo_actual
      into v_inv
      from public.inventario
      where producto_id = v_producto_id and sede_id = p_sede_id
      for update;

    if v_inv.stock_actual is null then
      raise exception 'El producto % no tiene inventario registrado en esta sede.', v_producto.nombre;
    end if;
    if v_inv.stock_actual < v_cantidad then
      raise exception 'Stock insuficiente de "%": disponible %, solicitado %.',
        v_producto.nombre, v_inv.stock_actual, v_cantidad;
    end if;

    v_stock_anterior := v_inv.stock_actual;
    v_stock_nuevo    := v_stock_anterior - v_cantidad;

    v_subtotal_bruto  := v_subtotal_bruto + (v_producto.precio_venta * v_cantidad);
    v_descuento_total := v_descuento_total + v_descuento_linea;
    v_costo_total     := v_costo_total + (v_inv.costo_actual * v_cantidad);

    v_detalle_lineas := v_detalle_lineas || jsonb_build_object(
      'producto_id', v_producto_id,
      'cantidad', v_cantidad,
      'precio_unitario', v_producto.precio_venta,
      'costo_unitario', v_inv.costo_actual,
      'descuento', v_descuento_linea,
      'stock_anterior', v_stock_anterior,
      'stock_nuevo', v_stock_nuevo
    );

    update public.inventario
      set stock_actual = v_stock_nuevo, updated_at = now()
      where producto_id = v_producto_id and sede_id = p_sede_id;
  end loop;

  v_base      := v_subtotal_bruto - v_descuento_total;
  v_impuesto  := round(v_base * v_tasa_impuesto, 2);
  v_total     := v_base + v_impuesto;

  perform pg_advisory_xact_lock(hashtext('nota_venta:' || v_empresa_id::text));
  select coalesce(max(correlativo), 0) + 1 into v_correlativo
    from public.ventas
    where empresa_id = v_empresa_id;

  insert into public.ventas (
    empresa_id, sede_id, cliente_id, usuario_id, numero, correlativo,
    subtotal, descuento, impuesto, total, costo_total,
    medio_pago, observaciones
  ) values (
    v_empresa_id, p_sede_id, p_cliente_id, v_perfil.profile_id,
    'NV-' || lpad(v_correlativo::text, 6, '0'), v_correlativo,
    v_subtotal_bruto, v_descuento_total, v_impuesto, v_total, v_costo_total,
    p_medio_pago, p_observaciones
  )
  returning * into v_venta;

  for v_linea in select * from jsonb_array_elements(v_detalle_lineas)
  loop
    insert into public.venta_detalles (
      venta_id, producto_id, cantidad, precio_unitario, costo_unitario, descuento
    ) values (
      v_venta.id,
      (v_linea->>'producto_id')::uuid,
      (v_linea->>'cantidad')::integer,
      (v_linea->>'precio_unitario')::numeric,
      (v_linea->>'costo_unitario')::numeric,
      (v_linea->>'descuento')::numeric
    );

    insert into public.movimientos_inventario (
      empresa_id, sede_id, producto_id, tipo, cantidad, stock_anterior,
      motivo, referencia_tipo, referencia_id, usuario_id
    ) values (
      v_empresa_id, p_sede_id, (v_linea->>'producto_id')::uuid, 'venta',
      -((v_linea->>'cantidad')::integer), (v_linea->>'stock_anterior')::integer,
      'Salida por venta ' || v_venta.numero, 'venta', v_venta.id, v_perfil.profile_id
    );
  end loop;

  select cs.id into v_caja_sesion_id
    from public.caja_sesiones cs
    join public.cajas c on c.id = cs.caja_id
    where c.sede_id = p_sede_id and cs.estado = 'abierta'
    limit 1;

  -- movimientos_caja.monto exige > 0: una venta de total 0 no genera movimiento.
  if v_caja_sesion_id is not null and v_total > 0 then
    insert into public.movimientos_caja (
      caja_sesion_id, sede_id, tipo, medio_pago, monto, concepto,
      referencia_tipo, referencia_id, usuario_id
    ) values (
      v_caja_sesion_id, p_sede_id, 'venta', p_medio_pago, v_total,
      'Venta ' || v_venta.numero, 'venta', v_venta.id, v_perfil.profile_id
    );
  end if;

  insert into public.audit_logs (
    usuario_id, empresa_id, sede_id, accion, modulo, tabla_afectada, registro_id, datos_nuevos
  ) values (
    v_perfil.profile_id, v_empresa_id, p_sede_id, 'Venta registrada', 'ventas', 'ventas', v_venta.id,
    jsonb_build_object('numero', v_venta.numero, 'total', v_venta.total)
  );

  return v_venta;
end;
$$;

-- ---------------------------------------------------------------------------
-- fn_registrar_compra
-- ---------------------------------------------------------------------------
create or replace function public.fn_registrar_compra(
  p_sede_id         uuid,
  p_proveedor_id    uuid,
  p_numero_documento text,
  p_lineas          jsonb,
  p_observaciones   text default null
)
returns public.compras
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil          record;
  v_empresa_id      uuid;
  v_linea           jsonb;
  v_producto_id     uuid;
  v_cantidad        integer;
  v_costo_unitario  numeric(12,2);
  v_inv             record;
  v_nuevo_costo     numeric(12,2);
  v_subtotal        numeric(12,2) := 0;
  v_tasa_impuesto   numeric(5,4);
  v_impuesto        numeric(12,2);
  v_compra          public.compras;
begin
  select * into v_perfil from public.current_profile();
  if v_perfil.profile_id is null or not v_perfil.activo then
    raise exception 'Usuario no autenticado o inactivo.' using errcode = '28000';
  end if;
  if not public.has_permiso('compras', 'crear') then
    raise exception 'No tiene permiso para registrar compras.' using errcode = '42501';
  end if;
  if not public.es_administrador() and v_perfil.sede_id is distinct from p_sede_id then
    raise exception 'No puede registrar compras para otra sede.' using errcode = '42501';
  end if;

  v_empresa_id := v_perfil.empresa_id;

  if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Agregue al menos un producto a la compra.';
  end if;
  if not exists (select 1 from public.sedes where id = p_sede_id and empresa_id = v_empresa_id) then
    raise exception 'La sede no existe.';
  end if;
  if not exists (
    select 1 from public.proveedores
    where id = p_proveedor_id and empresa_id = v_empresa_id and estado and deleted_at is null
  ) then
    raise exception 'El proveedor no existe o está inactivo.';
  end if;

  select impuesto into v_tasa_impuesto from public.empresas where id = v_empresa_id;

  insert into public.compras (empresa_id, sede_id, proveedor_id, usuario_id, numero_documento, subtotal, impuesto, total, observaciones)
  values (v_empresa_id, p_sede_id, p_proveedor_id, v_perfil.profile_id, p_numero_documento, 0, 0, 0, p_observaciones)
  returning * into v_compra;

  for v_linea in select e from jsonb_array_elements(p_lineas) as e order by e->>'producto_id'
  loop
    v_producto_id    := (v_linea->>'producto_id')::uuid;
    v_cantidad       := (v_linea->>'cantidad')::integer;
    v_costo_unitario := (v_linea->>'costo_unitario')::numeric;

    if not exists (select 1 from public.productos where id = v_producto_id and empresa_id = v_empresa_id) then
      raise exception 'El producto % no existe.', v_producto_id;
    end if;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida para el producto %.', v_producto_id;
    end if;
    if v_costo_unitario is null or v_costo_unitario < 0 then
      raise exception 'Costo unitario inválido para el producto %.', v_producto_id;
    end if;

    insert into public.compra_detalles (compra_id, producto_id, cantidad, costo_unitario)
    values (v_compra.id, v_producto_id, v_cantidad, v_costo_unitario);

    v_subtotal := v_subtotal + (v_costo_unitario * v_cantidad);

    select stock_actual, costo_actual into v_inv
      from public.inventario
      where producto_id = v_producto_id and sede_id = p_sede_id
      for update;

    if v_inv.stock_actual is null then
      insert into public.inventario (producto_id, sede_id, stock_actual, stock_minimo, costo_actual)
      select v_producto_id, p_sede_id, 0, stock_minimo_default, v_costo_unitario
        from public.productos where id = v_producto_id
      on conflict (producto_id, sede_id) do nothing;
      v_inv.stock_actual := 0;
      v_inv.costo_actual := v_costo_unitario;
    end if;

    v_nuevo_costo := case
      when v_inv.stock_actual + v_cantidad > 0
        then round(((v_inv.stock_actual * v_inv.costo_actual) + (v_cantidad * v_costo_unitario))
                    / (v_inv.stock_actual + v_cantidad), 2)
      else v_costo_unitario
    end;

    update public.inventario
      set stock_actual = v_inv.stock_actual + v_cantidad,
          costo_actual = v_nuevo_costo,
          updated_at = now()
      where producto_id = v_producto_id and sede_id = p_sede_id;

    update public.productos
      set costo_actual = v_nuevo_costo, updated_at = now()
      where id = v_producto_id and empresa_id = v_empresa_id;

    insert into public.movimientos_inventario (
      empresa_id, sede_id, producto_id, tipo, cantidad, stock_anterior,
      motivo, referencia_tipo, referencia_id, usuario_id
    ) values (
      v_empresa_id, p_sede_id, v_producto_id, 'compra', v_cantidad, v_inv.stock_actual,
      'Ingreso por compra ' || p_numero_documento, 'compra', v_compra.id, v_perfil.profile_id
    );
  end loop;

  v_impuesto := round(v_subtotal * v_tasa_impuesto, 2);

  update public.compras
    set subtotal = v_subtotal, impuesto = v_impuesto, total = v_subtotal + v_impuesto
    where id = v_compra.id
    returning * into v_compra;

  insert into public.audit_logs (usuario_id, empresa_id, sede_id, accion, modulo, tabla_afectada, registro_id, datos_nuevos)
  values (v_perfil.profile_id, v_empresa_id, p_sede_id, 'Compra registrada', 'compras', 'compras', v_compra.id,
          jsonb_build_object('numero_documento', v_compra.numero_documento, 'total', v_compra.total));

  return v_compra;
end;
$$;

-- ---------------------------------------------------------------------------
-- fn_convertir_cotizacion
-- ---------------------------------------------------------------------------
create or replace function public.fn_convertir_cotizacion(
  p_cotizacion_id   uuid,
  p_medio_pago      text
)
returns public.ventas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cot     record;
  v_lineas  jsonb;
  v_venta   public.ventas;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.' using errcode = '28000';
  end if;
  if not public.has_permiso('cotizaciones', 'editar') then
    raise exception 'No tiene permiso para convertir cotizaciones.' using errcode = '42501';
  end if;

  -- for update: un segundo clic espera aquí y, al ver estado 'convertida', falla.
  select * into v_cot from public.cotizaciones
    where id = p_cotizacion_id and empresa_id = public.mi_empresa_id()
    for update;
  if v_cot.id is null then
    raise exception 'La cotización no existe.';
  end if;
  if not public.es_administrador() and v_cot.sede_id is distinct from public.mi_sede_id() then
    raise exception 'La cotización pertenece a otra sede.' using errcode = '42501';
  end if;
  if v_cot.estado <> 'aceptada' then
    raise exception 'Solo una cotización aceptada puede convertirse en venta.';
  end if;
  if v_cot.fecha_vencimiento < now() then
    raise exception 'La cotización está vencida.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'producto_id', producto_id, 'cantidad', cantidad, 'descuento', descuento
         )), '[]'::jsonb)
    into v_lineas
    from public.cotizacion_detalles
    where cotizacion_id = p_cotizacion_id;

  v_venta := public.fn_registrar_venta(
    v_cot.sede_id, v_cot.cliente_id, p_medio_pago, v_lineas, null
  );

  update public.cotizaciones set estado = 'convertida', venta_id = v_venta.id, updated_at = now()
    where id = p_cotizacion_id;

  return v_venta;
end;
$$;

-- ---------------------------------------------------------------------------
-- fn_ajustar_stock
-- ---------------------------------------------------------------------------
create or replace function public.fn_ajustar_stock(
  p_producto_id       uuid,
  p_sede_id           uuid,
  p_tipo              text,
  p_cantidad          integer,
  p_motivo            text,
  p_documento_sustento text default null,
  p_observaciones     text default null
)
returns public.movimientos_inventario
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil   record;
  v_inv      record;
  v_delta    integer;
  v_nuevo    integer;
  v_mov      public.movimientos_inventario;
begin
  select * into v_perfil from public.current_profile();
  if v_perfil.profile_id is null or not v_perfil.activo then
    raise exception 'Usuario no autenticado o inactivo.' using errcode = '28000';
  end if;
  if not public.has_permiso('inventario', 'editar') then
    raise exception 'No tiene permiso para ajustar inventario.' using errcode = '42501';
  end if;
  if p_tipo not in ('entrada', 'salida') then
    raise exception 'Tipo de ajuste inválido.';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Indique el motivo del ajuste.';
  end if;
  if not public.es_administrador() and v_perfil.sede_id is distinct from p_sede_id then
    raise exception 'No puede ajustar el inventario de otra sede.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sedes where id = p_sede_id and empresa_id = v_perfil.empresa_id)
     or not exists (select 1 from public.productos where id = p_producto_id and empresa_id = v_perfil.empresa_id) then
    raise exception 'Producto o sede inválidos.';
  end if;

  select stock_actual into v_inv from public.inventario where producto_id = p_producto_id and sede_id = p_sede_id for update;
  if v_inv.stock_actual is null then
    raise exception 'El producto no tiene inventario registrado en esta sede.';
  end if;

  v_delta := case when p_tipo = 'entrada' then p_cantidad else -p_cantidad end;
  v_nuevo := v_inv.stock_actual + v_delta;
  if v_nuevo < 0 then
    raise exception 'El ajuste dejaría el stock en negativo.';
  end if;

  update public.inventario set stock_actual = v_nuevo, updated_at = now()
    where producto_id = p_producto_id and sede_id = p_sede_id;

  insert into public.movimientos_inventario (
    empresa_id, sede_id, producto_id, tipo, cantidad, stock_anterior, motivo,
    referencia_tipo, documento_sustento, observaciones, usuario_id
  ) values (
    v_perfil.empresa_id, p_sede_id, p_producto_id, p_tipo, v_delta, v_inv.stock_actual, p_motivo,
    'ajuste', p_documento_sustento, p_observaciones, v_perfil.profile_id
  )
  returning * into v_mov;

  insert into public.audit_logs (usuario_id, empresa_id, sede_id, accion, modulo, tabla_afectada, registro_id, datos_nuevos)
  values (v_perfil.profile_id, v_perfil.empresa_id, p_sede_id, 'Ajuste de stock (' || p_tipo || '): ' || p_motivo,
          'inventario', 'movimientos_inventario', v_mov.id, jsonb_build_object('cantidad', v_delta, 'stock_nuevo', v_nuevo));

  return v_mov;
end;
$$;

-- ---------------------------------------------------------------------------
-- fn_abrir_caja / fn_cerrar_caja
-- ---------------------------------------------------------------------------
create or replace function public.fn_abrir_caja(p_caja_id uuid, p_monto_apertura numeric)
returns public.caja_sesiones
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil  record;
  v_sesion  public.caja_sesiones;
begin
  select * into v_perfil from public.current_profile();
  if v_perfil.profile_id is null or not v_perfil.activo then
    raise exception 'Usuario no autenticado o inactivo.' using errcode = '28000';
  end if;
  if not public.has_permiso('caja', 'crear') then
    raise exception 'No tiene permiso para abrir caja.' using errcode = '42501';
  end if;
  if p_monto_apertura is null or p_monto_apertura < 0 then
    raise exception 'El monto de apertura no puede ser negativo.';
  end if;
  if not exists (
    select 1 from public.cajas c join public.sedes s on s.id = c.sede_id
    where c.id = p_caja_id and c.estado and s.empresa_id = v_perfil.empresa_id
      and (public.es_administrador() or c.sede_id = v_perfil.sede_id)
  ) then
    raise exception 'La caja no existe o no pertenece a tu sede.' using errcode = '42501';
  end if;

  insert into public.caja_sesiones (caja_id, usuario_apertura_id, monto_apertura)
  values (p_caja_id, v_perfil.profile_id, p_monto_apertura)
  returning * into v_sesion;

  insert into public.movimientos_caja (caja_sesion_id, sede_id, tipo, medio_pago, monto, concepto, usuario_id)
  select v_sesion.id, c.sede_id, 'apertura', 'efectivo', greatest(p_monto_apertura, 0.01), 'Apertura de caja', v_perfil.profile_id
  from public.cajas c where c.id = p_caja_id;

  return v_sesion;
exception
  when unique_violation then
    raise exception 'Ya hay una sesión de caja abierta para esta caja.';
end;
$$;

create or replace function public.fn_cerrar_caja(p_caja_sesion_id uuid, p_monto_cierre_real numeric)
returns public.caja_sesiones
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil    record;
  v_sesion    record;
  v_esperado  numeric(12,2);
begin
  select * into v_perfil from public.current_profile();
  if v_perfil.profile_id is null or not v_perfil.activo then
    raise exception 'Usuario no autenticado o inactivo.' using errcode = '28000';
  end if;
  if not public.has_permiso('caja', 'editar') then
    raise exception 'No tiene permiso para cerrar caja.' using errcode = '42501';
  end if;

  select * into v_sesion from public.caja_sesiones where id = p_caja_sesion_id for update;
  if v_sesion.id is null or v_sesion.estado <> 'abierta' then
    raise exception 'La sesión de caja no existe o ya está cerrada.';
  end if;
  if not exists (
    select 1 from public.cajas c join public.sedes s on s.id = c.sede_id
    where c.id = v_sesion.caja_id and s.empresa_id = v_perfil.empresa_id
      and (public.es_administrador() or c.sede_id = v_perfil.sede_id)
  ) then
    raise exception 'La sesión de caja no pertenece a tu sede.' using errcode = '42501';
  end if;
  if p_monto_cierre_real is null or p_monto_cierre_real < 0 then
    raise exception 'El monto real de cierre no es válido.';
  end if;

  select v_sesion.monto_apertura
         + coalesce(sum(monto) filter (where tipo in ('venta','ingreso') and medio_pago = 'efectivo'), 0)
         - coalesce(sum(monto) filter (where tipo = 'egreso' and medio_pago = 'efectivo'), 0)
    into v_esperado
    from public.movimientos_caja
    where caja_sesion_id = p_caja_sesion_id;

  update public.caja_sesiones
    set estado = 'cerrada',
        usuario_cierre_id = v_perfil.profile_id,
        monto_cierre_esperado = v_esperado,
        monto_cierre_real = p_monto_cierre_real,
        cerrada_en = now()
    where id = p_caja_sesion_id
    returning * into v_sesion;

  insert into public.audit_logs (usuario_id, empresa_id, accion, modulo, tabla_afectada, registro_id, datos_nuevos)
  values (v_perfil.profile_id, v_perfil.empresa_id, 'Cierre de caja', 'caja', 'caja_sesiones', v_sesion.id,
          jsonb_build_object('esperado', v_esperado, 'real', p_monto_cierre_real));

  return v_sesion;
end;
$$;

-- ---------------------------------------------------------------------------
-- fn_anular_venta: valida empresa/sede, exige motivo, devuelve stock y revierte caja.
-- ---------------------------------------------------------------------------
create or replace function public.fn_anular_venta(p_venta_id uuid, p_motivo text)
returns public.ventas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil   record;
  v_venta    public.ventas;
  v_detalle  record;
  v_inv      record;
begin
  select * into v_perfil from public.current_profile();
  if v_perfil.profile_id is null or not v_perfil.activo then
    raise exception 'Usuario no autenticado o inactivo.' using errcode = '28000';
  end if;
  if not public.has_permiso('ventas', 'cancelar') then
    raise exception 'No tiene permiso para anular ventas.' using errcode = '42501';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Indique el motivo de la anulación.';
  end if;

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.id is null
     or v_venta.empresa_id <> v_perfil.empresa_id
     or (not public.es_administrador() and v_venta.sede_id is distinct from v_perfil.sede_id) then
    raise exception 'La venta no existe.';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta ya está anulada.';
  end if;

  for v_detalle in select * from public.venta_detalles where venta_id = p_venta_id order by producto_id
  loop
    select stock_actual into v_inv from public.inventario
      where producto_id = v_detalle.producto_id and sede_id = v_venta.sede_id for update;

    update public.inventario
      set stock_actual = v_inv.stock_actual + v_detalle.cantidad, updated_at = now()
      where producto_id = v_detalle.producto_id and sede_id = v_venta.sede_id;

    insert into public.movimientos_inventario (
      empresa_id, sede_id, producto_id, tipo, cantidad, stock_anterior,
      motivo, referencia_tipo, referencia_id, usuario_id
    ) values (
      v_venta.empresa_id, v_venta.sede_id, v_detalle.producto_id, 'devolucion', v_detalle.cantidad,
      v_inv.stock_actual, 'Reverso por anulación de venta ' || v_venta.numero, 'venta', v_venta.id, v_perfil.profile_id
    );
  end loop;

  update public.ventas set estado = 'anulada', updated_at = now() where id = p_venta_id returning * into v_venta;

  -- Caja: el dinero de la venta sale de la caja abierta de la sede (si la hay).
  insert into public.movimientos_caja (
    caja_sesion_id, sede_id, tipo, medio_pago, monto, concepto, referencia_tipo, referencia_id, usuario_id
  )
  select cs.id, v_venta.sede_id, 'egreso', v_venta.medio_pago, v_venta.total,
         'Anulación de venta ' || v_venta.numero, 'venta', v_venta.id, v_perfil.profile_id
  from public.caja_sesiones cs
  join public.cajas c on c.id = cs.caja_id
  where c.sede_id = v_venta.sede_id and cs.estado = 'abierta' and v_venta.total > 0
  limit 1;

  insert into public.audit_logs (usuario_id, empresa_id, sede_id, accion, modulo, tabla_afectada, registro_id, datos_anteriores, datos_nuevos)
  values (v_perfil.profile_id, v_venta.empresa_id, v_venta.sede_id, 'Venta anulada: ' || p_motivo, 'ventas',
          'ventas', v_venta.id, jsonb_build_object('estado', 'confirmada'), jsonb_build_object('estado', 'anulada'));

  return v_venta;
end;
$$;

-- ---------------------------------------------------------------------------
-- fn_registrar_auditoria: solo módulos conocidos y textos acotados.
-- ---------------------------------------------------------------------------
create or replace function public.fn_registrar_auditoria(
  p_accion text,
  p_modulo text,
  p_tabla_afectada text default null,
  p_registro_id uuid default null,
  p_datos_anteriores jsonb default null,
  p_datos_nuevos jsonb default null
)
returns public.audit_logs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile record;
  v_log public.audit_logs;
begin
  select * into v_profile from public.current_profile();
  if v_profile.profile_id is null then
    raise exception 'No hay un perfil asociado al usuario autenticado.';
  end if;
  if p_modulo is null
     or p_modulo not in ('sesion','ventas','productos','inventario','compras','precios','permisos',
                         'configuracion','caja','clientes','proveedores','trabajadores',
                         'cotizaciones','movimientos','auditoria','usuarios')
     or length(coalesce(p_accion, '')) not between 1 and 300 then
    raise exception 'Registro de auditoría inválido.';
  end if;

  insert into public.audit_logs (
    usuario_id, empresa_id, sede_id, accion, modulo, tabla_afectada, registro_id,
    datos_anteriores, datos_nuevos
  )
  values (
    auth.uid(), v_profile.empresa_id, v_profile.sede_id, p_accion, p_modulo,
    p_tabla_afectada, p_registro_id, p_datos_anteriores, p_datos_nuevos
  )
  returning * into v_log;

  return v_log;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución: solo usuarios autenticados.
-- ---------------------------------------------------------------------------
revoke execute on function public.fn_registrar_venta(uuid, uuid, text, jsonb, text) from public, anon;
revoke execute on function public.fn_registrar_compra(uuid, uuid, text, jsonb, text) from public, anon;
revoke execute on function public.fn_convertir_cotizacion(uuid, text) from public, anon;
revoke execute on function public.fn_ajustar_stock(uuid, uuid, text, integer, text, text, text) from public, anon;
revoke execute on function public.fn_abrir_caja(uuid, numeric) from public, anon;
revoke execute on function public.fn_cerrar_caja(uuid, numeric) from public, anon;
revoke execute on function public.fn_anular_venta(uuid, text) from public, anon;
revoke execute on function public.fn_registrar_auditoria(text, text, text, uuid, jsonb, jsonb) from public, anon;

grant execute on function public.fn_registrar_venta(uuid, uuid, text, jsonb, text) to authenticated;
grant execute on function public.fn_registrar_compra(uuid, uuid, text, jsonb, text) to authenticated;
grant execute on function public.fn_convertir_cotizacion(uuid, text) to authenticated;
grant execute on function public.fn_ajustar_stock(uuid, uuid, text, integer, text, text, text) to authenticated;
grant execute on function public.fn_abrir_caja(uuid, numeric) to authenticated;
grant execute on function public.fn_cerrar_caja(uuid, numeric) to authenticated;
grant execute on function public.fn_anular_venta(uuid, text) to authenticated;
grant execute on function public.fn_registrar_auditoria(text, text, text, uuid, jsonb, jsonb) to authenticated;

-- >>>>>>>>>>>>>>>>>>>> 32_rls_cotizaciones.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 32_rls_cotizaciones.sql                                        (M-13)
-- Las políticas de cotizaciones no validaban la sede ni el cliente:
--  * insert: la sede debe ser la del usuario (o cualquiera de su empresa si es
--    administrador) y el cliente debe ser de su empresa;
--  * update: solo cotizaciones de su sede (administrador/supervisor: toda la
--    empresa) y no se puede cambiar a otra empresa/sede ni a 'convertida' a mano.
-- Idempotente (drop policy if exists + create policy).
-- ============================================================================

drop policy if exists cotizaciones_insert on public.cotizaciones;
create policy cotizaciones_insert on public.cotizaciones
  for insert to authenticated
  with check (
    empresa_id = public.mi_empresa_id()
    and usuario_id = auth.uid()
    and public.has_permiso('cotizaciones', 'crear')
    and estado = 'borrador'
    and (public.es_administrador() or sede_id = public.mi_sede_id())
    and exists (select 1 from public.sedes s where s.id = sede_id and s.empresa_id = public.mi_empresa_id())
    and exists (select 1 from public.clientes c where c.id = cliente_id and c.empresa_id = public.mi_empresa_id())
  );

drop policy if exists cotizaciones_update on public.cotizaciones;
create policy cotizaciones_update on public.cotizaciones
  for update to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and estado <> 'convertida'
    and public.has_permiso('cotizaciones', 'editar')
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  )
  with check (
    empresa_id = public.mi_empresa_id()
    and estado <> 'convertida'
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
    and exists (select 1 from public.clientes c where c.id = cliente_id and c.empresa_id = public.mi_empresa_id())
  );
