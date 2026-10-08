-- ============================================================================
-- 36_backups.sql
-- Configuración > Backups: historial de respaldos (productos, ventas y ganancias) y
-- bucket PRIVADO de Storage donde se guardan los archivos (.xlsx / .zip de CSV).
--  * Solo el administrador (es_administrador(), igual que la página Configuración) puede
--    ver el historial, crear respaldos y descargarlos. Nadie puede editar ni borrar archivos
--    desde el cliente: no hay política de UPDATE/DELETE sobre storage.objects ni sobre backups
--    (el historial es permanente).
--  * Las descargas usan URLs firmadas de corta duración, nunca un bucket público.
-- Idempotente: se puede ejecutar dos veces.
-- ============================================================================

create table if not exists public.backups (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id),
  tipo           text not null default 'manual' check (tipo in ('manual', 'automatico')),
  formatos       text[] not null check (formatos <@ array['xlsx', 'csv']::text[] and cardinality(formatos) > 0),
  estado         text not null default 'procesando' check (estado in ('procesando', 'completado', 'error')),
  archivos       jsonb not null default '[]'::jsonb,   -- [{nombre, ruta, formato, tamano}]
  tamano_bytes   bigint not null default 0,
  resumen        jsonb,                                -- totales del respaldo (productos, ventas, ganancia…)
  error_mensaje  text,
  creado_por     uuid references public.profiles(id),  -- null = ejecutado por el sistema (automático)
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists backups_empresa_created_idx on public.backups (empresa_id, created_at desc);

alter table public.backups enable row level security;
revoke delete on public.backups from authenticated, anon;

drop policy if exists backups_select on public.backups;
create policy backups_select on public.backups
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_administrador());

drop policy if exists backups_insert on public.backups;
create policy backups_insert on public.backups
  for insert to authenticated
  with check (
    empresa_id = public.mi_empresa_id()
    and public.es_administrador()
    and tipo = 'manual'
    and creado_por = auth.uid()
  );

drop policy if exists backups_update on public.backups;
create policy backups_update on public.backups
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_administrador() and estado = 'procesando')
  with check (empresa_id = public.mi_empresa_id());

-- Bucket privado ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do update set public = false;

-- Los archivos viven en <empresa_id>/<backup_id>/<archivo>. Solo se puede subir y leer
-- (para firmar la descarga) dentro de la carpeta de la propia empresa y siendo administrador.
drop policy if exists backups_storage_select on storage.objects;
create policy backups_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'backups'
    and public.es_administrador()
    and (storage.foldername(name))[1] = public.mi_empresa_id()::text
  );

drop policy if exists backups_storage_insert on storage.objects;
create policy backups_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'backups'
    and public.es_administrador()
    and (storage.foldername(name))[1] = public.mi_empresa_id()::text
  );
