-- ============================================================================
-- 20_triggers.sql
-- ============================================================================

create trigger trg_empresas_updated_at before update on public.empresas
  for each row execute function public.set_updated_at();

create trigger trg_sedes_updated_at before update on public.sedes
  for each row execute function public.set_updated_at();

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_categorias_updated_at before update on public.categorias
  for each row execute function public.set_updated_at();

create trigger trg_productos_updated_at before update on public.productos
  for each row execute function public.set_updated_at();

create trigger trg_inventario_updated_at before update on public.inventario
  for each row execute function public.set_updated_at();

create trigger trg_clientes_updated_at before update on public.clientes
  for each row execute function public.set_updated_at();

create trigger trg_proveedores_updated_at before update on public.proveedores
  for each row execute function public.set_updated_at();

create trigger trg_ventas_updated_at before update on public.ventas
  for each row execute function public.set_updated_at();

create trigger trg_cotizaciones_updated_at before update on public.cotizaciones
  for each row execute function public.set_updated_at();

create trigger trg_compras_updated_at before update on public.compras
  for each row execute function public.set_updated_at();

create trigger trg_trabajadores_updated_at before update on public.trabajadores
  for each row execute function public.set_updated_at();

-- Bloqueo duro de auditoría: ni siquiera el propietario de una transacción con un
-- bug puede mutar un registro ya escrito.
create trigger trg_audit_logs_no_update before update on public.audit_logs
  for each row execute function public.fn_block_audit_mutation();

create trigger trg_audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.fn_block_audit_mutation();
