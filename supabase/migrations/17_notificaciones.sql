-- ============================================================================
-- 17_notificaciones.sql
-- usuario_id null = notificación de alcance "toda la sede/empresa" (p. ej. stock
-- crítico), no de una persona específica.
-- ============================================================================

create table public.notificaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id),
  sede_id         uuid references public.sedes(id),
  usuario_id      uuid references public.profiles(id),
  tipo            text not null check (tipo in (
                    'stock_critico','producto_agotado','operacion_pendiente',
                    'caja_pendiente','cotizacion_por_vencer','alerta_administrativa'
                  )),
  titulo          text not null,
  mensaje         text not null,
  leida           boolean not null default false,
  referencia_tipo text,
  referencia_id   uuid,
  created_at      timestamptz not null default now()
);

create index notificaciones_usuario_id_idx on public.notificaciones (usuario_id, leida);
create index notificaciones_sede_id_idx on public.notificaciones (sede_id);
create index notificaciones_created_at_idx on public.notificaciones (created_at desc);
