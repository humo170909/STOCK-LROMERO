-- ============================================================================
-- INSTALACIÓN COMPLETA — Stock Grupo LRomero (sin facturación electrónica)
-- Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
-- Es la suma de las migraciones 01..34, 36 y 37 de supabase/migrations/, en orden.
-- Úsalo en un proyecto Supabase NUEVO (sin tablas propias). Si falla, lee el error:
-- no ejecutes nada más hasta corregirlo.
-- Después: crea tu usuario en Authentication y ejecuta 01_primer_arranque.sql.
-- ============================================================================


-- >>>>>>>>>>>>>>>>>>>> 01_extensions.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 01_extensions.sql
-- Extensiones necesarias. Ejecutar primero.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- búsqueda por similitud (nombre, documento)

-- >>>>>>>>>>>>>>>>>>>> 02_empresa.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 02_empresa.sql
-- Tabla raíz. Todo lo demás cuelga de empresa_id, incluso si hoy solo existe una fila.
-- ============================================================================

create table public.empresas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  razon_social    text not null,
  documento       text,                          -- documento de la empresa: opcional y libre, sin validación tributaria
  direccion       text,
  telefono        text,
  correo          text,
  logo_url        text,
  moneda          text not null default 'PEN',
  impuesto        numeric(5,4) not null default 0 check (impuesto >= 0 and impuesto <= 1),  -- cargo opcional (0.05 = 5 %); 0 = sin impuesto
  configuracion   jsonb not null default '{}'::jsonb,  -- flags/formatos no estructurales (medios de pago activos, etc.)
  estado          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.empresas is 'Raíz del tenant. No almacena secretos ni claves.';

-- >>>>>>>>>>>>>>>>>>>> 03_sedes.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 03_sedes.sql
-- ============================================================================

create table public.sedes (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  codigo      text not null,
  direccion   text,
  telefono    text,
  estado      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sedes_empresa_codigo_key unique (empresa_id, codigo)
);

create index sedes_empresa_id_idx on public.sedes (empresa_id);
create index sedes_estado_idx on public.sedes (estado) where estado = true;

-- >>>>>>>>>>>>>>>>>>>> 04_roles_permisos.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 05_profiles.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 05_profiles.sql
-- Perfil de aplicación 1:1 con auth.users. Nunca se guarda contraseña aquí —
-- Supabase Auth la gestiona por completo en auth.users (tabla gestionada por
-- Supabase, fuera de nuestro esquema).
-- ============================================================================

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id),
  sede_id     uuid references public.sedes(id),       -- sede principal; null = multi-sede (solo administrador/supervisor)
  rol_id      uuid not null references public.roles(id),
  nombre      text not null,
  documento   text,
  telefono    text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_empresa_id_idx on public.profiles (empresa_id);
create index profiles_sede_id_idx on public.profiles (sede_id);
create index profiles_rol_id_idx on public.profiles (rol_id);

comment on table public.profiles is
  'Datos de aplicación del usuario. id = auth.users.id. Password/MFA/tokens viven '
  'exclusivamente en auth.users, gestionados por Supabase Auth.';

-- >>>>>>>>>>>>>>>>>>>> 06_categorias.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 06_categorias.sql
-- ============================================================================

create table public.categorias (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  estado      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categorias_empresa_nombre_key unique (empresa_id, nombre)
);

create index categorias_empresa_id_idx on public.categorias (empresa_id);

-- >>>>>>>>>>>>>>>>>>>> 07_productos.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 07_productos.sql
-- Catálogo maestro (datos que NO varían por sede). El stock y el costo real por
-- ubicación viven en inventario (08_inventario.sql) porque el stock es por sede.
-- ============================================================================

create table public.productos (
  id                       uuid primary key default gen_random_uuid(),
  empresa_id               uuid not null references public.empresas(id) on delete cascade,
  categoria_id             uuid references public.categorias(id),
  codigo                   text not null,              -- SKU
  codigo_barras            text,
  nombre                   text not null,
  descripcion              text,
  especificacion_tecnica   text,
  marca                    text,
  unidad_medida            text not null default 'unidad',
  precio_venta             numeric(12,2) not null check (precio_venta >= 0),
  costo_actual             numeric(12,2) not null default 0 check (costo_actual >= 0),
  -- Mínimo por defecto al crear inventario en una sede nueva; el umbral operativo
  -- real de alertas de stock vive en inventario.stock_minimo (puede variar por sede).
  stock_minimo_default     integer not null default 0 check (stock_minimo_default >= 0),
  estado                   boolean not null default true,
  deleted_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint productos_empresa_codigo_key unique (empresa_id, codigo)
);

create index productos_empresa_id_idx on public.productos (empresa_id) where deleted_at is null;
create index productos_categoria_id_idx on public.productos (categoria_id);
create index productos_codigo_barras_idx on public.productos (codigo_barras);
create index productos_nombre_trgm_idx on public.productos using gin (nombre gin_trgm_ops);

-- >>>>>>>>>>>>>>>>>>>> 08_inventario.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 08_inventario.sql
-- producto + sede = inventario. Esta es la tabla que realmente se lee/escribe en
-- cada venta y compra; productos.costo_actual queda como referencia agregada.
-- ============================================================================

create table public.inventario (
  id            uuid primary key default gen_random_uuid(),
  producto_id   uuid not null references public.productos(id) on delete cascade,
  sede_id       uuid not null references public.sedes(id) on delete cascade,
  stock_actual  integer not null default 0 check (stock_actual >= 0),
  stock_minimo  integer not null default 0 check (stock_minimo >= 0),
  costo_actual  numeric(12,2) not null default 0 check (costo_actual >= 0),
  updated_at    timestamptz not null default now(),
  constraint inventario_producto_sede_key unique (producto_id, sede_id)
);

create index inventario_producto_id_idx on public.inventario (producto_id);
create index inventario_sede_id_idx on public.inventario (sede_id);
-- Acelera "stock crítico": filas donde el stock ya tocó o pasó el mínimo.
create index inventario_stock_critico_idx on public.inventario (sede_id) where stock_actual <= stock_minimo;

-- >>>>>>>>>>>>>>>>>>>> 09_movimientos_inventario.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 09_movimientos_inventario.sql
-- Kárdex. stock_nuevo es una columna GENERADA: no puede quedar inconsistente con
-- stock_anterior + cantidad porque Postgres la calcula, nunca se inserta a mano.
-- ============================================================================

create table public.movimientos_inventario (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id),
  sede_id          uuid not null references public.sedes(id),
  producto_id      uuid not null references public.productos(id),
  tipo             text not null check (tipo in ('entrada','salida','ajuste','compra','venta','devolucion','correccion')),
  cantidad         integer not null,                 -- delta firmado: + entra, - sale
  stock_anterior   integer not null check (stock_anterior >= 0),
  stock_nuevo      integer generated always as (stock_anterior + cantidad) stored,
  motivo           text,
  referencia_tipo  text check (referencia_tipo in ('venta','compra','ajuste','cotizacion','devolucion')),
  referencia_id    uuid,                              -- apunta a ventas/compras/etc. según referencia_tipo (polimórfico, sin FK)
  documento_sustento text,
  observaciones    text,
  usuario_id       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  constraint movimientos_stock_nuevo_check check (stock_nuevo >= 0)
);

