import type { MovimientoInventario, TipoMovimientoInventario } from "@/types";

export type FiltrosMovimientos = {
  busqueda?: string;
  productoId?: string;
  tipo?: TipoMovimientoInventario;
  fechaDesde?: string;
  fechaHasta?: string;
};

export interface MovimientosService {
  listarMovimientos(filtros?: FiltrosMovimientos): Promise<MovimientoInventario[]>;
  exportarMovimientos(filtros?: FiltrosMovimientos): Promise<Blob>;
}
