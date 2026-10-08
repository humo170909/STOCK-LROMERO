import type { Trabajador } from "@/types";
import type { GuardarTrabajadorPayload } from "@/store/app-store";

export type FiltrosTrabajadores = {
  busqueda?: string;
  sedeId?: string;
  activo?: "todos" | "activos" | "inactivos";
};

export interface TrabajadoresService {
  listarTrabajadores(filtros?: FiltrosTrabajadores): Promise<Trabajador[]>;
  guardarTrabajador(payload: GuardarTrabajadorPayload): Promise<void>;
  cambiarEstado(id: string, activo: boolean): Promise<void>;
}
