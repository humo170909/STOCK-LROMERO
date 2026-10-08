"use client";

import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import type { TipoMovimientoInventario } from "@/types";
import type { FiltrosMovimientos } from "@/services";

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimientoInventario, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
  compra: "Compra",
  venta: "Venta",
  devolucion: "Devolución",
  correccion: "Corrección",
};

const TIPOS = Object.keys(TIPO_MOVIMIENTO_LABEL) as TipoMovimientoInventario[];

export function FiltersBar({
  filtros,
  onChange,
}: {
  filtros: FiltrosMovimientos;
  onChange: (filtros: FiltrosMovimientos) => void;
}) {
  // El estado inicial de los filtros (en el componente padre) siempre trae un rango de
  // fechas definido, así que aquí solo se parsean fechas ya fijas (nunca Date.now()).
  const rango = { desde: new Date(filtros.fechaDesde!), hasta: new Date(filtros.fechaHasta!) };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchInput
        value={filtros.busqueda ?? ""}
        onChange={(busqueda) => onChange({ ...filtros, busqueda })}
        placeholder="Buscar por producto o motivo…"
        className="w-full sm:w-64"
      />

      <Select
        value={filtros.tipo ?? "todos"}
        onValueChange={(v) => onChange({ ...filtros, tipo: v === "todos" ? undefined : (v as TipoMovimientoInventario) })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los tipos</SelectItem>
          {TIPOS.map((t) => (
            <SelectItem key={t} value={t}>
              {TIPO_MOVIMIENTO_LABEL[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DateRangePicker
        desde={rango.desde}
        hasta={rango.hasta}
        onChange={(r) => onChange({ ...filtros, fechaDesde: r.desde.toISOString(), fechaHasta: r.hasta.toISOString() })}
      />

      {filtros.tipo || filtros.busqueda ? (
        <button
          type="button"
          onClick={() => onChange({ ...filtros, tipo: undefined, busqueda: undefined })}
          className="text-[13px] font-medium text-brand-600 hover:underline"
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}
