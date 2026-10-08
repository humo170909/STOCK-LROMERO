"use client";

import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Proveedor } from "@/types";
import type { FiltrosCompras } from "@/services";

export function FiltersBar({
  filtros,
  proveedores,
  onChange,
}: {
  filtros: FiltrosCompras;
  proveedores: Proveedor[];
  onChange: (filtros: FiltrosCompras) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchInput
        value={filtros.busqueda ?? ""}
        onChange={(busqueda) => onChange({ ...filtros, busqueda })}
        placeholder="Buscar por documento o proveedor…"
        className="w-full sm:w-72"
      />

      <Select
        value={filtros.proveedorId ?? "todos"}
        onValueChange={(v) => onChange({ ...filtros, proveedorId: v === "todos" ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue placeholder="Proveedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los proveedores</SelectItem>
          {proveedores.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.razonSocial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtros.estado ?? "todos"}
        onValueChange={(v) => onChange({ ...filtros, estado: v === "todos" ? undefined : (v as "registrada" | "anulada") })}
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          <SelectItem value="registrada">Registrada</SelectItem>
          <SelectItem value="anulada">Anulada</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