create index movimientos_sede_id_idx on public.movimientos_inventario (sede_id);
create index movimientos_producto_id_idx on public.movimientos_inventario (producto_id);
create index movimientos_created_at_idx on public.movimientos_inventario (created_at desc);
create index movimientos_referencia_idx on public.movimientos_inventario (referencia_tipo, referencia_id);

-- >>>>>>>>>>>>>>>>>>>> 10_clientes.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 10_clientes.sql
-- ============================================================================

create table public.clientes (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  numero_documento  text,                       -- documento libre (DNI, RUC u otro). Opcional.
  nombre            text not null,
  telefono          text,
  correo            text,
  direccion         text,
  linea_credito     numeric(12,2) not null default 0 check (linea_credito >= 0),
  riesgo            text not null default 'bajo' check (riesgo in ('bajo','medio','alto')),
  estado            boolean not null default true,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Unicidad solo cuando hay documento (varios clientes sin documento son válidos).
create unique index clientes_empresa_documento_key
  on public.clientes (empresa_id, numero_documento)
  where numero_documento is not null and numero_documento <> '' and deleted_at is null;

create index clientes_empresa_id_idx on public.clientes (empresa_id) where deleted_at is null;
create index clientes_numero_documento_idx on public.clientes (numero_documento);
create index clientes_nombre_trgm_idx on public.clientes using gin (nombre gin_trgm_ops);

-- >>>>>>>>>>>>>>>>>>>> 11_proveedores.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 11_proveedores.sql
-- ============================================================================

create table public.proveedores (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  razon_social  text not null,
  documento     text,                         -- documento libre. Opcional.
  telefono      text,
  correo        text,
  direccion     text,
  contacto      text,
  observaciones text,
  estado        boolean not null default true,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index proveedores_empresa_documento_key
  on public.proveedores (empresa_id, documento)
  where documento is not null and documento <> '' and deleted_at is null;

create index proveedores_empresa_id_idx on public.proveedores (empresa_id) where deleted_at is null;
create index proveedores_razon_social_trgm_idx on public.proveedores using gin (razon_social gin_trgm_ops);

-- >>>>>>>>>>>>>>>>>>>> 12_ventas.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 12_ventas.sql
-- subtotal = suma de precio*cantidad ANTES de descuento (bruto).
-- total = subtotal - descuento + impuesto.
-- ganancia_total es columna GENERADA: total - impuesto - costo_total. No se puede
-- insertar un valor inconsistente porque Postgres la calcula siempre.
-- ============================================================================

create table public.ventas (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id),
  sede_id           uuid not null references public.sedes(id),
  cliente_id        uuid not null references public.clientes(id),
  usuario_id        uuid not null references public.profiles(id),
  numero            text not null,                 -- nota de venta interna: NV-000001
  correlativo       integer not null check (correlativo > 0),
  fecha             timestamptz not null default now(),
  subtotal          numeric(12,2) not null check (subtotal >= 0),
  descuento         numeric(12,2) not null default 0 check (descuento >= 0),
  impuesto          numeric(12,2) not null default 0 check (impuesto >= 0),
  total             numeric(12,2) not null check (total >= 0),
  costo_total       numeric(12,2) not null default 0 check (costo_total >= 0),
  ganancia_total    numeric(12,2) generated always as (total - impuesto - costo_total) stored,
  medio_pago        text not null check (medio_pago in ('efectivo','yape','plin','transferencia','tarjeta','otros')),
  estado            text not null default 'confirmada' check (estado in ('confirmada','anulada')),
  observaciones     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint ventas_empresa_correlativo_key unique (empresa_id, correlativo),
  constraint ventas_descuento_subtotal_check check (descuento <= subtotal),
  constraint ventas_total_formula_check check (total = subtotal - descuento + impuesto)
);

create index ventas_sede_id_idx on public.ventas (sede_id);
create index ventas_cliente_id_idx on public.ventas (cliente_id);
create index ventas_usuario_id_idx on public.ventas (usuario_id);
create index ventas_fecha_idx on public.ventas (fecha desc);
create index ventas_estado_idx on public.ventas (estado);

create table public.venta_detalles (
  id                uuid primary key default gen_random_uuid(),
  venta_id          uuid not null references public.ventas(id) on delete cascade,
  producto_id       uuid not null references public.productos(id),
  cantidad          integer not null check (cantidad > 0),
  -- Fotografía histórica: estos dos valores NUNCA se recalculan si el producto cambia después.
  precio_unitario   numeric(12,2) not null check (precio_unitario >= 0),
  costo_unitario    numeric(12,2) not null check (costo_unitario >= 0),
  descuento         numeric(12,2) not null default 0 check (descuento >= 0),
  impuesto          numeric(12,2) not null default 0 check (impuesto >= 0),
  subtotal          numeric(12,2) generated always as (precio_unitario * cantidad - descuento) stored,
  costo_total       numeric(12,2) generated always as (costo_unitario * cantidad) stored,
  ganancia          numeric(12,2) generated always as (precio_unitario * cantidad - descuento - costo_unitario * cantidad) stored,
  created_at        timestamptz not null default now()
);

create index venta_detalles_venta_id_idx on public.venta_detalles (venta_id);
create index venta_detalles_producto_id_idx on public.venta_detalles (producto_id);

-- >>>>>>>>>>>>>>>>>>>> 13_cotizaciones.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 13_cotizaciones.sql
-- ============================================================================

create table public.cotizaciones (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id),
  sede_id             uuid not null references public.sedes(id),
  cliente_id          uuid not null references public.clientes(id),
  usuario_id          uuid not null references public.profiles(id),
  numero              text not null,
  fecha_emision       timestamptz not null default now(),
  fecha_vencimiento   timestamptz not null,
  condiciones         text,
  subtotal            numeric(12,2) not null check (subtotal >= 0),
  descuento           numeric(12,2) not null default 0 check (descuento >= 0),
  impuesto            numeric(12,2) not null default 0 check (impuesto >= 0),
  total               numeric(12,2) not null check (total >= 0),
  estado              text not null default 'borrador'
                        check (estado in ('borrador','enviada','aceptada','rechazada','vencida','convertida')),
  venta_id            uuid references public.ventas(id),   -- se llena al convertir
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint cotizaciones_empresa_numero_key unique (empresa_id, numero),
  constraint cotizaciones_fecha_check check (fecha_vencimiento >= fecha_emision),
  constraint cotizaciones_convertida_check check (estado <> 'convertida' or venta_id is not null)
);

create index cotizaciones_sede_id_idx on public.cotizaciones (sede_id);
create index cotizaciones_cliente_id_idx on public.cotizaciones (cliente_id);
create index cotizaciones_estado_idx on public.cotizaciones (estado);
create index cotizaciones_vencimiento_idx on public.cotizaciones (fecha_vencimiento) where estado = 'enviada';

