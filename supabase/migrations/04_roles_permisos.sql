-- ============================================================================
-- 04_roles_permisos.sql
-- Roles y permisos van ANTES que profiles (profiles.rol_id los referencia). Esto
-- invierte el orden "usuarios -> roles" sugerido originalmente porque la FK obliga
-- a crear primero la tabla referenciada; ver PARTE 1 de la respuesta para el detalle.
--
-- Estos INSERT son catálogo del sistema (roles, acciones, matriz de permisos por
-- defecto), no datos de negocio ficticios — están permitidos por la regla de no
-- insertar datos falsos.
-- ============================================================================

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,   -- 'administrador' | 'supervisor' | 'vendedor' | 'cajero' | 'almacen'
  nombre      text not null,
  descripcion text,
  created_at  timestamptz not null default now()
);

create table public.permisos (
  id          uuid primary key default gen_random_uuid(),
  modulo      text not null,   -- 'ventas','productos','inventario','compras','proveedores','clientes',
                                -- 'cotizaciones','movimientos','caja','trabajadores','reportes',
                                -- 'auditoria','usuarios','configuracion'
  accion      text not null,   -- 'ver','crear','editar','eliminar','aprobar','cancelar','exportar'
  descripcion text,
  created_at  timestamptz not null default now(),
  constraint permisos_modulo_accion_key unique (modulo, accion)
);

create table public.rol_permisos (
  rol_id     uuid not null references public.roles(id) on delete cascade,
  permiso_id uuid not null references public.permisos(id) on delete cascade,
  primary key (rol_id, permiso_id)
);

create index rol_permisos_rol_id_idx on public.rol_permisos (rol_id);
create index rol_permisos_permiso_id_idx on public.rol_permisos (permiso_id);

-- ---------------------------------------------------------------------------
-- Catálogo: roles mínimos (7.14)
-- ---------------------------------------------------------------------------
insert into public.roles (codigo, nombre, descripcion) values
  ('administrador', 'Administrador', 'Acceso completo a todos los módulos.'),
  ('supervisor',    'Supervisor',    'Acceso amplio, sin usuarios ni configuración.'),
  ('vendedor',      'Vendedor',      'Ventas, cotizaciones, clientes y catálogo de solo lectura.'),
  ('almacen',       'Almacén',       'Productos, inventario, movimientos, compras y proveedores.'),
  ('cajero',        'Cajero',        'Ventas, caja y clientes.');

-- ---------------------------------------------------------------------------
-- Catálogo: módulos x acciones (matriz completa de permisos posibles)
-- ---------------------------------------------------------------------------
insert into public.permisos (modulo, accion)
select modulo, accion
from unnest(array[
  'ventas','productos','inventario','compras','proveedores','clientes',
  'cotizaciones','movimientos','caja','trabajadores','reportes',
  'auditoria','usuarios','configuracion'
]) as modulo
cross join unnest(array['ver','crear','editar','eliminar','aprobar','cancelar','exportar']) as accion;

-- ---------------------------------------------------------------------------
-- Matriz de permisos por defecto por rol (ajustable después vía UI de Usuarios y
-- Permisos; esto es solo el punto de partida). Administrador recibe TODO.
-- ---------------------------------------------------------------------------
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
cross join public.permisos p
where r.codigo = 'administrador';

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p
  on p.modulo in ('ventas','productos','inventario','compras','proveedores','clientes',
                   'cotizaciones','movimientos','caja','trabajadores','reportes')
  and p.accion in ('ver','crear','editar','exportar')
where r.codigo = 'supervisor';

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p
  on (p.modulo in ('ventas','cotizaciones','clientes') and p.accion in ('ver','crear','editar'))
  or (p.modulo = 'productos' and p.accion = 'ver')
where r.codigo = 'vendedor';

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p
  on p.modulo in ('productos','inventario','movimientos','compras','proveedores')
  and p.accion in ('ver','crear','editar')
where r.codigo = 'almacen';

insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p
  on (p.modulo in ('ventas','clientes') and p.accion in ('ver','crear'))
  or (p.modulo = 'caja' and p.accion in ('ver','crear','editar'))
where r.codigo = 'cajero';
