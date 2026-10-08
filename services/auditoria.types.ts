import type { ModuloAuditoria, RegistroAuditoria } from "@/types";

export type RegistroAuditoriaListado = RegistroAuditoria & { nombreUsuario: string };

export type FiltrosAuditoria = {
  busqueda?: string;
  usuarioId?: string;
  modulo?: ModuloAuditoria;
  resultado?: "exito" | "error";
  fechaDesde?: string;
  fechaHasta?: string;
};

export interface AuditoriaService {
  listarRegistros(filtros?: FiltrosAuditoria): Promise<RegistroAuditoriaListado[]>;
}