create table public.cotizacion_detalles (
  id              uuid primary key default gen_random_uuid(),
  cotizacion_id   uuid not null references public.cotizaciones(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  descuento       numeric(12,2) not null default 0 check (descuento >= 0),
  subtotal        numeric(12,2) generated always as (precio_unitario * cantidad - descuento) stored,
  created_at      timestamptz not null default now()
);

create index cotizacion_detalles_cotizacion_id_idx on public.cotizacion_detalles (cotizacion_id);
create index cotizacion_detalles_producto_id_idx on public.cotizacion_detalles (producto_id);

-- >>>>>>>>>>>>>>>>>>>> 14_compras.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 14_compras.sql
-- ============================================================================

create table public.compras (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id),
  sede_id           uuid not null references public.sedes(id),
  proveedor_id      uuid not null references public.proveedores(id),
  usuario_id        uuid not null references public.profiles(id),
  numero_documento  text not null,
  fecha             timestamptz not null default now(),
  subtotal          numeric(12,2) not null check (subtotal >= 0),
  impuesto          numeric(12,2) not null default 0 check (impuesto >= 0),
  total             numeric(12,2) not null check (total >= 0),
  estado            text not null default 'registrada' check (estado in ('registrada','anulada')),
  observaciones     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint compras_empresa_documento_key unique (empresa_id, numero_documento),
  constraint compras_total_formula_check check (total = subtotal + impuesto)
);

create index compras_sede_id_idx on public.compras (sede_id);
create index compras_proveedor_id_idx on public.compras (proveedor_id);
create index compras_fecha_idx on public.compras (fecha desc);
create index compras_estado_idx on public.compras (estado);

create table public.compra_detalles (
  id              uuid primary key default gen_random_uuid(),
  compra_id       uuid not null references public.compras(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  cantidad        integer not null check (cantidad > 0),
  costo_unitario  numeric(12,2) not null check (costo_unitario >= 0),
  subtotal        numeric(12,2) generated always as (costo_unitario * cantidad) stored,
  created_at      timestamptz not null default now()
);

create index compra_detalles_compra_id_idx on public.compra_detalles (compra_id);
create index compra_detalles_producto_id_idx on public.compra_detalles (producto_id);

-- >>>>>>>>>>>>>>>>>>>> 15_caja.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 15_caja.sql
-- cajas = registradoras lógicas por sede (casi siempre una, pero el modelo admite
-- varias). caja_sesiones = cada apertura/cierre. movimientos_caja = el detalle de
-- dinero dentro de una sesión. Una VENTA nunca es lo mismo que un INGRESO DE CAJA:
-- la venta vive en `ventas`, el dinero que entra por ella vive aquí como un
-- movimiento tipo 'venta' referenciando esa venta.
-- ============================================================================

create table public.cajas (
  id          uuid primary key default gen_random_uuid(),
  sede_id     uuid not null references public.sedes(id) on delete cascade,
  nombre      text not null default 'Caja principal',
  estado      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint cajas_sede_nombre_key unique (sede_id, nombre)
);

create index cajas_sede_id_idx on public.cajas (sede_id);

create table public.caja_sesiones (
  id                     uuid primary key default gen_random_uuid(),
  caja_id                uuid not null references public.cajas(id),
  usuario_apertura_id    uuid not null references public.profiles(id),
  usuario_cierre_id      uuid references public.profiles(id),
  estado                 text not null default 'abierta' check (estado in ('abierta','cerrada')),
  monto_apertura         numeric(12,2) not null default 0 check (monto_apertura >= 0),
  monto_cierre_esperado  numeric(12,2),
  monto_cierre_real      numeric(12,2),
  diferencia             numeric(12,2) generated always as (monto_cierre_real - monto_cierre_esperado) stored,
  abierta_en             timestamptz not null default now(),
  cerrada_en             timestamptz,
  constraint caja_sesiones_cierre_check check (
    (estado = 'abierta' and cerrada_en is null)
    or (estado = 'cerrada' and cerrada_en is not null and monto_cierre_real is not null)
  )
);

create index caja_sesiones_caja_id_idx on public.caja_sesiones (caja_id);
-- Como mucho una sesión abierta por caja a la vez.
create unique index caja_sesiones_una_abierta_idx on public.caja_sesiones (caja_id) where estado = 'abierta';

create table public.movimientos_caja (
  id                uuid primary key default gen_random_uuid(),
  caja_sesion_id    uuid not null references public.caja_sesiones(id),
  sede_id           uuid not null references public.sedes(id),
  tipo              text not null check (tipo in ('apertura','venta','ingreso','egreso','cierre','ajuste')),
  medio_pago        text not null check (medio_pago in ('efectivo','yape','plin','transferencia','tarjeta','otros')),
  monto             numeric(12,2) not null check (monto > 0),
  concepto          text not null,
  referencia_tipo   text check (referencia_tipo in ('venta','ajuste')),
  referencia_id     uuid,
  usuario_id        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now()
);

create index movimientos_caja_sesion_id_idx on public.movimientos_caja (caja_sesion_id);
create index movimientos_caja_sede_id_idx on public.movimientos_caja (sede_id);
create index movimientos_caja_created_at_idx on public.movimientos_caja (created_at desc);

-- >>>>>>>>>>>>>>>>>>>> 16_trabajadores.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 16_trabajadores.sql
-- profile_id es opcional: un trabajador puede existir sin tener cuenta de acceso.
-- ============================================================================

create table public.trabajadores (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  sede_id       uuid not null references public.sedes(id),
  profile_id    uuid references public.profiles(id),
  nombre        text not null,
  documento     text not null check (char_length(documento) = 8),
  telefono      text,
  cargo         text not null,
  ingresado_en  date not null default current_date,
  estado        boolean not null default true,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint trabajadores_empresa_documento_key unique (empresa_id, documento)
);

create index trabajadores_empresa_id_idx on public.trabajadores (empresa_id) where deleted_at is null;
create index trabajadores_sede_id_idx on public.trabajadores (sede_id);
create index trabajadores_profile_id_idx on public.trabajadores (profile_id);

-- >>>>>>>>>>>>>>>>>>>> 17_notificaciones.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 17_notificaciones.sql
-- usuario_id null = notificación de alcance "toda la sede/empresa" (p. ej. stock
-- crítico), no de una persona específica.
-- ============================================================================

create table public.notificaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id),
  sede_id         uuid references public.sedes(id),
  usuario_id      uuid references public.profiles(id),
  tipo            text not null check (tipo in (
                    'stock_critico','producto_agotado','operacion_pendiente',
                    'caja_pendiente','cotizacion_por_vencer','alerta_administrativa'
                  )),
  titulo          text not null,
  mensaje         text not null,
  leida           boolean not null default false,
  referencia_tipo text,
  referencia_id   uuid,
  created_at      timestamptz not null default now()
);

create index notificaciones_usuario_id_idx on public.notificaciones (usuario_id, leida);
create index notificaciones_sede_id_idx on public.notificaciones (sede_id);
create index notificaciones_created_at_idx on public.notificaciones (created_at desc);

-- >>>>>>>>>>>>>>>>>>>> 18_auditoria.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 18_auditoria.sql
-- Tabla de solo-inserción. Ningún rol de aplicación puede UPDATE/DELETE aquí —
-- ni siquiera si una policy de RLS se configurara mal más adelante, porque el
-- REVOKE de abajo actúa a nivel de permisos de Postgres, antes de que RLS entre
-- a evaluarse.
-- ============================================================================

create table public.audit_logs (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid references public.profiles(id),
  empresa_id        uuid references public.empresas(id),
  sede_id           uuid references public.sedes(id),
  accion            text not null,
  modulo            text not null,
  tabla_afectada    text,
  registro_id       uuid,
  datos_anteriores  jsonb,
  datos_nuevos      jsonb,
  ip                inet,
  user_agent        text,
  created_at        timestamptz not null default now()
);

