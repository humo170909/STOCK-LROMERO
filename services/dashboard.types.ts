import type { AperturaCierreCaja, MedioPago, Notificacion, Producto, RegistroAuditoria, Venta } from "@/types";

export type PeriodoDashboardId = "hoy" | "ayer" | "7d" | "30d" | "mes" | "personalizado";

export type RangoFechas = { desde: Date; hasta: Date };

export type PeriodoDashboard = {
  id: PeriodoDashboardId;
  rango?: RangoFechas; // requerido cuando id === "personalizado"
};

export type ComparacionValor = {
  actual: number;
  anterior: number;
  variacionPct: number | null;
};

export type PuntoSerieVentas = {
  fecha: string;
  ventas: number;
  ganancia: number;
};

export type VentaConCliente = Venta & { nombreCliente: string };

export type DashboardData = {
  etiquetaPeriodo: string;
  kpis: {
    totalVentas: number;
    gananciaBruta: number;
    costoVentas: number;
    productosVendidos: number;
    cantidadVentas: number;
    clientesActivos: number;
  };
  comparacionPeriodoAnterior: {
    ventas: ComparacionValor;
    ganancia: ComparacionValor;
  };
  serieVentas: PuntoSerieVentas[];
  ventasPorMedioPago: { medioPago: MedioPago; monto: number }[];
  productosMasVendidos: { producto: Producto; cantidad: number; monto: number }[];
  stockCritico: Producto[];
  ultimasVentas: VentaConCliente[];
  actividadReciente: RegistroAuditoria[];
  estadoCaja: AperturaCierreCaja;
  alertas: Notificacion[];
};

export interface DashboardService {
  obtenerDashboard(periodo: PeriodoDashboard): Promise<DashboardData>;
}
