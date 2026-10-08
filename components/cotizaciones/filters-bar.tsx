"use client";

import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Cliente, EstadoCotizacion } from "@/types";
import type { FiltrosCotizaciones } from "@/services";

const ESTADOS: EstadoCotizacion[] = ["borrador", "enviada", "aceptada", "rechazada", "vencida", "convertida"];
const LABEL: Record<EstadoCotizacion, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
  convertida: "Convertida",
};

export function FiltersBar({
  filtros,
  clientes,
  onChange,
}: {
  filtros: FiltrosCotizaciones;
  clientes: Cliente[];
  onChange: (filtros: FiltrosCotizaciones) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchInput
        value={filtros.busqueda ?? ""}
        onChange={(busqueda) => onChange({ ...filtros, busqueda })}
        placeholder="Buscar por número o cliente…"
        className="w-full sm:w-72"
      />

      <Select
        value={filtros.clienteId ?? "todos"}
        onValueChange={(v) => onChange({ ...filtros, clienteId: v === "todos" ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los clientes</SelectItem>
          {clientes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtros.estado ?? "todos"}
        onValueChange={(v) => onChange({ ...filtros, estado: v === "todos" ? undefined : (v as EstadoCotizacion) })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {ESTADOS.map((e) => (
            <SelectItem key={e} value={e}>
              {LABEL[e]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
