"use client";

import { endOfDay, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { SearchInput } from "@/components/shared/search-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MEDIO_PAGO_LABEL, type Cliente, type MedioPago, type Sede, type Usuario } from "@/types";
import type { FiltrosVentas } from "@/services";

type AtajoFecha = "hoy" | "semana" | "mes" | "todas";

export function FiltersBar({
  filtros,
  clientes,
  usuarios,
  sedes,
  atajo,
  onAtajoChange,
  onChange,
}: {
  filtros: FiltrosVentas;
  clientes: Cliente[];
  usuarios: Usuario[];
  sedes: Sede[];
  atajo: AtajoFecha;
  onAtajoChange: (atajo: AtajoFecha, rango: { desde?: string; hasta?: string }) => void;
  onChange: (filtros: FiltrosVentas) => void;
}) {
  const atajos: { id: AtajoFecha; label: string }[] = [
    { id: "hoy", label: "Hoy" },
    { id: "semana", label: "Semana" },
    { id: "mes", label: "Mes" },
    { id: "todas", label: "Todas" },
  ];

  const aplicarAtajo = (id: AtajoFecha) => {
    const hoy = new Date();
    if (id === "hoy") onAtajoChange(id, { desde: startOfDay(hoy).toISOString(), hasta: endOfDay(hoy).toISOString() });
    else if (id === "semana")
      onAtajoChange(id, { desde: startOfWeek(hoy, { weekStartsOn: 1 }).toISOString(), hasta: endOfDay(hoy).toISOString() });
    else if (id === "mes")
      onAtajoChange(id, { desde: startOfMonth(hoy).toISOString(), hasta: endOfDay(hoy).toISOString() });
    else onAtajoChange(id, { desde: undefined, hasta: undefined });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {atajos.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => aplicarAtajo(a.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[13px] font-medium",
                atajo === a.id ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
        <SearchInput
          value={filtros.busqueda ?? ""}
          onChange={(busqueda) => onChange({ ...filtros, busqueda })}
          placeholder="Buscar por N° de nota de venta o cliente…"
          className="w-full sm:w-72"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
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
          value={filtros.usuarioId ?? "todos"}
          onValueChange={(v) => onChange({ ...filtros, usuarioId: v === "todos" ? undefined : v })}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Usuario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los usuarios</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.medioPago ?? "todos"}
          onValueChange={(v) => onChange({ ...filtros, medioPago: v === "todos" ? undefined : (v as MedioPago) })}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Medio de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los medios</SelectItem>
            {Object.entries(MEDIO_PAGO_LABEL).map(([valor, etiqueta]) => (
              <SelectItem key={valor} value={valor}>
                {etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.estado ?? "todos"}
          onValueChange={(v) => onChange({ ...filtros, estado: v === "todos" ? undefined : (v as "confirmada" | "anulada") })}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="confirmada">Confirmada</SelectItem>
            <SelectItem value="anulada">Anulada</SelectItem>
          </SelectContent>
        </Select>

        {sedes.length > 1 ? (
          <Select
            value={filtros.sedeId ?? "todas"}
            onValueChange={(v) => onChange({ ...filtros, sedeId: v === "todas" ? undefined : v })}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Sede" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las sedes</SelectItem>
              {sedes.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            placeholder="Monto mín."
            value={filtros.montoMin ?? ""}
            onChange={(e) => onChange({ ...filtros, montoMin: e.target.value ? Number(e.target.value) : undefined })}
            className="w-28"
          />
          <span className="text-slate-400">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Monto máx."
            value={filtros.montoMax ?? ""}
            onChange={(e) => onChange({ ...filtros, montoMax: e.target.value ? Number(e.target.value) : undefined })}
            className="w-28"
          />
        </div>

        {Object.keys(filtros).some((k) => filtros[k as keyof FiltrosVentas] !== undefined) ? (
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            Limpiar filtros
          </Button>
        ) : null}
      </div>
    </div>
  );
}
