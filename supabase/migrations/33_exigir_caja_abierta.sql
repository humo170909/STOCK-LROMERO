-- ============================================================================
-- 33_exigir_caja_abierta.sql                                         (M-11)
-- Decisión: no se puede registrar una venta (ni convertir una cotización en venta)
-- si la sede no tiene una caja abierta. Así cada venta genera su movimiento de
-- caja y el cierre de caja siempre cuadra. Misma firma que antes. Idempotente.
-- ============================================================================

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

  -- Regla del negocio: no se vende con la caja cerrada (así la caja siempre cuadra con las ventas).
  select cs.id into v_caja_sesion_id
    from public.caja_sesiones cs
    join public.cajas c on c.id = cs.caja_id
    where c.sede_id = p_sede_id and cs.estado = 'abierta'
    limit 1;
  if v_caja_sesion_id is null then
    raise exception 'No hay una caja abierta en esta sede. Abra la caja en Ingresos y Caja antes de vender.';
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

revoke execute on function public.fn_registrar_venta(uuid, uuid, text, jsonb, text) from public, anon;
grant execute on function public.fn_registrar_venta(uuid, uuid, text, jsonb, text) to authenticated;
