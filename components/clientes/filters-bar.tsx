"use client";

import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { FiltrosClientes } from "@/services";

export function FiltersBar({
  filtros,
  onChange,
}: {
  filtros: FiltrosClientes;
  onChange: (filtros: FiltrosClientes) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchInput
        value={filtros.busqueda ?? ""}
        onChange={(busqueda) => onChange({ ...filtros, busqueda })}
        placeholder="Buscar por nombre o documento…"
        className="w-full sm:w-72"
      />

      <Select
        value={filtros.riesgo ?? "todos"}
        onValueChange={(v) => onChange({ ...filtros, riesgo: v === "todos" ? undefined : (v as "bajo" | "medio" | "alto") })}
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Riesgo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todo riesgo</SelectItem>
          <SelectItem value="bajo">Bajo</SelectItem>
          <SelectItem value="medio">Medio</SelectItem>
          <SelectItem value="alto">Alto</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filtros.activo ?? "activos"}
        onValueChange={(v) => onChange({ ...filtros, activo: v as FiltrosClientes["activo"] })}
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

      <Button
        type="button"
        variant={filtros.soloInactivosPorCompra ? "secondary" : "outline"}
        size="sm"
        onClick={() => onChange({ ...filtros, soloInactivosPorCompra: !filtros.soloInactivosPorCompra })}
      >
        Sin comprar hace 6+ meses
      </Button>
    </div>
  );
}
