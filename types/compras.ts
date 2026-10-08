export type EstadoCompra = "registrada" | "anulada";

export type DetalleCompra = {
  id: string;
  compraId: string;
  productoId: string;
  nombreProducto: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
};

export type Compra = {
  id: string;
  numeroDocumento: string;
  proveedorId: string;
  fecha: string;
  sedeId: string;
  subtotal: number;
  impuesto: number;
  total: number;
  estado: EstadoCompra;
  observaciones?: string;
};
