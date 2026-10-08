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
