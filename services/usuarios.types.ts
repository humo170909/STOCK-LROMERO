import type { AccionPermiso, ModuloSistema, PermisosRol, RolUsuario, Usuario } from "@/types";
import type { GuardarUsuarioPayload } from "@/store/app-store";

export type FiltrosUsuarios = {
  busqueda?: string;
  rol?: RolUsuario;
  activo?: "todos" | "activos" | "inactivos";
};

export interface UsuariosService {
  listarUsuarios(filtros?: FiltrosUsuarios): Promise<Usuario[]>;
  guardarUsuario(payload: GuardarUsuarioPayload): Promise<void>;
  cambiarEstado(id: string, activo: boolean): Promise<void>;
  obtenerPermisos(): Promise<Record<RolUsuario, PermisosRol>>;
  actualizarPermiso(rol: RolUsuario, modulo: ModuloSistema, accion: AccionPermiso, valor: boolean): Promise<void>;
}
