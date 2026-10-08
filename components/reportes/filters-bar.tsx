"use client";

import { useEffect, useState } from "react";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { productosService, usuariosService, type FiltrosReporte } from "@/services";
import type { Producto, Usuario } from "@/types";

export function FiltersBar({
  filtros,
  onChange,
}: {
  filtros: FiltrosReporte;
  onChange: (filtros: FiltrosReporte) => void;
}) {
  const sedes = useAppStore((s) => s.sedes);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const categorias = [...new Set(productos.map((p) => p.categoria))].sort();

  useEffect(() => {
    let vigente = true;
    Promise.all([usuariosService.listarUsuarios(), productosService.listarProductos()]).then(([listaUsuarios, listaProductos]) => {
      if (!vigente) return;
      setUsuarios(listaUsuarios);
      setProductos(listaProductos);
    });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <DateRangePicker
        desde={new Date(filtros.fechaDesde)}
        hasta={new Date(filtros.fechaHasta)}
        onChange={(r) => onChange({ ...filtros, fechaDesde: r.desde.toISOString(), fechaHasta: r.hasta.toISOString() })}
      />

      {sedes.length > 1 ? (
        <Select value={filtros.sedeId ?? "todas"} onValueChange={(v) => onChange({ ...filtros, sedeId: v === "todas" ? undefined : v })}>
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

      <Select
        value={filtros.categoria ?? "todas"}
        onValueChange={(v) => onChange({ ...filtros, categoria: v === "todas" ? undefined : v })}
      >
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
        value={filtros.productoId ?? "todos"}
        onValueChange={(v) => onChange({ ...filtros, productoId: v === "todos" ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Producto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los productos</SelectItem>
          {productos.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
