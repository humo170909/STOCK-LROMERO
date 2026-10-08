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