create index audit_logs_usuario_id_idx on public.audit_logs (usuario_id);
create index audit_logs_empresa_id_idx on public.audit_logs (empresa_id);
create index audit_logs_modulo_idx on public.audit_logs (modulo);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_registro_idx on public.audit_logs (tabla_afectada, registro_id);

-- Defensa en profundidad: aunque algún día una policy de RLS quedara mal escrita,
-- estos roles ya no tienen el permiso de Postgres para mutar la tabla.
revoke update, delete on public.audit_logs from authenticated, anon;

-- >>>>>>>>>>>>>>>>>>>> 19_functions.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 20_triggers.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 20_triggers.sql
-- ============================================================================

create trigger trg_empresas_updated_at before update on public.empresas
  for each row execute function public.set_updated_at();

create trigger trg_sedes_updated_at before update on public.sedes
  for each row execute function public.set_updated_at();

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_categorias_updated_at before update on public.categorias
  for each row execute function public.set_updated_at();

create trigger trg_productos_updated_at before update on public.productos
  for each row execute function public.set_updated_at();

create trigger trg_inventario_updated_at before update on public.inventario
  for each row execute function public.set_updated_at();

create trigger trg_clientes_updated_at before update on public.clientes
  for each row execute function public.set_updated_at();

create trigger trg_proveedores_updated_at before update on public.proveedores
  for each row execute function public.set_updated_at();

create trigger trg_ventas_updated_at before update on public.ventas
  for each row execute function public.set_updated_at();

create trigger trg_cotizaciones_updated_at before update on public.cotizaciones
  for each row execute function public.set_updated_at();

create trigger trg_compras_updated_at before update on public.compras
  for each row execute function public.set_updated_at();

create trigger trg_trabajadores_updated_at before update on public.trabajadores
  for each row execute function public.set_updated_at();

-- Bloqueo duro de auditoría: ni siquiera el propietario de una transacción con un
-- bug puede mutar un registro ya escrito.
create trigger trg_audit_logs_no_update before update on public.audit_logs
  for each row execute function public.fn_block_audit_mutation();

create trigger trg_audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.fn_block_audit_mutation();

-- >>>>>>>>>>>>>>>>>>>> 21_views.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 21_views.sql
-- Las views heredan RLS de las tablas base (security_invoker), así que no hace
-- falta — ni conviene — crear policies aparte para ellas.
-- ============================================================================

create view public.v_stock_critico as
select
  i.id as inventario_id,
  i.sede_id,
  p.id as producto_id,
  p.empresa_id,
  p.codigo,
  p.nombre,
  i.stock_actual,
  i.stock_minimo,
  case
    when i.stock_actual <= 0 then 'agotado'
    when i.stock_actual <= i.stock_minimo then 'stock_bajo'
    else 'disponible'
  end as estado_stock
from public.inventario i
join public.productos p on p.id = i.producto_id
where p.deleted_at is null and i.stock_actual <= i.stock_minimo;

create view public.v_ventas_por_dia as
select
  v.sede_id,
  v.fecha::date as dia,
  count(*) as cantidad_ventas,
  sum(v.total) as total_vendido,
  sum(v.costo_total) as costo_total,
  sum(v.ganancia_total) as ganancia_total
from public.ventas v
where v.estado = 'confirmada'
group by v.sede_id, v.fecha::date;

create view public.v_ganancia_por_producto as
select
  vd.producto_id,
  p.empresa_id,
  p.codigo,
  p.nombre,
  sum(vd.cantidad) as cantidad_vendida,
  sum(vd.subtotal) as venta_total,
  sum(vd.costo_total) as costo_total,
  sum(vd.ganancia) as ganancia_total,
  case when sum(vd.subtotal) > 0
    then round(sum(vd.ganancia) / sum(vd.subtotal) * 100, 2)
    else 0
  end as margen_pct
from public.venta_detalles vd
join public.ventas v on v.id = vd.venta_id and v.estado = 'confirmada'
join public.productos p on p.id = vd.producto_id
group by vd.producto_id, p.empresa_id, p.codigo, p.nombre;

create view public.v_ventas_por_medio_pago as
select sede_id, medio_pago, fecha::date as dia, count(*) as cantidad_ventas, sum(total) as total_vendido
from public.ventas
where estado = 'confirmada'
group by sede_id, medio_pago, fecha::date;

create view public.v_ventas_por_trabajador as
select
  v.usuario_id,
  pr.nombre as nombre_usuario,
  v.sede_id,
  v.fecha::date as dia,
  count(*) as cantidad_ventas,
  sum(v.total) as total_vendido
from public.ventas v
join public.profiles pr on pr.id = v.usuario_id
where v.estado = 'confirmada'
group by v.usuario_id, pr.nombre, v.sede_id, v.fecha::date;

create view public.v_productos_mas_vendidos as
select
  vd.producto_id,
  p.nombre,
  p.empresa_id,
  sum(vd.cantidad) as cantidad_vendida,
  sum(vd.subtotal) as monto_vendido
from public.venta_detalles vd
join public.ventas v on v.id = vd.venta_id and v.estado = 'confirmada'
join public.productos p on p.id = vd.producto_id
group by vd.producto_id, p.nombre, p.empresa_id;

-- >>>>>>>>>>>>>>>>>>>> 22_rls.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 22_rls.sql
--
-- Principio: cada tabla parte DENEGADA por defecto (RLS activado, cero policies)
-- y se abre exactamente lo necesario. Las tablas transaccionales (ventas,
-- compras, inventario, movimientos, caja) NO tienen policies de escritura en
-- absoluto para `authenticated` — solo se escriben a través de las funciones
-- SECURITY DEFINER de 19_functions.sql, que ya validan permiso/sede por dentro.
-- Esto es intencional: ninguna policy de UPDATE/INSERT habría sido suficiente
-- para expresar "stock no puede quedar negativo bajo concurrencia", así que esa
-- lógica vive en las funciones, no en RLS.
-- ============================================================================

-- Helper local: administrador y supervisor ven todas las sedes de su empresa.
create or replace function public.puede_ver_todas_las_sedes()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p join public.roles r on r.id = p.rol_id
    where p.id = auth.uid() and r.codigo in ('administrador', 'supervisor') and p.activo
  );
$$;

grant execute on function public.puede_ver_todas_las_sedes() to authenticated;

-- ---------------------------------------------------------------------------
-- empresas
-- ---------------------------------------------------------------------------
alter table public.empresas enable row level security;

create policy empresas_select on public.empresas
  for select to authenticated
  using (id = public.mi_empresa_id());

create policy empresas_update on public.empresas
  for update to authenticated
  using (id = public.mi_empresa_id() and public.es_administrador())
  with check (id = public.mi_empresa_id() and public.es_administrador());

-- ---------------------------------------------------------------------------
-- sedes
-- ---------------------------------------------------------------------------
alter table public.sedes enable row level security;

create policy sedes_select on public.sedes
  for select to authenticated
  using (empresa_id = public.mi_empresa_id());

create policy sedes_insert on public.sedes
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('configuracion', 'crear'));

