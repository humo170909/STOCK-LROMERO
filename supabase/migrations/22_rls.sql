-- ============================================================================
-- 22_rls.sql
--
-- Principio: cada tabla parte DENEGADA por defecto (RLS activado, cero policies)
-- y se abre exactamente lo necesario. Las tablas transaccionales (ventas,
-- compras, inventario, movimientos, caja) NO tienen policies de escritura en
-- absoluto para `authenticated` — solo se escriben a través de las funciones
-- SECURITY DEFINER de 19_functions.sql, que ya validan permiso/sede por dentro.
-- Esto es intencional: ninguna policy de UPDATE/INSERT habría sido suficiente
-- para expresar "stock no puede quedar negativo bajo concurrencia", así que esa
-- lógica vive en las funciones, no en RLS.
-- ============================================================================

-- Helper local: administrador y supervisor ven todas las sedes de su empresa.
create or replace function public.puede_ver_todas_las_sedes()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p join public.roles r on r.id = p.rol_id
    where p.id = auth.uid() and r.codigo in ('administrador', 'supervisor') and p.activo
  );
$$;

grant execute on function public.puede_ver_todas_las_sedes() to authenticated;

-- ---------------------------------------------------------------------------
-- empresas
-- ---------------------------------------------------------------------------
alter table public.empresas enable row level security;

create policy empresas_select on public.empresas
  for select to authenticated
  using (id = public.mi_empresa_id());

create policy empresas_update on public.empresas
  for update to authenticated
  using (id = public.mi_empresa_id() and public.es_administrador())
  with check (id = public.mi_empresa_id() and public.es_administrador());

-- ---------------------------------------------------------------------------
-- sedes
-- ---------------------------------------------------------------------------
alter table public.sedes enable row level security;

create policy sedes_select on public.sedes
  for select to authenticated
  using (empresa_id = public.mi_empresa_id());

create policy sedes_insert on public.sedes
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('configuracion', 'crear'));

create policy sedes_update on public.sedes
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('configuracion', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- roles / permisos / rol_permisos — catálogo de referencia: todos leen, solo
-- administrador con permiso sobre 'usuarios' edita la matriz.
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permisos enable row level security;
alter table public.rol_permisos enable row level security;

create policy roles_select on public.roles for select to authenticated using (true);
create policy permisos_select on public.permisos for select to authenticated using (true);
create policy rol_permisos_select on public.rol_permisos for select to authenticated using (true);

create policy rol_permisos_update on public.rol_permisos
  for all to authenticated
  using (public.es_administrador())
  with check (public.es_administrador());

-- ---------------------------------------------------------------------------
-- profiles
-- SELECT: cualquiera de tu empresa (para listas de "vendedor", asignación, etc.).
-- UPDATE directa: SOLO administrador (rol_id/activo/sede_id son datos de control
-- de acceso — cambiarlos es, en los hechos, otorgar o quitar privilegios). El
-- propio usuario actualiza nombre/teléfono vía fn_actualizar_mi_perfil(), nunca
-- con un UPDATE directo a la tabla.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (empresa_id = public.mi_empresa_id());

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('usuarios', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- categorias
-- ---------------------------------------------------------------------------
alter table public.categorias enable row level security;

create policy categorias_select on public.categorias
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'ver'));

create policy categorias_insert on public.categorias
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'crear'));

create policy categorias_update on public.categorias
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- productos (sin DELETE: usar estado=false o deleted_at, nunca borrado físico)
-- ---------------------------------------------------------------------------
alter table public.productos enable row level security;

create policy productos_select on public.productos
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'ver'));

create policy productos_insert on public.productos
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'crear'));

create policy productos_update on public.productos
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('productos', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- inventario — solo lectura desde el cliente; se escribe vía RPC.
-- ---------------------------------------------------------------------------
alter table public.inventario enable row level security;

create policy inventario_select on public.inventario
  for select to authenticated
  using (
    public.has_permiso('inventario', 'ver')
    and sede_id in (select id from public.sedes where empresa_id = public.mi_empresa_id())
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

-- ---------------------------------------------------------------------------
-- movimientos_inventario — solo lectura; se escribe vía RPC.
-- ---------------------------------------------------------------------------
alter table public.movimientos_inventario enable row level security;

create policy movimientos_inventario_select on public.movimientos_inventario
  for select to authenticated
  using (
    public.has_permiso('movimientos', 'ver')
    and empresa_id = public.mi_empresa_id()
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

-- ---------------------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------------------
alter table public.clientes enable row level security;

create policy clientes_select on public.clientes
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('clientes', 'ver'));

create policy clientes_insert on public.clientes
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('clientes', 'crear'));

create policy clientes_update on public.clientes
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('clientes', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- proveedores
-- ---------------------------------------------------------------------------
alter table public.proveedores enable row level security;

create policy proveedores_select on public.proveedores
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('proveedores', 'ver'));

create policy proveedores_insert on public.proveedores
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('proveedores', 'crear'));

