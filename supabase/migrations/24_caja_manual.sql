-- ============================================================================
-- 24_caja_manual.sql
--
-- 19_functions.sql cubre fn_abrir_caja / fn_cerrar_caja y los movimientos tipo
-- 'venta' (insertados dentro de fn_registrar_venta). Pero un ingreso/egreso manual
-- de caja (ej. "compra de útiles de oficina", "préstamo a caja chica") no tiene
-- dueño entre las funciones existentes, y movimientos_caja no tiene policy de
-- insert para `authenticated` (a propósito). Esta función llena ese hueco.
-- ============================================================================

create or replace function public.fn_registrar_movimiento_caja(
  p_tipo text,        -- 'ingreso' | 'egreso'
  p_medio_pago text,
  p_monto numeric,
  p_concepto text
)
returns public.movimientos_caja
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile record;
  v_caja_sesion record;
  v_mov public.movimientos_caja;
begin
  if p_tipo not in ('ingreso', 'egreso') then
    raise exception 'Tipo de movimiento de caja inválido: %', p_tipo;
  end if;
  if p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0.';
  end if;

  select * into v_profile from public.current_profile();
  if v_profile.profile_id is null or v_profile.sede_id is null then
    raise exception 'No tienes una sede asignada en tu perfil.';
  end if;
  if not public.has_permiso('caja', 'crear') then
    raise exception 'No tienes permiso para registrar movimientos de caja.';
  end if;

  select cs.*
  into v_caja_sesion
  from public.caja_sesiones cs
  join public.cajas c on c.id = cs.caja_id
  where c.sede_id = v_profile.sede_id and cs.estado = 'abierta'
  order by cs.abierta_en desc
  limit 1
  for update;

  if v_caja_sesion.id is null then
    raise exception 'No hay una caja abierta en tu sede.';
  end if;

  insert into public.movimientos_caja (caja_sesion_id, sede_id, tipo, medio_pago, monto, concepto, usuario_id)
  values (v_caja_sesion.id, v_profile.sede_id, p_tipo, p_medio_pago, p_monto, p_concepto, auth.uid())
  returning * into v_mov;

  return v_mov;
end;
$$;

grant execute on function public.fn_registrar_movimiento_caja(text, text, numeric, text) to authenticated;
