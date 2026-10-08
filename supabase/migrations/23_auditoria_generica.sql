-- ============================================================================
-- 23_auditoria_generica.sql
--
-- Las operaciones transaccionales grandes (venta, compra, apertura/cierre de caja)
-- ya registran su propia auditoría dentro de su función SECURITY DEFINER
-- (19_functions.sql). Pero el resto de módulos (clientes, proveedores, productos,
-- trabajadores, sedes, permisos...) son CRUD simple sobre tablas con policies
-- normales de insert/update para `authenticated` — no hay una función RPC "grande"
-- donde enganchar el registro de auditoría.
--
-- public.audit_logs no tiene policy de insert para authenticated (a propósito: solo
-- SECURITY DEFINER puede escribir ahí). Esta función rellena ese hueco: cualquier
-- usuario autenticado puede pedir "registra esta acción mía", pero la función decide
-- POR SU CUENTA el usuario/empresa/sede (auth.uid() + su profile) — el llamador no
-- puede falsificar de quién fue la acción, solo describe qué pasó.
-- ============================================================================

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

grant execute on function public.fn_registrar_auditoria(text, text, text, uuid, jsonb, jsonb) to authenticated;
