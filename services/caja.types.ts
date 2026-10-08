import type { AperturaCierreCaja, MedioPago, MovimientoCaja } from "@/types";

export type TotalPorMedioPago = { medioPago: MedioPago; monto: number };

export type ResumenDiarioCaja = {
  ventasDelDia: number;
  costoVentas: number;
  gananciaBruta: number;
  otrosIngresos: number;
  totalIngresos: number;
};

export type ResumenCaja = {
  cajaActual: AperturaCierreCaja;
  historial: AperturaCierreCaja[];
  movimientosHoy: MovimientoCaja[];
  totalesPorMedioPago: TotalPorMedioPago[];
  resumen: ResumenDiarioCaja;
  montoEsperadoEfectivo: number;
};

export type MovimientoManualPayload = {
  tipo: "ingreso_manual" | "egreso_manual";
  medioPago: MedioPago;
  monto: number;
  concepto: string;
};

export interface CajaService {
  obtenerResumen(): Promise<ResumenCaja>;
  registrarMovimientoManual(payload: MovimientoManualPayload): Promise<void>;
  cerrarCaja(montoCierreReal: number): Promise<void>;
  abrirCaja(montoApertura: number): Promise<void>;
}
