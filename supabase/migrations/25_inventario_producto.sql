-- ============================================================================
-- 25_inventario_producto.sql
-- Crea (o actualiza) la fila de inventario de un producto en una sede: stock mínimo y
-- costo inicial. El cliente NO puede escribir en `inventario` (RLS de solo lectura),
-- así que esto se hace con una función SECURITY DEFINER, igual que las demás.
--  - Si no existía la fila, la crea con stock 0 (el stock entra por Compra o Ajuste).
--  - Si existía, solo cambia el stock mínimo; el costo solo se toca mientras el stock sea 0
--    (con stock > 0 el costo lo mueve el promedio ponderado de las compras).
-- ============================================================================
create or replace function public.fn_guardar_inventario_producto(
  p_producto_id   uuid,
  p_sede_id       uuid,
  p_stock_minimo  integer,
  p_costo         numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perfil record;
begin
  select * into v_perfil from public.current_profile();
  if v_perfil.profile_id is null or not v_perfil.activo then
    raise exception 'Usuario no autenticado o inactivo.' using errcode = '28000';
  end if;
  if not (public.has_permiso('productos', 'crear') or public.has_permiso('productos', 'editar')) then
    raise exception 'No tiene permiso para guardar productos.' using errcode = '42501';
  end if;
  if not public.es_administrador() and v_perfil.sede_id is distinct from p_sede_id then
    raise exception 'No puede modificar el inventario de otra sede.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.productos where id = p_producto_id and empresa_id = v_perfil.empresa_id
  ) then
    raise exception 'El producto no existe.';
  end if;
  if not exists (
    select 1 from public.sedes where id = p_sede_id and empresa_id = v_perfil.empresa_id
  ) then
    raise exception 'La sede no existe.';
  end if;

  insert into public.inventario (producto_id, sede_id, stock_actual, stock_minimo, costo_actual)
  values (p_producto_id, p_sede_id, 0, greatest(coalesce(p_stock_minimo, 0), 0), greatest(coalesce(p_costo, 0), 0))
  on conflict (producto_id, sede_id) do update
    set stock_minimo = excluded.stock_minimo,
        costo_actual = case when public.inventario.stock_actual = 0 then excluded.costo_actual else public.inventario.costo_actual end,
        updated_at   = now();
end;
$$;

grant execute on function public.fn_guardar_inventario_producto(uuid, uuid, integer, numeric) to authenticated;
