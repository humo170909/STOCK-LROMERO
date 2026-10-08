export type EstadoStock = "disponible" | "stock_bajo" | "agotado";

export type Producto = {
  id: string;
  sku: string;
  codigoBarras: string;
  nombre: string;
  descripcion: string;
  especificacionTecnica?: string;
  categoria: string;
  marca: string;
  precioVenta: number;
  costo: number;
  stockActual: number;
  stockMinimo: number;
  unidad: string;
  activo: boolean;
  sedeId: string;
  creadoEn: string;
};

/** Agotado si no queda stock; bajo si está en el mínimo o por debajo; disponible en el resto de los casos. */
export function getEstadoStock(stockActual: number, stockMinimo: number): EstadoStock {
  if (stockActual <= 0) return "agotado";
  if (stockActual <= stockMinimo) return "stock_bajo";
  return "disponible";
}

export const ESTADO_STOCK_LABEL: Record<EstadoStock, string> = {
  disponible: "Disponible",
  stock_bajo: "Stock bajo",
  agotado: "Agotado",
};
