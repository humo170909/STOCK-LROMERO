-- ============================================================================
-- 34_pago_mixto.sql
-- Pago mixto: una venta puede pagarse con 2 o más medios (efectivo, Yape, Plin…).
--  * Nueva tabla venta_pagos (un renglón por medio, monto > 0). Es la fuente de verdad
--    de "cuánto entró por cada medio". Las ventas anteriores (un solo medio) se copian
--    aquí con su total, sin perder nada.
--  * ventas.medio_pago admite además 'mixto' (cuando hay más de un medio). Una venta con
--    un solo medio sigue guardando ese medio, igual que antes.
--  * fn_registrar_venta valida EN EL SERVIDOR que la suma de pagos == total de la venta
--    (si no se envían pagos, se asume un único pago por el total con p_medio_pago).
--  * Caja: se registra un movimiento 'venta' por cada medio. fn_anular_venta revierte
--    un egreso por cada pago. fn_cerrar_caja no cambia (ya suma movimientos en efectivo).
--  * fn_convertir_cotizacion admite pagos mixtos (nuevo parámetro opcional p_pagos).
--  * v_ventas_por_medio_pago pasa a leer venta_pagos.
-- Idempotente: se puede ejecutar dos veces. Ejecutar DESPUÉS de 33.
-- ============================================================================

-- 1) ventas.medio_pago acepta 'mixto' ----------------------------------------
alter table public.ventas drop constraint if exists ventas_medio_pago_check;
alter table public.ventas add constraint ventas_medio_pago_check
  check (medio_pago in ('efectivo','yape','plin','transferencia','tarjeta','otros','mixto'));

-- 2) Tabla de pagos por venta ---------------------------------------------------
create table if not exists public.venta_pagos (
  id          uuid primary key default gen_random_uuid(),
  venta_id    uuid not null references public.ventas(id) on delete cascade,
  medio_pago  text not null check (medio_pago in ('efectivo','yape','plin','transferencia','tarjeta','otros')),
  monto       numeric(12,2) not null check (monto > 0),
  created_at  timestamptz not null default now(),
  constraint venta_pagos_venta_medio_key unique (venta_id, medio_pago)
);

create index if not exists venta_pagos_venta_id_idx on public.venta_pagos (venta_id);

-- Solo lectura desde el cliente (igual que venta_detalles). Se escribe únicamente
-- desde fn_registrar_venta (SECURITY DEFINER).
alter table public.venta_pagos enable row level security;

drop policy if exists venta_pagos_select on public.venta_pagos;
create policy venta_pagos_select on public.venta_pagos
  for select to authenticated
  using (exists (
    select 1 from public.ventas v
    where v.id = venta_pagos.venta_id
      and v.empresa_id = public.mi_empresa_id()
      and public.has_permiso('ventas', 'ver')
      and (public.puede_ver_todas_las_sedes() or v.sede_id = public.mi_sede_id())
  ));

revoke all on public.venta_pagos from anon, public;
revoke insert, update, delete, truncate on public.venta_pagos from authenticated;
grant select on public.venta_pagos to authenticated;

-- 3) Ventas anteriores: un pago por el total con su medio (solo si aún no tienen pagos).
--    Las ventas de total 0 no tienen pagos (igual que no generan movimiento de caja).
insert into public.venta_pagos (venta_id, medio_pago, monto, created_at)
select v.id, v.medio_pago, v.total, v.created_at
from public.ventas v
where v.total > 0
  and v.medio_pago <> 'mixto'
  and not exists (select 1 from public.venta_pagos p where p.venta_id = v.id);

-- 4) fn_registrar_venta con pagos (nuevo parámetro opcional p_pagos) ------------
-- p_pagos: [{"medio_pago":"efectivo","monto":50.00}, {"medio_pago":"yape","monto":30.50}]
drop function if exists public.fn_registrar_venta(uuid, uuid, text, jsonb, text);

