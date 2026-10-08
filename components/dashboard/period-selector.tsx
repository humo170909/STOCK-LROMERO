"use client";

import { DateRangePicker } from "@/components/shared/date-range-picker";
import { cn } from "@/lib/utils";
import type { PeriodoDashboardId, RangoFechas } from "@/services/dashboard.types";

const OPCIONES: { id: PeriodoDashboardId; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "ayer", label: "Ayer" },
  { id: "7d", label: "Últimos 7 días" },
  { id: "30d", label: "Últimos 30 días" },
  { id: "mes", label: "Este mes" },
  { id: "personalizado", label: "Personalizado" },
];

export function PeriodSelector({
  periodo,
  rango,
  onPeriodoChange,
  onRangoChange,
}: {
  periodo: PeriodoDashboardId;
  rango: RangoFechas;
  onPeriodoChange: (id: PeriodoDashboardId) => void;
  onRangoChange: (rango: RangoFechas) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {OPCIONES.map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            onClick={() => onPeriodoChange(opcion.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 pointer-coarse:min-h-11 text-[13px] font-medium transition-colors",
              periodo === opcion.id ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900",
            )}
          >
            {opcion.label}
          </button>
        ))}
      </div>
      {periodo === "personalizado" ? (
        <DateRangePicker desde={rango.desde} hasta={rango.hasta} onChange={onRangoChange} />
      ) : null}
    </div>
  );
}
