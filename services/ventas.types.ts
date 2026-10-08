import type { Cliente, DetalleVenta, EstadoVenta, MedioPago, PagoVenta, Producto, Venta } from "@/types";
import type { ConfirmarVentaPayload, RegistrarClienteRapidoPayload } from "@/store/app-store";

export type VentaListado = Venta & { nombreCliente: string; nombreUsuario: string };

export type FiltrosVentas = {
  busqueda?: string;
  clienteId?: string;
  usuarioId?: string;
  medioPago?: MedioPago;
  estado?: EstadoVenta;
  sedeId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  montoMin?: number;
  montoMax?: number;
};

export type DetalleVentaCompleto = {
  venta: Venta;
  detalle: DetalleVenta[];
  cliente: Cliente | null;
  nombreUsuario: string;
  /** Pagos reales por medio (una venta mixta tiene 2 o más). */
  pagos: PagoVenta[];
};

export interface VentasService {
  buscarProductosDisponibles(query: string): Promise<Producto[]>;
  buscarClientes(query: string): Promise<Cliente[]>;
  registrarClienteRapido(payload: RegistrarClienteRapidoPayload): Promise<Cliente>;
  confirmarVenta(payload: ConfirmarVentaPayload): Promise<Venta>;
  listarVentas(filtros?: FiltrosVentas): Promise<VentaListado[]>;
  obtenerDetalleVenta(ventaId: string): Promise<DetalleVentaCompleto>;
  /** ¿La sede actual tiene una caja abierta? Sin caja abierta no se puede vender. */
  hayCajaAbierta(): Promise<boolean>;
  /** Anula la venta: devuelve el stock y revierte la caja. Exige ventas.cancelar y un motivo. */
  anularVenta(ventaId: string, motivo: string): Promise<void>;
}