create or replace function public.fn_registrar_venta(
  p_sede_id          uuid,
  p_cliente_id       uuid,
  p_medio_pago       text,
  p_lineas           jsonb,
  p_observaciones    text default null,
  p_pagos            jsonb default null
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
  v_medios_validos    text[] := array['efectivo','yape','plin','transferencia','tarjeta','otros'];
  v_pagos             jsonb := '[]'::jsonb;
  v_pago              jsonb;
  v_pago_medio        text;
  v_pago_monto        numeric;
  v_suma_pagos        numeric(12,2) := 0;
  v_medios_vistos     text[] := array[]::text[];
  v_medio_venta       text;
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

  -- Pagos: la suma debe cuadrar EXACTO con el total (validación del servidor).
  if p_pagos is not null and jsonb_typeof(p_pagos) <> 'array' then
    raise exception 'El detalle de pagos no es válido.';
  end if;

  if p_pagos is not null and jsonb_array_length(p_pagos) > 0 then
    if v_total = 0 then
      raise exception 'Una venta de total 0 no admite pagos.';
    end if;
    for v_pago in select e from jsonb_array_elements(p_pagos) as e
    loop
      v_pago_medio := v_pago->>'medio_pago';
      if v_pago_medio is null or not (v_pago_medio = any (v_medios_validos)) then
        raise exception 'Medio de pago inválido: %.', coalesce(v_pago_medio, '(vacío)');
      end if;
      if v_pago_medio = any (v_medios_vistos) then
        raise exception 'El medio de pago "%" está repetido. Use un solo monto por medio.', v_pago_medio;
      end if;
      if jsonb_typeof(v_pago->'monto') <> 'number' then
        raise exception 'El monto de pago con % no es válido.', v_pago_medio;
      end if;
      v_pago_monto := (v_pago->>'monto')::numeric;
      if v_pago_monto <= 0 or v_pago_monto <> round(v_pago_monto, 2) then
        raise exception 'El monto de pago con % debe ser mayor a 0 y tener máximo 2 decimales.', v_pago_medio;
      end if;
      v_medios_vistos := v_medios_vistos || v_pago_medio;
      v_suma_pagos    := v_suma_pagos + v_pago_monto;
      v_pagos         := v_pagos || jsonb_build_object('medio_pago', v_pago_medio, 'monto', v_pago_monto);
    end loop;
    if v_suma_pagos <> v_total then
      raise exception 'La suma de los pagos (%) no coincide con el total de la venta (%).', v_suma_pagos, v_total;
    end if;
  elsif v_total > 0 then
    -- Sin detalle de pagos: un único pago por el total con p_medio_pago (comportamiento anterior).
    if p_medio_pago is null or not (p_medio_pago = any (v_medios_validos)) then
      raise exception 'Medio de pago inválido: %.', coalesce(p_medio_pago, '(vacío)');
    end if;
    v_pagos := jsonb_build_array(jsonb_build_object('medio_pago', p_medio_pago, 'monto', v_total));
  end if;

  v_medio_venta := case
    when jsonb_array_length(v_pagos) > 1 then 'mixto'
    when jsonb_array_length(v_pagos) = 1 then v_pagos->0->>'medio_pago'
    else p_medio_pago
  end;
  if v_medio_venta is null or not (v_medio_venta = any (v_medios_validos || array['mixto'])) then
    raise exception 'Medio de pago inválido: %.', coalesce(v_medio_venta, '(vacío)');
  end if;

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
    v_medio_venta, p_observaciones
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

  -- Un pago y un movimiento de caja por cada medio.
  -- movimientos_caja.monto exige > 0: una venta de total 0 no genera pagos ni movimientos.
  for v_pago in select * from jsonb_array_elements(v_pagos)
  loop
    insert into public.venta_pagos (venta_id, medio_pago, monto)
    values (v_venta.id, v_pago->>'medio_pago', (v_pago->>'monto')::numeric);

    insert into public.movimientos_caja (
      caja_sesion_id, sede_id, tipo, medio_pago, monto, concepto,
      referencia_tipo, referencia_id, usuario_id
    ) values (
      v_caja_sesion_id, p_sede_id, 'venta', v_pago->>'medio_pago', (v_pago->>'monto')::numeric,
      'Venta ' || v_venta.numero || case when v_medio_venta = 'mixto' then ' (pago mixto)' else '' end,
      'venta', v_venta.id, v_perfil.profile_id
    );
  end loop;

  insert into public.audit_logs (
    usuario_id, empresa_id, sede_id, accion, modulo, tabla_afectada, registro_id, datos_nuevos
  ) values (
    v_perfil.profile_id, v_empresa_id, p_sede_id, 'Venta registrada', 'ventas', 'ventas', v_venta.id,
    jsonb_build_object('numero', v_venta.numero, 'total', v_venta.total, 'medio_pago', v_medio_venta, 'pagos', v_pagos)
  );

  return v_venta;
end;
$$;

revoke execute on function public.fn_registrar_venta(uuid, uuid, text, jsonb, text, jsonb) from public, anon;
grant execute on function public.fn_registrar_venta(uuid, uuid, text, jsonb, text, jsonb) to authenticated;

-- 5) fn_convertir_cotizacion con pagos opcionales -------------------------------
drop function if exists public.fn_convertir_cotizacion(uuid, text);

