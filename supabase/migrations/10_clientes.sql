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
