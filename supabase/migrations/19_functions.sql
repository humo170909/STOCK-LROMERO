-- ============================================================================
-- 19_functions.sql
--
-- Todas las funciones SECURITY DEFINER fijan search_path explícitamente (evita
-- "search_path hijacking") y son STABLE o VOLATILE según corresponda. EXECUTE se
-- otorga solo a `authenticated` — nunca a `anon`.
--
-- Las funciones de escritura (fn_registrar_venta, fn_registrar_compra, etc.) NO
-- confían en RLS para autorizar: como son SECURITY DEFINER, RLS no las detiene,
-- así que cada una valida permiso/sede/estado explícitamente al entrar. Esto es
-- exactamente lo que pide la sección 26: "validar usuario, permisos, sede" como
-- pasos propios de la función, no delegados.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Genérico: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers de autorización (evitan recursión de RLS: SECURITY DEFINER bypassa RLS
-- al leer profiles/rol_permisos, así una policy en OTRA tabla puede llamarlas sin
-- que Postgres tenga que re-evaluar RLS sobre profiles para resolverlas).
-- ---------------------------------------------------------------------------
create or replace function public.current_profile()
returns table (
  profile_id  uuid,
  empresa_id  uuid,
  sede_id     uuid,
  rol_codigo  text,
  activo      boolean
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select p.id, p.empresa_id, p.sede_id, r.codigo, p.activo
  from public.profiles p
  join public.roles r on r.id = p.rol_id
  where p.id = auth.uid();
$$;

create or replace function public.mi_empresa_id()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select empresa_id from public.profiles where id = auth.uid();
$$;

create or replace function public.mi_sede_id()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select sede_id from public.profiles where id = auth.uid();
$$;

create or replace function public.es_administrador()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.rol_id
    where p.id = auth.uid() and r.codigo = 'administrador' and p.activo
  );
$$;

create or replace function public.has_permiso(p_modulo text, p_accion text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.rol_permisos rp on rp.rol_id = p.rol_id
    join public.permisos perm on perm.id = rp.permiso_id
    where p.id = auth.uid()
      and p.activo
      and perm.modulo = p_modulo
      and perm.accion = p_accion
  );
$$;

grant execute on function public.current_profile() to authenticated;
grant execute on function public.mi_empresa_id() to authenticated;
grant execute on function public.mi_sede_id() to authenticated;
grant execute on function public.es_administrador() to authenticated;
grant execute on function public.has_permiso(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_registrar_venta
--
-- p_lineas: jsonb array de {"producto_id": uuid, "cantidad": int, "descuento": numeric}
-- Hace, como una sola transacción (la función ES la transacción: si cualquier
-- RAISE EXCEPTION ocurre, Postgres revierte todo lo insertado/actualizado antes):
--   1-3) validar usuario activo, permiso 'ventas.crear' y que la sede sea la suya
--        (o sea administrador).
--   4-5) por cada línea: bloquear la fila de inventario (FOR UPDATE) y validar
--        stock — el lock impide que dos ventas concurrentes lean el mismo stock
--        "viejo" y lo dejen negativo.
--   6-9) registrar venta + detalle con costo histórico (inventario.costo_actual
--        EN ESE INSTANTE, nunca se vuelve a tocar después).
--   10)  descontar inventario.
--   11)  registrar movimiento de inventario.
--   12)  registrar movimiento de caja (si hay una sesión abierta en esa sede).
--   13)  registrar auditoría.
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
  v_tasa_impuesto               numeric(5,4);
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

  select impuesto into v_tasa_impuesto from public.empresas where id = v_empresa_id;

  -- Primera pasada: bloquear inventario de cada línea y acumular totales.
  for v_linea in select * from jsonb_array_elements(p_lineas)
  loop
    v_producto_id     := (v_linea->>'producto_id')::uuid;
    v_cantidad        := (v_linea->>'cantidad')::integer;
    v_descuento_linea := coalesce((v_linea->>'descuento')::numeric, 0);

    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida para el producto %.', v_producto_id;
    end if;

    select p.id, p.nombre, p.precio_venta, p.estado
      into v_producto
      from public.productos p
      where p.id = v_producto_id and p.empresa_id = v_empresa_id and p.deleted_at is null
      for update;

    if v_producto.id is null or not v_producto.estado then
      raise exception 'El producto % no existe o está inactivo.', v_producto_id;
    end if;

    -- FOR UPDATE: bloquea la fila hasta el commit. Una segunda venta concurrente
    -- sobre el mismo producto/sede espera aquí en vez de leer un stock obsoleto.
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

    -- Aplica el descuento de stock ya mismo, todavía bajo el lock de esta fila.
    update public.inventario
      set stock_actual = v_stock_nuevo, updated_at = now()
      where producto_id = v_producto_id and sede_id = p_sede_id;
  end loop;

  v_base      := v_subtotal_bruto - v_descuento_total;
  v_impuesto  := round(v_base * v_tasa_impuesto, 2);
  v_total     := v_base + v_impuesto;

  -- Numeración interna correlativa por empresa (nota de venta NV-000001). El lock
  -- advisory serializa ventas simultáneas de la misma empresa para que dos ventas
  -- no calculen el mismo correlativo (se libera solo al terminar la transacción).
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

  -- Movimiento de caja: solo si hay una sesión abierta en esta sede. No es un
  -- error que no la haya (puede haber ventas registradas sin caja abierta, según
  -- cómo se configure el negocio); si tu operación SÍ debe exigirla, cambia este
  -- bloque por un RAISE EXCEPTION cuando v_caja_sesion_id sea null.
  select cs.id into v_caja_sesion_id
    from public.caja_sesiones cs
    join public.cajas c on c.id = cs.caja_id
    where c.sede_id = p_sede_id and cs.estado = 'abierta'
    limit 1;

  if v_caja_sesion_id is not null then
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

