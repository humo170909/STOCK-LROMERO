"use client";

import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADO_STOCK_LABEL, type EstadoStock } from "@/types";
import type { FiltrosProductos } from "@/services";

export function FiltersBar({
  filtros,
  categorias,
  onChange,
}: {
  filtros: FiltrosProductos;
  categorias: string[];
  onChange: (filtros: FiltrosProductos) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchInput
        value={filtros.busqueda ?? ""}
        onChange={(busqueda) => onChange({ ...filtros, busqueda })}
        placeholder="Buscar por nombre, SKU o código de barras…"
        className="w-full sm:w-72"
      />

      <Select value={filtros.categoria ?? "todas"} onValueChange={(categoria) => onChange({ ...filtros, categoria })}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las categorías</SelectItem>
          {categorias.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtros.estadoStock ?? "todos"}
        onValueChange={(valor) =>
          onChange({ ...filtros, estadoStock: valor === "todos" ? undefined : (valor as EstadoStock) })
        }
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Estado de stock" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {Object.entries(ESTADO_STOCK_LABEL).map(([valor, etiqueta]) => (
            <SelectItem key={valor} value={valor}>
              {etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtros.activo ?? "activos"}
        onValueChange={(valor) => onChange({ ...filtros, activo: valor as FiltrosProductos["activo"] })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Activos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="activos">Activos</SelectItem>
          <SelectItem value="inactivos">Inactivos</SelectItem>
          <SelectItem value="todos">Todos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
