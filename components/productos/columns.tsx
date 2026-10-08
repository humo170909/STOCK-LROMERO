"use client";

import { Permitido } from "@/components/shared/permitido";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreVertical, PackagePlus, Pencil, PowerOff, Power } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { StockStatusBadge } from "@/components/shared/status-badge";
import type { AppTableFeatures } from "@/components/shared/table-features";
import { getEstadoStock, type Producto } from "@/types";

export function buildColumns(opts: {
  onAjustarStock: (producto: Producto) => void;
  onEditar: (producto: Producto) => void;
  onCambiarEstado: (producto: Producto) => void;
}): ColumnDef<AppTableFeatures, Producto, unknown>[] {
  return [
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => <span className="font-medium text-navy-900">{row.original.sku}</span>,
    },
    {
      accessorKey: "nombre",
      header: "Producto",
      cell: ({ row }) => (
        <div className="min-w-48 max-w-72">
          <p className="truncate font-medium text-slate-700">{row.original.nombre}</p>
          <p className="truncate text-xs text-slate-400">
            {row.original.categoria} · {row.original.marca}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "precioVenta",
      header: "Precio",
      cell: ({ row }) => <CurrencyDisplay value={row.original.precioVenta} />,
    },
    {
      accessorKey: "costo",
      header: "Costo",
      cell: ({ row }) => <span className="text-slate-500"><CurrencyDisplay value={row.original.costo} /></span>,
    },
    {
      id: "margen",
      header: "Margen",
      cell: ({ row }) => {
        const { precioVenta, costo } = row.original;
        const margen = precioVenta > 0 ? ((precioVenta - costo) / precioVenta) * 100 : 0;
        return <span className="text-slate-500">{margen.toFixed(0)}%</span>;
      },
    },
    {
      accessorKey: "stockActual",
      header: "Stock",
      cell: ({ row }) => (
        <span className="font-medium text-navy-900">
          {row.original.stockActual} <span className="font-normal text-slate-400">/ mín. {row.original.stockMinimo}</span>
        </span>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      cell: ({ row }) => <StockStatusBadge estado={getEstadoStock(row.original.stockActual, row.original.stockMinimo)} />,
    },
    {
      accessorKey: "activo",
      header: "Visible",
      cell: ({ row }) => (
        <Badge tone={row.original.activo ? "info" : "neutral"}>{row.original.activo ? "Activo" : "Inactivo"}</Badge>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const producto = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Acciones para ${producto.nombre}`}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Permitido modulo="inventario" accion="editar">
                <DropdownMenuItem onSelect={() => opts.onAjustarStock(producto)}>
                  <PackagePlus className="size-4" strokeWidth={1.75} />
                  Ajustar stock
                </DropdownMenuItem>
              </Permitido>
              <Permitido modulo="productos" accion="editar">
                <DropdownMenuItem onSelect={() => opts.onEditar(producto)}>
                  <Pencil className="size-4" strokeWidth={1.75} />
                  Editar
                </DropdownMenuItem>
              </Permitido>
              <Permitido modulo="productos" accion="editar">
                <DropdownMenuItem onSelect={() => opts.onCambiarEstado(producto)}>
                  {producto.activo ? (
                    <PowerOff className="size-4" strokeWidth={1.75} />
                  ) : (
                    <Power className="size-4" strokeWidth={1.75} />
                  )}
                  {producto.activo ? "Desactivar" : "Activar"}
                </DropdownMenuItem>
              </Permitido>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
