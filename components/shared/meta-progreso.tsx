import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cn } from "@/lib/utils";
import type { EstadoMeta, ResumenMeta } from "@/services/metas.types";

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const ESTADO_META: Record<Exclude<EstadoMeta, "sin_meta">, { texto: string; tone: "warning" | "success" | "info"; barra: string }> = {
  en_progreso: { texto: "En progreso", tone: "warning", barra: "bg-amber-400" },
  alcanzada: { texto: "Meta alcanzada", tone: "success", barra: "bg-emerald-500" },
  superada: { texto: "Meta superada", tone: "info", barra: "bg-brand-500" },
};

export function formatearPorcentaje(valor: number) {
  return `${valor.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

/** Barra de progreso: el porcentaje mostrado no se limita a 100, solo el ancho de la barra. */
export function BarraProgreso({ porcentaje, estado }: { porcentaje: number; estado: Exclude<EstadoMeta, "sin_meta"> }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(porcentaje)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Cumplimiento de la meta"
      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
    >
      <div className={cn("h-full rounded-full transition-[width]", ESTADO_META[estado].barra)} style={{ width: `${Math.min(porcentaje, 100)}%` }} />
    </div>
  );
}

/** Resumen de una meta mensual (meta, ventas, cumplimiento, faltante y estado). */
export function MetaProgreso({ resumen }: { resumen: ResumenMeta }) {
  if (resumen.meta === null || resumen.porcentaje === null || resumen.estado === "sin_meta") {
    return (
      <p className="text-sm text-slate-500">
        No hay una meta definida para {MESES[resumen.mes - 1]} {resumen.anio}. Ventas del mes: <CurrencyDisplay value={resumen.ventas} className="font-medium text-navy-900" />
      </p>
    );
  }
  const estado = ESTADO_META[resumen.estado];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-display text-2xl font-semibold tracking-tight text-navy-900">
          <CurrencyDisplay value={resumen.ventas} /> <span className="text-base font-medium text-slate-400">/ <CurrencyDisplay value={resumen.meta} /></span>
        </p>
        <Badge tone={estado.tone} dot>
          {estado.texto}
        </Badge>
      </div>
      <BarraProgreso porcentaje={resumen.porcentaje} estado={resumen.estado} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="font-semibold text-navy-900">{formatearPorcentaje(resumen.porcentaje)} cumplido</span>
        {resumen.estado === "en_progreso" && resumen.faltante !== null ? (
          <span className="text-slate-500">
            Faltan <CurrencyDisplay value={resumen.faltante} className="font-medium text-navy-900" />
          </span>
        ) : (
          <span className="text-slate-500">{resumen.estado === "superada" ? "Superaste la meta" : "Meta alcanzada"}</span>
        )}
      </div>
    </div>
  );
}
