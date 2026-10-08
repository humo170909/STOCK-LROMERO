export type MedioPago = "efectivo" | "yape" | "plin" | "transferencia" | "tarjeta" | "otros";

export const MEDIO_PAGO_LABEL: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otros: "Otros",
};

/** Medio con el que se guarda una venta: uno de los medios, o "mixto" si se pagó con más de uno. */
export type MedioPagoVenta = MedioPago | "mixto";

export const MEDIO_PAGO_VENTA_LABEL: Record<MedioPagoVenta, string> = { ...MEDIO_PAGO_LABEL, mixto: "Mixto" };

/** Un renglón de pago de una venta (venta_pagos). */
export type PagoVenta = { medioPago: MedioPago; monto: number };

export type EstadoVenta = "confirmada" | "anulada";

/** Cada línea guarda su propio precio y costo históricos: nunca se recalculan con el precio/costo actual del producto. */
export type DetalleVenta = {
  id: string;
  ventaId: string;
  productoId: string;
  nombreProducto: string;
  cantidad: number;
  precioHistorico: number;
  costoHistorico: number;
  descuento: number;
  subtotal: number;
  ganancia: number;
};

export type Venta = {
  id: string;
  /** Nota de venta interna, p. ej. "NV-001181". No es un comprobante electrónico. */
  numero: string;
  correlativo: number;
  fecha: string;
  clienteId: string;
  usuarioId: string;
  sedeId: string;
  medioPago: MedioPagoVenta;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  costoTotal: number;
  gananciaTotal: number;
  estado: EstadoVenta;
  observaciones?: string;
};

export type EstadoCotizacion =
  | "borrador"
  | "enviada"
  | "aceptada"
  | "rechazada"
  | "vencida"
  | "convertida";

export type DetalleCotizacion = {
  id: string;
  cotizacionId: string;
  productoId: string;
  nombreProducto: string;
  cantidad: number;
  precio: number;
  descuento: number;
  subtotal: number;
};

export type Cotizacion = {
  id: string;
  numero: string;
  clienteId: string;
  usuarioId: string;
  fechaEmision: string;
  fechaVencimiento: string;
  condiciones?: string;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  estado: EstadoCotizacion;
  ventaId?: string;
};
