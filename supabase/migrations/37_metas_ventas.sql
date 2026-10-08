-- ============================================================================
-- 37_metas_ventas.sql
-- Metas mensuales de ventas: una meta por empresa, año y mes.
--  * Lectura: cualquier usuario autenticado de la empresa (el Dashboard muestra el progreso).
--  * Crear y editar: solo el administrador. No hay borrado desde el cliente.
--  * Las ventas reales NO se guardan aquí: se calculan al consultar desde las ventas
--    confirmadas (vista v_ventas_por_dia, día en hora de Perú).
-- Idempotente: se puede ejecutar dos veces. Ejecutar DESPUÉS de 36.
-- ============================================================================

create table if not exists public.metas_ventas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id),
  anio        integer not null check (anio between 2000 and 2100),
  mes         integer not null check (mes between 1 and 12),
  meta        numeric(12,2) not null check (meta > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint metas_ventas_empresa_anio_mes_key unique (empresa_id, anio, mes)
);

drop trigger if exists trg_metas_ventas_updated_at on public.metas_ventas;
create trigger trg_metas_ventas_updated_at before update on public.metas_ventas
  for each row execute function public.set_updated_at();

alter table public.metas_ventas enable row level security;
revoke all on public.metas_ventas from anon, public;
revoke delete, truncate on public.metas_ventas from authenticated;
grant select, insert, update on public.metas_ventas to authenticated;

drop policy if exists metas_ventas_select on public.metas_ventas;
create policy metas_ventas_select on public.metas_ventas
  for select to authenticated
  using (empresa_id = public.mi_empresa_id());

drop policy if exists metas_ventas_insert on public.metas_ventas;
create policy metas_ventas_insert on public.metas_ventas
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.es_administrador());

drop policy if exists metas_ventas_update on public.metas_ventas;
create policy metas_ventas_update on public.metas_ventas
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_administrador())
  with check (empresa_id = public.mi_empresa_id());
