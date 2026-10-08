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
