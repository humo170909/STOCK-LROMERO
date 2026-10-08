import type { Compra, DetalleCompra, EstadoCompra, Proveedor } from "@/types";
import type { RegistrarCompraPayload } from "@/store/app-store";

export type CompraListado = Compra & { nombreProveedor: string };

export type FiltrosCompras = {
  busqueda?: string;
  proveedorId?: string;
  estado?: EstadoCompra;
  fechaDesde?: string;
  fechaHasta?: string;
};

export type DetalleCompraCompleto = {
  compra: Compra;
  detalle: DetalleCompra[];
  proveedor: Proveedor | null;
};

export interface ComprasService {
  listarCompras(filtros?: FiltrosCompras): Promise<CompraListado[]>;
  obtenerDetalleCompra(compraId: string): Promise<DetalleCompraCompleto>;
  registrarCompra(payload: RegistrarCompraPayload): Promise<Compra>;
}
