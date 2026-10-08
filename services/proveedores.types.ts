import type { Proveedor } from "@/types";
import type { GuardarProveedorPayload } from "@/store/app-store";
import type { CompraListado } from "./compras.types";

export type FiltrosProveedores = {
  busqueda?: string;
  activo?: "todos" | "activos" | "inactivos";
};

export type ProveedorListado = Proveedor & {
  totalComprado: number;
  numeroCompras: number;
  ultimaCompra: string | null;
};

export interface ProveedoresService {
  listarProveedores(filtros?: FiltrosProveedores): Promise<ProveedorListado[]>;
  obtenerHistorialCompras(proveedorId: string): Promise<CompraListado[]>;
  guardarProveedor(payload: GuardarProveedorPayload): Promise<void>;
  cambiarEstado(id: string, activo: boolean): Promise<void>;
}
