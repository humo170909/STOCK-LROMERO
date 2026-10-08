import type { ConfiguracionEmpresa, MedioPago } from "@/types";
import type { GuardarSedePayload } from "@/store/app-store";

export interface ConfiguracionService {
  actualizarEmpresa(payload: Partial<ConfiguracionEmpresa>): Promise<void>;
  actualizarMediosPagoActivos(medios: MedioPago[]): Promise<void>;
  guardarSede(payload: GuardarSedePayload): Promise<void>;
  cambiarEstadoSede(id: string, activa: boolean): Promise<void>;
}
