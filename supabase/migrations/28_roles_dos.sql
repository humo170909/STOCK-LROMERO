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