grant execute on function public.fn_registrar_venta(uuid, uuid, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_registrar_compra
-- Costeo por promedio ponderado: costo_nuevo = (stock*costo + cantidad*costo_unitario)
-- / (stock + cantidad). Nunca toca venta_detalles.costo_unitario de ventas pasadas.
-- ---------------------------------------------------------------------------
create or replace function public.fn_registrar_compra(
  p_sede_id         uuid,
  p_proveedor_id    uuid,
  p_numero_documento text,
  p_lineas          jsonb,  -- [{"producto_id":uuid,"cantidad":int,"costo_unitario":numeric}]
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
  v_tasa_impuesto             numeric(5,4);
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

  select impuesto into v_tasa_impuesto from public.empresas where id = v_empresa_id;

  insert into public.compras (empresa_id, sede_id, proveedor_id, usuario_id, numero_documento, subtotal, impuesto, total, observaciones)
  values (v_empresa_id, p_sede_id, p_proveedor_id, v_perfil.profile_id, p_numero_documento, 0, 0, 0, p_observaciones)
  returning * into v_compra;

  for v_linea in select * from jsonb_array_elements(p_lineas)
  loop
    v_producto_id    := (v_linea->>'producto_id')::uuid;
    v_cantidad       := (v_linea->>'cantidad')::integer;
    v_costo_unitario := (v_linea->>'costo_unitario')::numeric;

    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida para el producto %.', v_producto_id;
    end if;
    if v_costo_unitario is null or v_costo_unitario < 0 then
      raise exception 'Costo unitario inválido para el producto %.', v_producto_id;
    end if;

    insert into public.compra_detalles (compra_id, producto_id, cantidad, costo_unitario)
    values (v_compra.id, v_producto_id, v_cantidad, v_costo_unitario);

    v_subtotal := v_subtotal + (v_costo_unitario * v_cantidad);

    -- Bloquea (o crea si no existía) la fila de inventario de esta sede.
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

    update public.productos set costo_actual = v_nuevo_costo, updated_at = now() where id = v_producto_id;

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

grant execute on function public.fn_registrar_compra(uuid, uuid, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_convertir_cotizacion: reusa fn_registrar_venta con las líneas ya guardadas.
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
  select * into v_cot from public.cotizaciones where id = p_cotizacion_id;
  if v_cot.id is null then
    raise exception 'La cotización no existe.';
  end if;
  if v_cot.estado <> 'aceptada' then
    raise exception 'Solo una cotización aceptada puede convertirse en venta.';
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

grant execute on function public.fn_convertir_cotizacion(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_ajustar_stock: entrada/salida manual con motivo (panel "ajuste rápido").
-- ---------------------------------------------------------------------------
create or replace function public.fn_ajustar_stock(
  p_producto_id       uuid,
  p_sede_id           uuid,
  p_tipo              text,   -- 'entrada' | 'salida'
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

grant execute on function public.fn_ajustar_stock(uuid, uuid, text, integer, text, text, text) to authenticated;

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
  if p_monto_apertura < 0 then
    raise exception 'El monto de apertura no puede ser negativo.';
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

grant execute on function public.fn_abrir_caja(uuid, numeric) to authenticated;
grant execute on function public.fn_cerrar_caja(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_dashboard_resumen: una sola llamada en vez de 8-10 queries desde el frontend.
-- ---------------------------------------------------------------------------
create or replace function public.fn_dashboard_resumen(p_sede_id uuid, p_fecha date default current_date)
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
  select
    coalesce((select sum(v.total) from public.ventas v
              where v.sede_id = p_sede_id and v.estado = 'confirmada' and v.fecha::date = p_fecha), 0),
    coalesce((select sum(v.costo_total) from public.ventas v
              where v.sede_id = p_sede_id and v.estado = 'confirmada' and v.fecha::date = p_fecha), 0),
    coalesce((select sum(v.ganancia_total) from public.ventas v
              where v.sede_id = p_sede_id and v.estado = 'confirmada' and v.fecha::date = p_fecha), 0),
    coalesce((select count(*) from public.ventas v
              where v.sede_id = p_sede_id and v.estado = 'confirmada' and v.fecha::date = p_fecha), 0),
    coalesce((select sum(vd.cantidad) from public.venta_detalles vd
              join public.ventas v on v.id = vd.venta_id
              where v.sede_id = p_sede_id and v.estado = 'confirmada' and v.fecha::date = p_fecha), 0),
    coalesce((select count(*) from public.inventario i
              where i.sede_id = p_sede_id and i.stock_actual > 0 and i.stock_actual <= i.stock_minimo), 0),
    coalesce((select count(*) from public.inventario i
              where i.sede_id = p_sede_id and i.stock_actual = 0), 0);
$$;

grant execute on function public.fn_dashboard_resumen(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_anular_venta: revierte stock (vuelve a entrar lo vendido) y marca la venta
-- como anulada. El costo/ganancia históricos de la venta NO se tocan — solo
-- cambia el estado; sigue existiendo como registro para trazabilidad.
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

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if v_venta.id is null then
    raise exception 'La venta no existe.';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta ya está anulada.';
  end if;

  for v_detalle in select * from public.venta_detalles where venta_id = p_venta_id
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

  insert into public.audit_logs (usuario_id, empresa_id, sede_id, accion, modulo, tabla_afectada, registro_id, datos_anteriores, datos_nuevos)
  values (v_perfil.profile_id, v_venta.empresa_id, v_venta.sede_id, 'Venta anulada: ' || p_motivo, 'ventas',
          'ventas', v_venta.id, jsonb_build_object('estado', 'confirmada'), jsonb_build_object('estado', 'anulada'));

  return v_venta;
end;
$$;

grant execute on function public.fn_anular_venta(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_actualizar_mi_perfil: el propio usuario solo puede tocar nombre/teléfono.
-- rol_id, empresa_id, sede_id y activo SOLO los cambia un administrador (ver
-- policy de UPDATE sobre profiles en 22_rls.sql) — así nadie se autoasciende.
-- ---------------------------------------------------------------------------
create or replace function public.fn_actualizar_mi_perfil(p_nombre text, p_telefono text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.' using errcode = '28000';
  end if;
  update public.profiles set nombre = coalesce(p_nombre, nombre), telefono = coalesce(p_telefono, telefono), updated_at = now()
    where id = auth.uid()
    returning * into v_perfil;
  return v_perfil;
end;
$$;

grant execute on function public.fn_actualizar_mi_perfil(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_marcar_notificacion_leida
-- ---------------------------------------------------------------------------
create or replace function public.fn_marcar_notificacion_leida(p_notificacion_id uuid)
returns public.notificaciones
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_notif public.notificaciones;
begin
  update public.notificaciones set leida = true
    where id = p_notificacion_id and usuario_id = auth.uid()
    returning * into v_notif;
  if v_notif.id is null then
    raise exception 'Notificación no encontrada.';
  end if;
  return v_notif;
end;
$$;

grant execute on function public.fn_marcar_notificacion_leida(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Bloqueo duro de audit_logs (defensa adicional a nivel de trigger, además del
-- REVOKE en 18_auditoria.sql y de que ninguna policy de UPDATE/DELETE existirá).
-- ---------------------------------------------------------------------------
create or replace function public.fn_block_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs es de solo inserción.';
end;
$$;
