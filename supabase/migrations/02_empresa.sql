-- ============================================================================
-- 02_empresa.sql
-- Tabla raíz. Todo lo demás cuelga de empresa_id, incluso si hoy solo existe una fila.
-- ============================================================================

create table public.empresas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  razon_social    text not null,
  documento       text,                          -- documento de la empresa: opcional y libre, sin validación tributaria
  direccion       text,
  telefono        text,
  correo          text,
  logo_url        text,
  moneda          text not null default 'PEN',
  impuesto        numeric(5,4) not null default 0 check (impuesto >= 0 and impuesto <= 1),  -- cargo opcional (0.05 = 5 %); 0 = sin impuesto
  configuracion   jsonb not null default '{}'::jsonb,  -- flags/formatos no estructurales (medios de pago activos, etc.)
  estado          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.empresas is 'Raíz del tenant. No almacena secretos ni claves.';