create or replace function public.fn_convertir_cotizacion(
  p_cotizacion_id   uuid,
  p_medio_pago      text,
  p_pagos           jsonb default null
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
    v_cot.sede_id, v_cot.cliente_id, p_medio_pago, v_lineas, null, p_pagos
  );

  update public.cotizaciones set estado = 'convertida', venta_id = v_venta.id, updated_at = now()
    where id = p_cotizacion_id;

  return v_venta;
end;
$$;

revoke execute on function public.fn_convertir_cotizacion(uuid, text, jsonb) from public, anon;
grant execute on function public.fn_convertir_cotizacion(uuid, text, jsonb) to authenticated;

-- 6) fn_anular_venta: revierte TODOS los pagos (un egreso por medio) --------------
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
  v_sesion   uuid;
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

  -- Caja: el dinero de la venta sale de la caja abierta de la sede (si la hay), medio por medio.
  select cs.id into v_sesion
    from public.caja_sesiones cs
    join public.cajas c on c.id = cs.caja_id
    where c.sede_id = v_venta.sede_id and cs.estado = 'abierta'
    limit 1;

  if v_sesion is not null and v_venta.total > 0 then
    if exists (select 1 from public.venta_pagos where venta_id = v_venta.id) then
      insert into public.movimientos_caja (
        caja_sesion_id, sede_id, tipo, medio_pago, monto, concepto, referencia_tipo, referencia_id, usuario_id
      )
      select v_sesion, v_venta.sede_id, 'egreso', p.medio_pago, p.monto,
             'Anulación de venta ' || v_venta.numero, 'venta', v_venta.id, v_perfil.profile_id
      from public.venta_pagos p
      where p.venta_id = v_venta.id;
    elsif v_venta.medio_pago <> 'mixto' then
      -- Venta antigua sin renglones de pago: se revierte el total con su único medio.
      insert into public.movimientos_caja (
        caja_sesion_id, sede_id, tipo, medio_pago, monto, concepto, referencia_tipo, referencia_id, usuario_id
      ) values (
        v_sesion, v_venta.sede_id, 'egreso', v_venta.medio_pago, v_venta.total,
        'Anulación de venta ' || v_venta.numero, 'venta', v_venta.id, v_perfil.profile_id
      );
    end if;
  end if;

  insert into public.audit_logs (usuario_id, empresa_id, sede_id, accion, modulo, tabla_afectada, registro_id, datos_anteriores, datos_nuevos)
  values (v_perfil.profile_id, v_venta.empresa_id, v_venta.sede_id, 'Venta anulada: ' || p_motivo, 'ventas',
          'ventas', v_venta.id, jsonb_build_object('estado', 'confirmada'), jsonb_build_object('estado', 'anulada'));

  return v_venta;
end;
$$;

revoke execute on function public.fn_anular_venta(uuid, text) from public, anon;
grant execute on function public.fn_anular_venta(uuid, text) to authenticated;

-- 7) Vista por medio de pago: ahora suma los pagos reales (una venta mixta aporta a cada medio)
create or replace view public.v_ventas_por_medio_pago with (security_invoker = true) as
select v.sede_id, p.medio_pago, (v.fecha at time zone 'America/Lima')::date as dia,
       count(*) as cantidad_ventas, sum(p.monto) as total_vendido
from public.venta_pagos p
join public.ventas v on v.id = p.venta_id
where v.estado = 'confirmada'
group by v.sede_id, p.medio_pago, (v.fecha at time zone 'America/Lima')::date;
