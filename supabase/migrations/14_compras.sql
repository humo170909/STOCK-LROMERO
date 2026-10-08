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
