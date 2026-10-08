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