create policy sedes_update on public.sedes
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('configuracion', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- roles / permisos / rol_permisos — catálogo de referencia: todos leen, solo
-- administrador con permiso sobre 'usuarios' edita la matriz.
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permisos enable row level security;
alter table public.rol_permisos enable row level security;

create policy roles_select on public.roles for select to authenticated using (true);
create policy permisos_select on public.permisos for select to authenticated using (true);
create policy rol_permisos_select on public.rol_permisos for select to authenticated using (true);

create policy rol_permisos_update on public.rol_permisos
  for all to authenticated
  using (public.es_administrador())
  with check (public.es_administrador());

-- ---------------------------------------------------------------------------
-- profiles
-- SELECT: cualquiera de tu empresa (para listas de "vendedor", asignación, etc.).
-- UPDATE directa: SOLO administrador (rol_id/activo/sede_id son datos de control
-- de acceso — cambiarlos es, en los hechos, otorgar o quitar privilegios). El
-- propio usuario actualiza nombre/teléfono vía fn_actualizar_mi_perfil(), nunca
-- con un UPDATE directo a la tabla.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (empresa_id = public.mi_empresa_id());

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('usuarios', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- categorias
-- ---------------------------------------------------------------------------
alter table public.categorias enable row level security;

create policy categorias_select on public.categorias
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'ver'));

create policy categorias_insert on public.categorias
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'crear'));

create policy categorias_update on public.categorias
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- productos (sin DELETE: usar estado=false o deleted_at, nunca borrado físico)
-- ---------------------------------------------------------------------------
alter table public.productos enable row level security;

create policy productos_select on public.productos
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'ver'));

create policy productos_insert on public.productos
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'crear'));

create policy productos_update on public.productos
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- inventario — solo lectura desde el cliente; se escribe vía RPC.
-- ---------------------------------------------------------------------------
alter table public.inventario enable row level security;

create policy inventario_select on public.inventario
  for select to authenticated
  using (
    public.has_permiso('inventario', 'ver')
    and sede_id in (select id from public.sedes where empresa_id = public.mi_empresa_id())
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

-- ---------------------------------------------------------------------------
-- movimientos_inventario — solo lectura; se escribe vía RPC.
-- ---------------------------------------------------------------------------
alter table public.movimientos_inventario enable row level security;

create policy movimientos_inventario_select on public.movimientos_inventario
  for select to authenticated
  using (
    public.has_permiso('movimientos', 'ver')
    and empresa_id = public.mi_empresa_id()
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

-- ---------------------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------------------
alter table public.clientes enable row level security;

create policy clientes_select on public.clientes
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('clientes', 'ver'));

create policy clientes_insert on public.clientes
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('clientes', 'crear'));

create policy clientes_update on public.clientes
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('clientes', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- proveedores
-- ---------------------------------------------------------------------------
alter table public.proveedores enable row level security;

create policy proveedores_select on public.proveedores
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('proveedores', 'ver'));

create policy proveedores_insert on public.proveedores
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('proveedores', 'crear'));

create policy proveedores_update on public.proveedores
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('proveedores', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- ventas / venta_detalles — SOLO LECTURA. Escritura únicamente vía
-- fn_registrar_venta / fn_anular_venta (SECURITY DEFINER).
-- ---------------------------------------------------------------------------
alter table public.ventas enable row level security;
alter table public.venta_detalles enable row level security;

create policy ventas_select on public.ventas
  for select to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and public.has_permiso('ventas', 'ver')
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

create policy venta_detalles_select on public.venta_detalles
  for select to authenticated
  using (exists (
    select 1 from public.ventas v
    where v.id = venta_detalles.venta_id
      and v.empresa_id = public.mi_empresa_id()
      and public.has_permiso('ventas', 'ver')
      and (public.puede_ver_todas_las_sedes() or v.sede_id = public.mi_sede_id())
  ));

-- ---------------------------------------------------------------------------
-- cotizaciones / cotizacion_detalles — la cabecera+detalle SÍ se pueden crear
-- directo desde el cliente (no mueven stock ni caja); la CONVERSIÓN a venta
-- exige la RPC. El WITH CHECK bloquea poner estado='convertida' a mano.
-- ---------------------------------------------------------------------------
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_detalles enable row level security;

create policy cotizaciones_select on public.cotizaciones
  for select to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and public.has_permiso('cotizaciones', 'ver')
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

create policy cotizaciones_insert on public.cotizaciones
  for insert to authenticated
  with check (
    empresa_id = public.mi_empresa_id()
    and usuario_id = auth.uid()
    and public.has_permiso('cotizaciones', 'crear')
    and estado = 'borrador'
  );

create policy cotizaciones_update on public.cotizaciones
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('cotizaciones', 'editar'))
  with check (empresa_id = public.mi_empresa_id() and estado <> 'convertida');

create policy cotizacion_detalles_select on public.cotizacion_detalles
  for select to authenticated
  using (exists (
    select 1 from public.cotizaciones c
    where c.id = cotizacion_detalles.cotizacion_id and c.empresa_id = public.mi_empresa_id()
  ));

create policy cotizacion_detalles_insert on public.cotizacion_detalles
  for insert to authenticated
  with check (exists (
    select 1 from public.cotizaciones c
    where c.id = cotizacion_detalles.cotizacion_id
      and c.usuario_id = auth.uid()
      and c.estado = 'borrador'
      and public.has_permiso('cotizaciones', 'crear')
  ));

-- ---------------------------------------------------------------------------
-- compras / compra_detalles — SOLO LECTURA, vía fn_registrar_compra.
-- ---------------------------------------------------------------------------
alter table public.compras enable row level security;
alter table public.compra_detalles enable row level security;

create policy compras_select on public.compras
  for select to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and public.has_permiso('compras', 'ver')
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

create policy compra_detalles_select on public.compra_detalles
  for select to authenticated
  using (exists (
    select 1 from public.compras c
    where c.id = compra_detalles.compra_id and c.empresa_id = public.mi_empresa_id()
  ));

-- ---------------------------------------------------------------------------
-- cajas — configuración de registradoras por sede.
-- ---------------------------------------------------------------------------
alter table public.cajas enable row level security;

create policy cajas_select on public.cajas
  for select to authenticated
  using (
    public.has_permiso('caja', 'ver')
    and sede_id in (select id from public.sedes where empresa_id = public.mi_empresa_id())
  );

create policy cajas_insert on public.cajas
  for insert to authenticated
  with check (public.es_administrador());

-- ---------------------------------------------------------------------------
-- caja_sesiones / movimientos_caja — SOLO LECTURA, vía fn_abrir_caja /
-- fn_cerrar_caja / fn_registrar_venta.
-- ---------------------------------------------------------------------------
alter table public.caja_sesiones enable row level security;
alter table public.movimientos_caja enable row level security;

create policy caja_sesiones_select on public.caja_sesiones
  for select to authenticated
  using (
    public.has_permiso('caja', 'ver')
    and caja_id in (
      select c.id from public.cajas c join public.sedes s on s.id = c.sede_id
      where s.empresa_id = public.mi_empresa_id()
        and (public.puede_ver_todas_las_sedes() or s.id = public.mi_sede_id())
    )
  );

