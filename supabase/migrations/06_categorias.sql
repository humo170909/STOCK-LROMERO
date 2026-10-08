-- ============================================================================
-- 06_categorias.sql
-- ============================================================================

create table public.categorias (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  estado      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categorias_empresa_nombre_key unique (empresa_id, nombre)
);

create index categorias_empresa_id_idx on public.categorias (empresa_id);
