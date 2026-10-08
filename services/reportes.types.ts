import type { EstadoStock, MedioPago, Producto, TipoMovimientoInventario } from "@/types";

export type FiltrosReporte = {
  fechaDesde: string;
  fechaHasta: string;
  sedeId?: string;
  categoria?: string;
  usuarioId?: string;
  productoId?: string;
};

// --- Ventas ---------------------------------------------------------------

export type VentasPorDia = { fecha: string; cantidadVentas: number; totalVentas: number; totalCosto: number; totalGanancia: number };
export type VentasPorProducto = { productoId: string; nombreProducto: string; cantidad: number; monto: number };
export type VentasPorCliente = { clienteId: string; nombreCliente: string; cantidadVentas: number; totalVenta: number };
export type VentasPorTrabajador = { usuarioId: string; nombreUsuario: string; cantidadVentas: number; totalVenta: number };
export type VentasPorMedioPago = { medioPago: MedioPago; monto: number };

export type ReporteVentas = {
  totales: { cantidadVentas: number; totalVendido: number; totalCosto: number; totalGanancia: number };
  porDia: VentasPorDia[];
  porProducto: VentasPorProducto[];
  porCliente: VentasPorCliente[];
  porTrabajador: VentasPorTrabajador[];
  porMedioPago: VentasPorMedioPago[];
};

// --- Inventario -------------------------------------------------------------

export type ValorizacionProducto = {
  producto: Producto;
  estado: EstadoStock;
  valorCosto: number;
  valorVenta: number;
};

export type ReporteInventario = {
  totales: { unidades: number; valorCosto: number; valorVenta: number };
  stockActual: ValorizacionProducto[];
  stockBajo: Producto[];
  agotados: Producto[];
  movimientosPorTipo: { tipo: TipoMovimientoInventario; cantidad: number }[];
};

// --- Compras ----------------------------------------------------------------

export type ComprasPorPeriodo = { fecha: string; cantidadCompras: number; totalCompras: number };
export type ComprasPorProveedor = { proveedorId: string; nombreProveedor: string; cantidadCompras: number; totalCompras: number };
export type ComprasPorProducto = { productoId: string; nombreProducto: string; cantidad: number; totalCosto: number };

export type ReporteCompras = {
  totales: { cantidadCompras: number; totalComprado: number };
  porPeriodo: ComprasPorPeriodo[];
  porProveedor: ComprasPorProveedor[];
  porProducto: ComprasPorProducto[];
};

// --- Costo y ganancia ---------------------------------------------------------

export type AgrupacionCostoGanancia = "dia" | "semana" | "mes" | "rango";

export type FilaCostoGanancia = {
  grupo: string;
  productoId: string;
  nombreProducto: string;
  cantidadVendida: number;
  precioVenta: number;
  costoUnitario: number;
  ventaTotal: number;
  costoTotal: number;
  ganancia: number;
};

export type ReporteCostoGanancia = {
  filas: FilaCostoGanancia[];
  totales: { totalVendido: number; costoTotal: number; gananciaTotal: number; margenPct: number };
};

export interface ReportesService {
  obtenerReporteVentas(filtros: FiltrosReporte): Promise<ReporteVentas>;
  obtenerReporteInventario(filtros: FiltrosReporte): Promise<ReporteInventario>;
  obtenerReporteCompras(filtros: FiltrosReporte): Promise<ReporteCompras>;
  obtenerReporteCostoGanancia(filtros: FiltrosReporte, agrupacion: AgrupacionCostoGanancia): Promise<ReporteCostoGanancia>;
  exportarReporte(tipo: "ventas" | "inventario" | "compras" | "costo-ganancia", filtros: FiltrosReporte): Promise<Blob>;
}
