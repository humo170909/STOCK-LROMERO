"use client";

import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FiltrosTrabajadores } from "@/services";

export function FiltersBar({
  filtros,
  onChange,
}: {
  filtros: FiltrosTrabajadores;
  onChange: (filtros: FiltrosTrabajadores) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchInput
        value={filtros.busqueda ?? ""}
        onChange={(busqueda) => onChange({ ...filtros, busqueda })}
        placeholder="Buscar por nombre, documento o cargo…"
        className="w-full sm:w-72"
      />
      <Select
        value={filtros.activo ?? "activos"}
        onValueChange={(v) => onChange({ ...filtros, activo: v as FiltrosTrabajadores["activo"] })}
      >
        <SelectTrigger className="w-full sm:w-36">
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
