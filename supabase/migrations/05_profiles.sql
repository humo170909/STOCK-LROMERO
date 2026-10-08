-- ============================================================================
-- 05_profiles.sql
-- Perfil de aplicación 1:1 con auth.users. Nunca se guarda contraseña aquí —
-- Supabase Auth la gestiona por completo en auth.users (tabla gestionada por
-- Supabase, fuera de nuestro esquema).
-- ============================================================================

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id),
  sede_id     uuid references public.sedes(id),       -- sede principal; null = multi-sede (solo administrador/supervisor)
  rol_id      uuid not null references public.roles(id),
  nombre      text not null,
  documento   text,
  telefono    text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_empresa_id_idx on public.profiles (empresa_id);
create index profiles_sede_id_idx on public.profiles (sede_id);
create index profiles_rol_id_idx on public.profiles (rol_id);

comment on table public.profiles is
  'Datos de aplicación del usuario. id = auth.users.id. Password/MFA/tokens viven '
  'exclusivamente en auth.users, gestionados por Supabase Auth.';
