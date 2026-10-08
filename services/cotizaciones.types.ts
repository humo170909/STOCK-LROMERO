import type { Cliente, Cotizacion, DetalleCotizacion, EstadoCotizacion, Venta } from "@/types";
import type { ConvertirCotizacionPayload, CrearCotizacionPayload } from "@/store/app-store";

export type CotizacionListado = Cotizacion & { nombreCliente: string };

export type FiltrosCotizaciones = {
  busqueda?: string;
  clienteId?: string;
  estado?: EstadoCotizacion;
};

export type DetalleCotizacionCompleto = {
  cotizacion: Cotizacion;
  detalle: DetalleCotizacion[];
  nombreCliente: string;
};

/** Línea de cotización con los datos de producto necesarios para el PDF (solo lectura). */
export type LineaCotizacionPdf = DetalleCotizacion & {
  unidadMedida: string;
  marca?: string;
  descripcion?: string;
};

export type DatosCotizacionPdf = {
  cotizacion: Cotizacion;
  cliente: Cliente | null;
  lineas: LineaCotizacionPdf[];
};

export interface CotizacionesService {
  listarCotizaciones(filtros?: FiltrosCotizaciones): Promise<CotizacionListado[]>;
  obtenerDetalleCotizacion(cotizacionId: string): Promise<DetalleCotizacionCompleto>;
  obtenerDatosParaPdf(cotizacionId: string): Promise<DatosCotizacionPdf>;
  crearCotizacion(payload: CrearCotizacionPayload): Promise<Cotizacion>;
  cambiarEstado(id: string, estado: "enviada" | "aceptada" | "rechazada"): Promise<void>;
  /** Total que tendría la venta si se convirtiera hoy (precio vigente + impuesto), para repartir el pago. */
  calcularTotalConversion(cotizacionId: string): Promise<number>;
  convertirAVenta(payload: ConvertirCotizacionPayload): Promise<Venta>;
}
