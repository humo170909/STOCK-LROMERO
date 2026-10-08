export type TipoMovimientoInventario =
  | "entrada"
  | "salida"
  | "ajuste"
  | "compra"
  | "venta"
  | "devolucion"
  | "correccion";

export type MovimientoInventario = {
  id: string;
  productoId: string;
  nombreProducto: string;
  tipo: TipoMovimientoInventario;
  cantidadAnterior: number;
  cantidadModificada: number;
  cantidadNueva: number;
  motivo: string;
  usuarioId: string;
  sedeId: string;
  fecha: string;
  referenciaId?: string;
  referenciaTipo?: "venta" | "compra" | "ajuste";
  documentoSustento?: string;
  observaciones?: string;
};
