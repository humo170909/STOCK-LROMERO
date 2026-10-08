-- ============================================================================
-- 99_reset_total.sql   ⚠ PELIGRO ⚠
-- BORRA TODAS LAS TABLAS, FUNCIONES Y DATOS DEL ESQUEMA "public". No toca los usuarios
-- de Authentication. Úsalo solo si instalaste a medias o quieres empezar de cero y NO
-- tienes datos que conservar. Después vuelve a correr 00_instalacion_completa.sql.
-- ============================================================================
drop schema public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
