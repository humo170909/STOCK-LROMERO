-- ============================================================================
-- 16_trabajadores.sql
-- profile_id es opcional: un trabajador puede existir sin tener cuenta de acceso.
-- ============================================================================

create table public.trabajadores (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  sede_id       uuid not null references public.sedes(id),
  profile_id    uuid references public.profiles(id),
  nombre        text not null,
  documento     text not null check (char_length(documento) = 8),
  telefono      text,
  cargo         text not null,
  ingresado_en  date not null default current_date,
  estado        boolean not null default true,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint trabajadores_empresa_documento_key unique (empresa_id, documento)
);

create index trabajadores_empresa_id_idx on public.trabajadores (empresa_id) where deleted_at is null;
create index trabajadores_sede_id_idx on public.trabajadores (sede_id);
create index trabajadores_profile_id_idx on public.trabajadores (profile_id);
