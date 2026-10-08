-- ============================================================================
-- 01_extensions.sql
-- Extensiones necesarias. Ejecutar primero.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- búsqueda por similitud (nombre, documento)