create policy proveedores_update on public.proveedores
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('proveedores', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- ventas / venta_detalles — SOLO LECTURA. Escritura únicamente vía
-- fn_registrar_venta / fn_anular_venta (SECURITY DEFINER).
-- ---------------------------------------------------------------------------
alter table public.ventas enable row level security;
alter table public.venta_detalles enable row level security;

create policy ventas_select on public.ventas
  for select to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and public.has_permiso('ventas', 'ver')
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

create policy venta_detalles_select on public.venta_detalles
  for select to authenticated
  using (exists (
    select 1 from public.ventas v
    where v.id = venta_detalles.venta_id
      and v.empresa_id = public.mi_empresa_id()
      and public.has_permiso('ventas', 'ver')
      and (public.puede_ver_todas_las_sedes() or v.sede_id = public.mi_sede_id())
  ));

-- ---------------------------------------------------------------------------
-- cotizaciones / cotizacion_detalles — la cabecera+detalle SÍ se pueden crear
-- directo desde el cliente (no mueven stock ni caja); la CONVERSIÓN a venta
-- exige la RPC. El WITH CHECK bloquea poner estado='convertida' a mano.
-- ---------------------------------------------------------------------------
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_detalles enable row level security;

create policy cotizaciones_select on public.cotizaciones
  for select to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and public.has_permiso('cotizaciones', 'ver')
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

create policy cotizaciones_insert on public.cotizaciones
  for insert to authenticated
  with check (
    empresa_id = public.mi_empresa_id()
    and usuario_id = auth.uid()
    and public.has_permiso('cotizaciones', 'crear')
    and estado = 'borrador'
  );

create policy cotizaciones_update on public.cotizaciones
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('cotizaciones', 'editar'))
  with check (empresa_id = public.mi_empresa_id() and estado <> 'convertida');

create policy cotizacion_detalles_select on public.cotizacion_detalles
  for select to authenticated
  using (exists (
    select 1 from public.cotizaciones c
    where c.id = cotizacion_detalles.cotizacion_id and c.empresa_id = public.mi_empresa_id()
  ));

create policy cotizacion_detalles_insert on public.cotizacion_detalles
  for insert to authenticated
  with check (exists (
    select 1 from public.cotizaciones c
    where c.id = cotizacion_detalles.cotizacion_id
      and c.usuario_id = auth.uid()
      and c.estado = 'borrador'
      and public.has_permiso('cotizaciones', 'crear')
  ));

-- ---------------------------------------------------------------------------
-- compras / compra_detalles — SOLO LECTURA, vía fn_registrar_compra.
-- ---------------------------------------------------------------------------
alter table public.compras enable row level security;
alter table public.compra_detalles enable row level security;

create policy compras_select on public.compras
  for select to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and public.has_permiso('compras', 'ver')
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

create policy compra_detalles_select on public.compra_detalles
  for select to authenticated
  using (exists (
    select 1 from public.compras c
    where c.id = compra_detalles.compra_id and c.empresa_id = public.mi_empresa_id()
  ));

-- ---------------------------------------------------------------------------
-- cajas — configuración de registradoras por sede.
-- ---------------------------------------------------------------------------
alter table public.cajas enable row level security;

create policy cajas_select on public.cajas
  for select to authenticated
  using (
    public.has_permiso('caja', 'ver')
    and sede_id in (select id from public.sedes where empresa_id = public.mi_empresa_id())
  );

create policy cajas_insert on public.cajas
  for insert to authenticated
  with check (public.es_administrador());

-- ---------------------------------------------------------------------------
-- caja_sesiones / movimientos_caja — SOLO LECTURA, vía fn_abrir_caja /
-- fn_cerrar_caja / fn_registrar_venta.
-- ---------------------------------------------------------------------------
alter table public.caja_sesiones enable row level security;
alter table public.movimientos_caja enable row level security;

create policy caja_sesiones_select on public.caja_sesiones
  for select to authenticated
  using (
    public.has_permiso('caja', 'ver')
    and caja_id in (
      select c.id from public.cajas c join public.sedes s on s.id = c.sede_id
      where s.empresa_id = public.mi_empresa_id()
        and (public.puede_ver_todas_las_sedes() or s.id = public.mi_sede_id())
    )
  );

create policy movimientos_caja_select on public.movimientos_caja
  for select to authenticated
  using (
    public.has_permiso('caja', 'ver')
    and sede_id in (
      select id from public.sedes where empresa_id = public.mi_empresa_id()
    )
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  );

-- ---------------------------------------------------------------------------
-- trabajadores
-- ---------------------------------------------------------------------------
alter table public.trabajadores enable row level security;

create policy trabajadores_select on public.trabajadores
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('trabajadores', 'ver'));

create policy trabajadores_insert on public.trabajadores
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.has_permiso('trabajadores', 'crear'));

create policy trabajadores_update on public.trabajadores
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('trabajadores', 'editar'))
  with check (empresa_id = public.mi_empresa_id());

-- ---------------------------------------------------------------------------
-- notificaciones — cada usuario ve las suyas + las de alcance "sede" (usuario_id
-- null); marcar como leída se hace vía fn_marcar_notificacion_leida, no con
-- UPDATE directo.
-- ---------------------------------------------------------------------------
alter table public.notificaciones enable row level security;

create policy notificaciones_select on public.notificaciones
  for select to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and (usuario_id = auth.uid() or (usuario_id is null and (sede_id = public.mi_sede_id() or public.puede_ver_todas_las_sedes())))
  );

-- ---------------------------------------------------------------------------
-- audit_logs — SOLO LECTURA para quien tenga permiso de auditoría. Sin policies
-- de insert/update/delete: insert solo vía SECURITY DEFINER; update/delete ya
-- están revocados a nivel de permisos de Postgres y bloqueados por trigger.
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.has_permiso('auditoria', 'ver'));
