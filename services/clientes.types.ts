import type { Cliente, Producto, Venta } from "@/types";
import type { GuardarClientePayload } from "@/store/app-store";

export type FiltrosClientes = {
  busqueda?: string;
  activo?: "todos" | "activos" | "inactivos";
  riesgo?: Cliente["riesgo"];
  soloInactivosPorCompra?: boolean;
};

export type ClienteListado = Cliente & {
  totalComprado: number;
  numeroCompras: number;
  ultimaCompra: string | null;
  inactivoPorCompra: boolean;
};

export type ProductoComprado = { producto: Producto; cantidad: number; monto: number };

export type ExpedienteCliente = {
  cliente: Cliente;
  totalComprado: number;
  numeroCompras: number;
  ultimaCompra: string | null;
  diasSinComprar: number | null;
  inactivoPorCompra: boolean;
  historial: Venta[];
  productosComprados: ProductoComprado[];
};

export interface ClientesService {
  listarClientes(filtros?: FiltrosClientes): Promise<ClienteListado[]>;
  obtenerExpediente(clienteId: string): Promise<ExpedienteCliente>;
  guardarCliente(payload: GuardarClientePayload): Promise<void>;
  cambiarEstado(id: string, activo: boolean): Promise<void>;
  eliminarCliente(id: string): Promise<void>;
  enviarAvisoCatalogo(id: string): Promise<void>;
}

/** Más de este tiempo sin comprar = cliente inactivo. Configurable a futuro desde Configuración. */
export const DIAS_INACTIVIDAD_CLIENTE = 180;
