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