create policy movimientos_caja_select on public.movimientos_caja
  for select to authenticated
  using (
    public.has_permiso('caja', 'ver')
    and sede_id in (
      select id from public.sedes where empresa_id = public.mi_empresa_id()
    )
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

-- ---------------------------------------------------------------------------
-- trabajadores
-- ---------------------------------------------------------------------------
alter table public.trabajadores enable row level security;

create policy trabajadores_select on public.trabajadores
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('trabajadores', 'ver'));

create policy trabajadores_insert on public.trabajadores
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('trabajadores', 'crear'));

create policy trabajadores_update on public.trabajadores
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('trabajadores', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- notificaciones — cada usuario ve las suyas + las de alcance "sede" (usuario_id
-- null); marcar como leída se hace vía fn_marcar_notificacion_leida, no con
-- UPDATE directo.
-- ---------------------------------------------------------------------------
alter table public.notificaciones enable row level security;

create policy notificaciones_select on public.notificaciones
  for select to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and (usuario_id = auth.uid() or (usuario_id is null and (sede_id = public.mi_sede_id() or public.puede_ver_todas_las_sedes())))
  );

-- ---------------------------------------------------------------------------
-- audit_logs — SOLO LECTURA para quien tenga permiso de auditoría. Sin policies
-- de insert/update/delete: insert solo vía SECURITY DEFINER; update/delete ya
-- están revocados a nivel de permisos de Postgres y bloqueados por trigger.
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('auditoria', 'ver'));

-- >>>>>>>>>>>>>>>>>>>> 23_auditoria_generica.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 24_caja_manual.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 25_inventario_producto.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 26_vistas_seguras.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 26_vistas_seguras.sql                                     (C-01, A-08)
-- Las vistas se ejecutaban con los permisos de su dueño y se saltaban RLS.
-- Ahora usan security_invoker (respetan RLS del usuario que consulta; requiere
-- PostgreSQL 15+), se les quita el acceso a anon y los días se agrupan en hora
-- de Perú (America/Lima) en vez de UTC. Idempotente.
-- ============================================================================

create or replace view public.v_ventas_por_dia with (security_invoker = true) as
select
  v.sede_id,
  (v.fecha at time zone 'America/Lima')::date as dia,
  count(*) as cantidad_ventas,
  sum(v.total) as total_vendido,
  sum(v.costo_total) as costo_total,
  sum(v.ganancia_total) as ganancia_total
from public.ventas v
where v.estado = 'confirmada'
group by v.sede_id, (v.fecha at time zone 'America/Lima')::date;

create or replace view public.v_ventas_por_medio_pago with (security_invoker = true) as
select sede_id, medio_pago, (fecha at time zone 'America/Lima')::date as dia,
       count(*) as cantidad_ventas, sum(total) as total_vendido
from public.ventas
where estado = 'confirmada'
group by sede_id, medio_pago, (fecha at time zone 'America/Lima')::date;

create or replace view public.v_ventas_por_trabajador with (security_invoker = true) as
select
  v.usuario_id,
  pr.nombre as nombre_usuario,
  v.sede_id,
  (v.fecha at time zone 'America/Lima')::date as dia,
  count(*) as cantidad_ventas,
  sum(v.total) as total_vendido
from public.ventas v
join public.profiles pr on pr.id = v.usuario_id
where v.estado = 'confirmada'
group by v.usuario_id, pr.nombre, v.sede_id, (v.fecha at time zone 'America/Lima')::date;

alter view public.v_stock_critico          set (security_invoker = true);
alter view public.v_ganancia_por_producto  set (security_invoker = true);
alter view public.v_productos_mas_vendidos set (security_invoker = true);
alter view public.v_ventas_por_dia         set (security_invoker = true);
alter view public.v_ventas_por_medio_pago  set (security_invoker = true);
alter view public.v_ventas_por_trabajador  set (security_invoker = true);

revoke all on public.v_stock_critico, public.v_ventas_por_dia, public.v_ganancia_por_producto,
              public.v_ventas_por_medio_pago, public.v_ventas_por_trabajador,
              public.v_productos_mas_vendidos from anon, public;
grant select on public.v_stock_critico, public.v_ventas_por_dia, public.v_ganancia_por_producto,
                public.v_ventas_por_medio_pago, public.v_ventas_por_trabajador,
                public.v_productos_mas_vendidos to authenticated;

-- >>>>>>>>>>>>>>>>>>>> 27_revocar_ejecucion_publica.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 28_roles_dos.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 29_dashboard_resumen_seguro.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 29_dashboard_resumen_seguro.sql                             (A-03, A-08)
-- fn_dashboard_resumen ahora:
--  * exige sesión (auth.uid()) y permiso ventas.ver;
--  * solo responde para sedes de la empresa del usuario (y, si no es
--    administrador/supervisor, solo su propia sede); si no cumple, devuelve 0 filas;
--  * calcula "el día" en hora de Perú (America/Lima), no en UTC.
-- Misma firma (uuid, date) y mismas columnas de salida. Idempotente.
-- ============================================================================

create or replace function public.fn_dashboard_resumen(p_sede_id uuid, p_fecha date default null)
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
  with ctx as (
    select coalesce(p_fecha, (now() at time zone 'America/Lima')::date) as dia
    where auth.uid() is not null
      and public.has_permiso('ventas', 'ver')
      and exists (
        select 1 from public.sedes s
        where s.id = p_sede_id
          and s.empresa_id = public.mi_empresa_id()
          and (public.puede_ver_todas_las_sedes() or s.id = public.mi_sede_id())
      )
  ), v as (
    select vt.*
    from public.ventas vt, ctx
    where vt.sede_id = p_sede_id
      and vt.estado = 'confirmada'
      and (vt.fecha at time zone 'America/Lima')::date = ctx.dia
  )
  select
    coalesce((select sum(total) from v), 0),
    coalesce((select sum(costo_total) from v), 0),
    coalesce((select sum(ganancia_total) from v), 0),
    coalesce((select count(*) from v), 0),
    coalesce((select sum(vd.cantidad) from public.venta_detalles vd join v on v.id = vd.venta_id), 0),
    coalesce((select count(*) from public.inventario i
              where i.sede_id = p_sede_id and i.stock_actual > 0 and i.stock_actual <= i.stock_minimo), 0),
    coalesce((select count(*) from public.inventario i
              where i.sede_id = p_sede_id and i.stock_actual = 0), 0)
  from ctx;
$$;

revoke execute on function public.fn_dashboard_resumen(uuid, date) from public, anon;
grant execute on function public.fn_dashboard_resumen(uuid, date) to authenticated;

-- >>>>>>>>>>>>>>>>>>>> 30_proteger_permisos.sql >>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>> 31_funciones_integridad.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 31_funciones_integridad.sql        (A-01, A-02, A-06, M-06, M-12, M-14, B-10)
-- Reemplaza (create or replace, misma firma) las funciones transaccionales para:
--  * validar empresa y sede del objeto recibido (caja, sesión, venta, producto,
--    proveedor, cliente, cotización) — un usuario no puede operar sobre datos de
--    otra empresa ni de otra sede (salvo el administrador, dentro de su empresa);
--  * fn_convertir_cotizacion bloquea la fila (for update): un doble clic no crea
--    dos ventas; rechaza cotizaciones vencidas;
--  * fn_anular_venta revierte la caja (egreso en la caja abierta de la sede) y
--    exige motivo;
--  * fn_registrar_venta bloquea el inventario en orden de producto (sin
--    deadlocks), valida descuentos y no inserta movimiento de caja si total = 0;
--  * fn_registrar_auditoria solo admite módulos conocidos.
-- No cambia la regla de "caja abierta para vender" (decisión pendiente del dueño).
-- Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- fn_registrar_venta
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

