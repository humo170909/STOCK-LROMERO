-- ============================================================================
-- 32_rls_cotizaciones.sql                                        (M-13)
-- Las políticas de cotizaciones no validaban la sede ni el cliente:
--  * insert: la sede debe ser la del usuario (o cualquiera de su empresa si es
--    administrador) y el cliente debe ser de su empresa;
--  * update: solo cotizaciones de su sede (administrador/supervisor: toda la
--    empresa) y no se puede cambiar a otra empresa/sede ni a 'convertida' a mano.
-- Idempotente (drop policy if exists + create policy).
-- ============================================================================

drop policy if exists cotizaciones_insert on public.cotizaciones;
create policy cotizaciones_insert on public.cotizaciones
  for insert to authenticated
  with check (
    empresa_id = public.mi_empresa_id()
    and usuario_id = auth.uid()
    and public.has_permiso('cotizaciones', 'crear')
    and estado = 'borrador'
    and (public.es_administrador() or sede_id = public.mi_sede_id())
    and exists (select 1 from public.sedes s where s.id = sede_id and s.empresa_id = public.mi_empresa_id())
    and exists (select 1 from public.clientes c where c.id = cliente_id and c.empresa_id = public.mi_empresa_id())
  );

drop policy if exists cotizaciones_update on public.cotizaciones;
create policy cotizaciones_update on public.cotizaciones
  for update to authenticated
  using (
    empresa_id = public.mi_empresa_id()
    and estado <> 'convertida'
    and public.has_permiso('cotizaciones', 'editar')
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
  )
  with check (
    empresa_id = public.mi_empresa_id()
    and estado <> 'convertida'
    and (public.puede_ver_todas_las_sedes() or sede_id = public.mi_sede_id())
    and exists (select 1 from public.clientes c where c.id = cliente_id and c.empresa_id = public.mi_empresa_id())
  );
