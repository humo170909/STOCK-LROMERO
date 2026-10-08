import type { EstadoStock, Producto } from "@/types";
import type { AjusteStockPayload, GuardarProductoPayload } from "@/store/app-store";

export type FiltrosProductos = {
  busqueda?: string;
  categoria?: string;
  estadoStock?: EstadoStock;
  activo?: "todos" | "activos" | "inactivos";
};

export interface ProductosService {
  listarProductos(filtros?: FiltrosProductos): Promise<Producto[]>;
  listarCategorias(): Promise<string[]>;
  ajustarStock(payload: AjusteStockPayload): Promise<void>;
  guardarProducto(payload: GuardarProductoPayload): Promise<void>;
  cambiarEstado(id: string, activo: boolean): Promise<void>;
  exportarKardex(): Promise<Blob>;
}
