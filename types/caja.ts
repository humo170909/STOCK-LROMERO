import type { MedioPago } from "./ventas";

export type TipoMovimientoCaja = "ingreso_venta" | "ingreso_manual" | "egreso_manual";

export type MovimientoCaja = {
  id: string;
  tipo: TipoMovimientoCaja;
  medioPago: MedioPago;
  monto: number;
  fecha: string;
  sedeId: string;
  usuarioId: string;
  referenciaVentaId?: string;
  concepto: string;
};

export type EstadoCaja = "abierta" | "cerrada";

export type AperturaCierreCaja = {
  id: string;
  sedeId: string;
  usuarioId: string;
  estado: EstadoCaja;
  montoApertura: number;
  montoCierreEsperado?: number;
  montoCierreReal?: number;
  diferencia?: number;
  abiertaEn: string;
  cerradaEn?: string;
};
