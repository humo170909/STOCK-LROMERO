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
