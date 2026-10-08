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
