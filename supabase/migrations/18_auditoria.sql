-- ============================================================================
-- 18_auditoria.sql
-- Tabla de solo-inserción. Ningún rol de aplicación puede UPDATE/DELETE aquí —
-- ni siquiera si una policy de RLS se configurara mal más adelante, porque el
-- REVOKE de abajo actúa a nivel de permisos de Postgres, antes de que RLS entre
-- a evaluarse.
-- ============================================================================

create table public.audit_logs (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid references public.profiles(id),
  empresa_id        uuid references public.empresas(id),
  sede_id           uuid references public.sedes(id),
  accion            text not null,
  modulo            text not null,
  tabla_afectada    text,
  registro_id       uuid,
  datos_anteriores  jsonb,
  datos_nuevos      jsonb,
  ip                inet,
  user_agent        text,
  created_at        timestamptz not null default now()
);

create index audit_logs_usuario_id_idx on public.audit_logs (usuario_id);
create index audit_logs_empresa_id_idx on public.audit_logs (empresa_id);
create index audit_logs_modulo_idx on public.audit_logs (modulo);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_registro_idx on public.audit_logs (tabla_afectada, registro_id);

-- Defensa en profundidad: aunque algún día una policy de RLS quedara mal escrita,
-- estos roles ya no tienen el permiso de Postgres para mutar la tabla.
revoke update, delete on public.audit_logs from authenticated, anon;
