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