-- ---------------------------------------------------------------------------
-- fn_registrar_compra
-- ---------------------------------------------------------------------------
create or replace function public.fn_registrar_compra(
  p_sede_id         uuid,
  p_proveedor_id    uuid,
  p_numero_documento text,
  p_lineas          jsonb,
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
  v_tasa_impuesto   numeric(5,4);
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
  if not exists (select 1 from public.sedes where id = p_sede_id and empresa_id = v_empresa_id) then
    raise exception 'La sede no existe.';
  end if;
  if not exists (
    select 1 from public.proveedores
    where id = p_proveedor_id and empresa_id = v_empresa_id and estado and deleted_at is null
  ) then
    raise exception 'El proveedor no existe o está inactivo.';
  end if;

  select impuesto into v_tasa_impuesto from public.empresas where id = v_empresa_id;

  insert into public.compras (empresa_id, sede_id, proveedor_id, usuario_id, numero_documento, subtotal, impuesto, total, observaciones)
  values (v_empresa_id, p_sede_id, p_proveedor_id, v_perfil.profile_id, p_numero_documento, 0, 0, 0, p_observaciones)
  returning * into v_compra;

  for v_linea in select e from jsonb_array_elements(p_lineas) as e order by e->>'producto_id'
  loop
    v_producto_id    := (v_linea->>'producto_id')::uuid;
    v_cantidad       := (v_linea->>'cantidad')::integer;
    v_costo_unitario := (v_linea->>'costo_unitario')::numeric;

    if not exists (select 1 from public.productos where id = v_producto_id and empresa_id = v_empresa_id) then
      raise exception 'El producto % no existe.', v_producto_id;
    end if;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida para el producto %.', v_producto_id;
    end if;
    if v_costo_unitario is null or v_costo_unitario < 0 then
      raise exception 'Costo unitario inválido para el producto %.', v_producto_id;
    end if;

    insert into public.compra_detalles (compra_id, producto_id, cantidad, costo_unitario)
    values (v_compra.id, v_producto_id, v_cantidad, v_costo_unitario);

    v_subtotal := v_subtotal + (v_costo_unitario * v_cantidad);

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

    update public.productos
      set costo_actual = v_nuevo_costo, updated_at = now()
      where id = v_producto_id and empresa_id = v_empresa_id;

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

-- ---------------------------------------------------------------------------
-- fn_convertir_cotizacion
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
    v_cot.sede_id, v_cot.cliente_id, p_medio_pago, v_lineas, null
  );

  update public.cotizaciones set estado = 'convertida', venta_id = v_venta.id, updated_at = now()
    where id = p_cotizacion_id;

  return v_venta;
end;
$$;

-- ---------------------------------------------------------------------------
-- fn_ajustar_stock
-- ---------------------------------------------------------------------------
create or replace function public.fn_ajustar_stock(
  p_producto_id       uuid,
  p_sede_id           uuid,
  p_tipo              text,
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
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Indique el motivo del ajuste.';
  end if;
  if not public.es_administrador() and v_perfil.sede_id is distinct from p_sede_id then
    raise exception 'No puede ajustar el inventario de otra sede.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sedes where id = p_sede_id and empresa_id = v_perfil.empresa_id)
     or not exists (select 1 from public.productos where id = p_producto_id and empresa_id = v_perfil.empresa_id) then
    raise exception 'Producto o sede inválidos.';
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
  if p_monto_apertura is null or p_monto_apertura < 0 then
    raise exception 'El monto de apertura no puede ser negativo.';
  end if;
  if not exists (
    select 1 from public.cajas c join public.sedes s on s.id = c.sede_id
    where c.id = p_caja_id and c.estado and s.empresa_id = v_perfil.empresa_id
      and (public.es_administrador() or c.sede_id = v_perfil.sede_id)
  ) then
    raise exception 'La caja no existe o no pertenece a tu sede.' using errcode = '42501';
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
  if not exists (
    select 1 from public.cajas c join public.sedes s on s.id = c.sede_id
    where c.id = v_sesion.caja_id and s.empresa_id = v_perfil.empresa_id
      and (public.es_administrador() or c.sede_id = v_perfil.sede_id)
  ) then
    raise exception 'La sesión de caja no pertenece a tu sede.' using errcode = '42501';
  end if;
  if p_monto_cierre_real is null or p_monto_cierre_real < 0 then
    raise exception 'El monto real de cierre no es válido.';
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

-- ---------------------------------------------------------------------------
-- fn_anular_venta: valida empresa/sede, exige motivo, devuelve stock y revierte caja.
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

  -- Caja: el dinero de la venta sale de la caja abierta de la sede (si la hay).
  insert into public.movimientos_caja (
    caja_sesion_id, sede_id, tipo, medio_pago, monto, concepto, referencia_tipo, referencia_id, usuario_id
  )
  select cs.id, v_venta.sede_id, 'egreso', v_venta.medio_pago, v_venta.total,
         'Anulación de venta ' || v_venta.numero, 'venta', v_venta.id, v_perfil.profile_id
  from public.caja_sesiones cs
  join public.cajas c on c.id = cs.caja_id
  where c.sede_id = v_venta.sede_id and cs.estado = 'abierta' and v_venta.total > 0
  limit 1;

  insert into public.audit_logs (usuario_id, empresa_id, sede_id, accion, modulo, tabla_afectada, registro_id, datos_anteriores, datos_nuevos)
  values (v_perfil.profile_id, v_venta.empresa_id, v_venta.sede_id, 'Venta anulada: ' || p_motivo, 'ventas',
          'ventas', v_venta.id, jsonb_build_object('estado', 'confirmada'), jsonb_build_object('estado', 'anulada'));

  return v_venta;
end;
$$;

-- ---------------------------------------------------------------------------
-- fn_registrar_auditoria: solo módulos conocidos y textos acotados.
-- ---------------------------------------------------------------------------
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
  if p_modulo is null
     or p_modulo not in ('sesion','ventas','productos','inventario','compras','precios','permisos',
                         'configuracion','caja','clientes','proveedores','trabajadores',
                         'cotizaciones','movimientos','auditoria','usuarios')
     or length(coalesce(p_accion, '')) not between 1 and 300 then
    raise exception 'Registro de auditoría inválido.';
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

-- ---------------------------------------------------------------------------
-- Permisos de ejecución: solo usuarios autenticados.
-- ---------------------------------------------------------------------------
revoke execute on function public.fn_registrar_venta(uuid, uuid, text, jsonb, text) from public, anon;
revoke execute on function public.fn_registrar_compra(uuid, uuid, text, jsonb, text) from public, anon;
revoke execute on function public.fn_convertir_cotizacion(uuid, text) from public, anon;
revoke execute on function public.fn_ajustar_stock(uuid, uuid, text, integer, text, text, text) from public, anon;
revoke execute on function public.fn_abrir_caja(uuid, numeric) from public, anon;
revoke execute on function public.fn_cerrar_caja(uuid, numeric) from public, anon;
revoke execute on function public.fn_anular_venta(uuid, text) from public, anon;
revoke execute on function public.fn_registrar_auditoria(text, text, text, uuid, jsonb, jsonb) from public, anon;

grant execute on function public.fn_registrar_venta(uuid, uuid, text, jsonb, text) to authenticated;
grant execute on function public.fn_registrar_compra(uuid, uuid, text, jsonb, text) to authenticated;
grant execute on function public.fn_convertir_cotizacion(uuid, text) to authenticated;
grant execute on function public.fn_ajustar_stock(uuid, uuid, text, integer, text, text, text) to authenticated;
grant execute on function public.fn_abrir_caja(uuid, numeric) to authenticated;
grant execute on function public.fn_cerrar_caja(uuid, numeric) to authenticated;
grant execute on function public.fn_anular_venta(uuid, text) to authenticated;
grant execute on function public.fn_registrar_auditoria(text, text, text, uuid, jsonb, jsonb) to authenticated;

-- >>>>>>>>>>>>>>>>>>>> 32_rls_cotizaciones.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 32_rls_cotizaciones.sql                                        (M-13)
-- Las políticas de cotizaciones no validaban la sede ni el cliente:
--  * insert: la sede debe ser la del usuario (o cualquiera de su empresa si es
--    administrador) y el cliente debe ser de su empresa;
--  * update: solo cotizaciones de su sede (administrador/supervisor: toda la
--    empresa) y no se puede cambiar a otra empresa/sede ni a 'convertida' a mano.
-- Idempotente (drop policy if exists + create policy).
-- ============================================================================

drop policy if exists cotizaciones_insert on public.cotizaciones;
create policy cotizaciones_insert on public.cotizaciones
  for insert to authenticated
  with check (
    empresa_id = public.mi_empresa_id()
    and usuario_id = auth.uid()
    and public.has_permiso('cotizaciones', 'crear')
    and estado = 'borrador'
    and (public.es_administrador() or sede_id = public.mi_sede_id())
    and exists (select 1 from public.sedes s where s.id = sede_id and s.empresa_id = public.mi_empresa_id())
    and exists (select 1 from public.clientes c where c.id = cliente_id and c.empresa_id = public.mi_empresa_id())
  );

drop policy if exists cotizaciones_update on public.cotizaciones;
create policy cotizaciones_update on public.cotizaciones
  for update to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and estado <> 'convertida'
    and public.has_permiso('cotizaciones', 'editar')
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  )
  with check (
    empresa_id = public.mi_empresa_id()
    and estado <> 'convertida'
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
    and exists (select 1 from public.clientes c where c.id = cliente_id and c.empresa_id = public.mi_empresa_id())
  );

