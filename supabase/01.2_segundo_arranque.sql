do $$
declare
  -- ---------------------------- CONFIGURA AQUÍ ---------------------------------
  v_correo   text := 'usuario1@almacen.com';
  v_nombre   text := 'Usuario 1';          -- cambia por el nombre real
  -- -----------------------------------------------------------------------------
  v_user    uuid;
  v_admin   record;
  v_rol     uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_correo);
  if v_user is null then
    raise exception 'No existe un usuario con el correo "%" en Authentication → Users. Créalo primero.', v_correo;
  end if;
  if exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Ese usuario ya tiene perfil.';
  end if;

  select id into v_rol from public.roles where codigo = 'supervisor';
  if v_rol is null then
    raise exception 'No existe el rol supervisor: ¿se ejecutó 00_instalacion_completa.sql completo?';
  end if;

  -- Toma la empresa y la sede de tu administrador
  select p.empresa_id, p.sede_id into v_admin
  from public.profiles p
  join public.roles r on r.id = p.rol_id
  where r.codigo = 'administrador'
  order by p.created_at
  limit 1;
  if v_admin.empresa_id is null then
    raise exception 'No se encontró el administrador. ¿Ejecutaste 01_primer_arranque.sql?';
  end if;

  insert into public.profiles (id, empresa_id, sede_id, rol_id, nombre)
  values (v_user, v_admin.empresa_id, v_admin.sede_id, v_rol, v_nombre);

  raise notice 'Listo. Supervisor % creado.', v_correo;
end;
$$;