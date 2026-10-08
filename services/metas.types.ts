export type EstadoMeta = "sin_meta" | "en_progreso" | "alcanzada" | "superada";

export type ResumenMeta = {
  anio: number;
  mes: number; // 1-12
  /** null = no hay meta definida para ese mes. */
  meta: number | null;
  /** Ventas confirmadas del mes (total de cada venta), calculadas desde Supabase. */
  ventas: number;
  /** ventas / meta × 100, sin tope en 100. null si no hay meta. */
  porcentaje: number | null;
  /** Lo que falta para la meta (0 si ya se alcanzó). null si no hay meta. */
  faltante: number | null;
  estado: EstadoMeta;
};

export type GuardarMetaPayload = { anio: number; mes: number; meta: number };

export interface MetasService {
  /** Mes y año actuales en hora de Perú. */
  mesActual(): { anio: number; mes: number };
  obtenerResumenMes(anio: number, mes: number): Promise<ResumenMeta>;
  /** Todas las metas registradas con sus ventas reales, la más reciente primero. */
  listarHistorial(): Promise<ResumenMeta[]>;
  /** Crea la meta del mes o, si ya existe, la actualiza (una sola meta por año y mes). */
  guardarMeta(payload: GuardarMetaPayload): Promise<void>;
}