-- >>>>>>>>>>>>>>>>>>>> 33_exigir_caja_abierta.sql >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>> 34_pago_mixto.sql >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>> 36_backups.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 36_backups.sql
-- Configuración > Backups: historial de respaldos (productos, ventas y ganancias) y
-- bucket PRIVADO de Storage donde se guardan los archivos (.xlsx / .zip de CSV).
--  * Solo el administrador (es_administrador(), igual que la página Configuración) puede
--    ver el historial, crear respaldos y descargarlos. Nadie puede editar ni borrar archivos
--    desde el cliente: no hay política de UPDATE/DELETE sobre storage.objects ni sobre backups
--    (el historial es permanente).
--  * Las descargas usan URLs firmadas de corta duración, nunca un bucket público.
-- Idempotente: se puede ejecutar dos veces.
-- ============================================================================

create table if not exists public.backups (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id),
  tipo           text not null default 'manual' check (tipo in ('manual', 'automatico')),
  formatos       text[] not null check (formatos <@ array['xlsx', 'csv']::text[] and cardinality(formatos) > 0),
  estado         text not null default 'procesando' check (estado in ('procesando', 'completado', 'error')),
  archivos       jsonb not null default '[]'::jsonb,   -- [{nombre, ruta, formato, tamano}]
  tamano_bytes   bigint not null default 0,
  resumen        jsonb,                                -- totales del respaldo (productos, ventas, ganancia…)
  error_mensaje  text,
  creado_por     uuid references public.profiles(id),  -- null = ejecutado por el sistema (automático)
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists backups_empresa_created_idx on public.backups (empresa_id, created_at desc);

alter table public.backups enable row level security;
revoke delete on public.backups from authenticated, anon;

drop policy if exists backups_select on public.backups;
create policy backups_select on public.backups
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_administrador());

drop policy if exists backups_insert on public.backups;
create policy backups_insert on public.backups
  for insert to authenticated
  with check (
    empresa_id = public.mi_empresa_id()
    and public.es_administrador()
    and tipo = 'manual'
    and creado_por = auth.uid()
  );

drop policy if exists backups_update on public.backups;
create policy backups_update on public.backups
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_administrador() and estado = 'procesando')
  with check (empresa_id = public.mi_empresa_id());

-- Bucket privado ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do update set public = false;

-- Los archivos viven en <empresa_id>/<backup_id>/<archivo>. Solo se puede subir y leer
-- (para firmar la descarga) dentro de la carpeta de la propia empresa y siendo administrador.
drop policy if exists backups_storage_select on storage.objects;
create policy backups_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'backups'
    and public.es_administrador()
    and (storage.foldername(name))[1] = public.mi_empresa_id()::text
  );

drop policy if exists backups_storage_insert on storage.objects;
create policy backups_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'backups'
    and public.es_administrador()
    and (storage.foldername(name))[1] = public.mi_empresa_id()::text
  );


-- >>>>>>>>>>>>>>>>>>>> 37_metas_ventas.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- 37_metas_ventas.sql
-- Metas mensuales de ventas: una meta por empresa, año y mes.
--  * Lectura: cualquier usuario autenticado de la empresa (el Dashboard muestra el progreso).
--  * Crear y editar: solo el administrador. No hay borrado desde el cliente.
--  * Las ventas reales NO se guardan aquí: se calculan al consultar desde las ventas
--    confirmadas (vista v_ventas_por_dia, día en hora de Perú).
-- Idempotente: se puede ejecutar dos veces. Ejecutar DESPUÉS de 36.
-- ============================================================================

create table if not exists public.metas_ventas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id),
  anio        integer not null check (anio between 2000 and 2100),
  mes         integer not null check (mes between 1 and 12),
  meta        numeric(12,2) not null check (meta > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint metas_ventas_empresa_anio_mes_key unique (empresa_id, anio, mes)
);

drop trigger if exists trg_metas_ventas_updated_at on public.metas_ventas;
create trigger trg_metas_ventas_updated_at before update on public.metas_ventas
  for each row execute function public.set_updated_at();

alter table public.metas_ventas enable row level security;
revoke all on public.metas_ventas from anon, public;
revoke delete, truncate on public.metas_ventas from authenticated;
grant select, insert, update on public.metas_ventas to authenticated;

drop policy if exists metas_ventas_select on public.metas_ventas;
create policy metas_ventas_select on public.metas_ventas
  for select to authenticated
  using (empresa_id = public.mi_empresa_id());

drop policy if exists metas_ventas_insert on public.metas_ventas;
create policy metas_ventas_insert on public.metas_ventas
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.es_administrador());

drop policy if exists metas_ventas_update on public.metas_ventas;
create policy metas_ventas_update on public.metas_ventas
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_administrador())
  with check (empresa_id = public.mi_empresa_id());
