-- ============================================================================
-- 01_primer_arranque.sql
-- Crea tu empresa, tu primera sede, la caja y el perfil de administrador.
-- EJECUTAR UNA SOLA VEZ, DESPUÉS de:
--   (1) correr 00_instalacion_completa.sql, y
--   (2) crear tu usuario en Supabase → Authentication → Users → Add user
--       (marca "Auto Confirm User").
--
-- Edita SOLO los valores del bloque "CONFIGURA AQUÍ". El resto no se toca.
-- ============================================================================
do $$
declare
  -- ---------------------------- CONFIGURA AQUÍ ---------------------------------
  v_correo_admin   text := 'admin@tuempresa.com';            -- el mismo correo que usaste en Authentication
  v_nombre_admin   text := 'LROMERO';
  v_empresa_nombre text := 'GRUPO LROMERO IMPORTACIONES';        -- nombre comercial
  v_razon_social   text := 'GRUPO LROMERO IMPORTACIONES S.A.C.';
  v_sede_nombre    text := 'SEDE CENTRAL';
  v_sede_direccion text := 'xxxxxxxxx';
  v_sede_telefono  text := 'xxxxxxxxx';
  -- -----------------------------------------------------------------------------
  v_user    uuid;
  v_empresa uuid;
  v_sede    uuid;
  v_rol     uuid;
begin
  if exists (select 1 from public.empresas) then
    raise exception 'Ya existe una empresa: este script solo se ejecuta una vez. Para agregar usuarios use 01.2_segundo_arranque.sql.';
  end if;

  select id into v_user from auth.users where lower(email) = lower(v_correo_admin);
  if v_user is null then
    raise exception 'No existe un usuario con el correo "%" en Authentication → Users. Créalo primero.', v_correo_admin;
  end if;
  if exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Ese usuario ya tiene perfil. Este script solo se ejecuta una vez.';
  end if;

  select id into v_rol from public.roles where codigo = 'administrador';
  if v_rol is null then
    raise exception 'No existe el rol administrador: ¿se ejecutó 00_instalacion_completa.sql completo?';
  end if;

  insert into public.empresas (nombre, razon_social)
  values (v_empresa_nombre, v_razon_social)
  returning id into v_empresa;

  insert into public.sedes (empresa_id, nombre, codigo, direccion, telefono)
  values (v_empresa, v_sede_nombre, 'PRINCIPAL', nullif(v_sede_direccion, ''), nullif(v_sede_telefono, ''))
  returning id into v_sede;

  insert into public.cajas (sede_id) values (v_sede);

  insert into public.profiles (id, empresa_id, sede_id, rol_id, nombre)
  values (v_user, v_empresa, v_sede, v_rol, v_nombre_admin);

  raise notice 'Listo. Empresa %, sede % y administrador % creados.', v_empresa, v_sede, v_correo_admin;
end;
$$;
