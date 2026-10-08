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
