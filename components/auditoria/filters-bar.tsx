"use client";

import { useEffect, useState } from "react";
import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { usuariosService, type FiltrosAuditoria } from "@/services";
import type { ModuloAuditoria, Usuario } from "@/types";

export const MODULO_LABEL: Record<ModuloAuditoria, string> = {
  sesion: "Sesión",
  ventas: "Ventas",
  productos: "Productos",
  inventario: "Inventario",
  compras: "Compras",
  precios: "Precios",
  permisos: "Permisos",
  configuracion: "Configuración",
  caja: "Caja",
  clientes: "Clientes",
  proveedores: "Proveedores",
  trabajadores: "Trabajadores",
};

const MODULOS = Object.keys(MODULO_LABEL) as ModuloAuditoria[];

export function FiltersBar({
  filtros,
  onChange,
}: {
  filtros: FiltrosAuditoria;
  onChange: (filtros: FiltrosAuditoria) => void;
}) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const rango = { desde: new Date(filtros.fechaDesde!), hasta: new Date(filtros.fechaHasta!) };

  useEffect(() => {
    let vigente = true;
    usuariosService.listarUsuarios().then((lista) => {
      if (vigente) setUsuarios(lista);
    });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchInput
        value={filtros.busqueda ?? ""}
        onChange={(busqueda) => onChange({ ...filtros, busqueda })}
        placeholder="Buscar por acción…"
        className="w-full sm:w-64"
      />

      <DateRangePicker
        desde={rango.desde}
        hasta={rango.hasta}
        onChange={(r) => onChange({ ...filtros, fechaDesde: r.desde.toISOString(), fechaHasta: r.hasta.toISOString() })}
      />

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
        value={filtros.modulo ?? "todos"}
        onValueChange={(v) => onChange({ ...filtros, modulo: v === "todos" ? undefined : (v as ModuloAuditoria) })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Módulo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los módulos</SelectItem>
          {MODULOS.map((m) => (
            <SelectItem key={m} value={m}>
              {MODULO_LABEL[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtros.resultado ?? "todos"}
        onValueChange={(v) => onChange({ ...filtros, resultado: v === "todos" ? undefined : (v as "exito" | "error") })}
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Resultado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="exito">Éxito</SelectItem>
          <SelectItem value="error">Error</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
