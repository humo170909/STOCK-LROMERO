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
