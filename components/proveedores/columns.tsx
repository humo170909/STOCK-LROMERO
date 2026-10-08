"use client";

import { Permitido } from "@/components/shared/permitido";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { History, MoreVertical, Pencil, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { AppTableFeatures } from "@/components/shared/table-features";
import type { ProveedorListado } from "@/services";

export function buildColumns(opts: {
  onVerHistorial: (proveedor: ProveedorListado) => void;
  onEditar: (proveedor: ProveedorListado) => void;
  onCambiarEstado: (proveedor: ProveedorListado) => void;
}): ColumnDef<AppTableFeatures, ProveedorListado, unknown>[] {
  return [
    {
      accessorKey: "razonSocial",
      header: "Proveedor",
      cell: ({ row }) => (
        <div className="max-w-56 min-w-40">
          <p className="truncate font-medium text-navy-900">{row.original.razonSocial}</p>
          <p className="text-xs text-slate-400">Doc. {row.original.documento}</p>
        </div>
      ),
    },
    {
      id: "contacto",
      header: "Contacto",
      cell: ({ row }) => (
        <div className="text-slate-500">
          <p>{row.original.contacto || "—"}</p>
          <p className="text-xs">{row.original.telefono}</p>
        </div>
      ),
    },
    {
      accessorKey: "totalComprado",
      header: "Total comprado",
      cell: ({ row }) => <span className="font-medium text-navy-900"><CurrencyDisplay value={row.original.totalComprado} /></span>,
    },
    {
      accessorKey: "numeroCompras",
      header: "N° compras",
      cell: ({ row }) => <span className="text-slate-500">{row.original.numeroCompras}</span>,
    },
    {
      accessorKey: "ultimaCompra",
      header: "Última compra",
      cell: ({ row }) =>
        row.original.ultimaCompra ? (
          <span className="text-slate-500">{format(new Date(row.original.ultimaCompra), "d MMM yyyy", { locale: es })}</span>
        ) : (
          <span className="text-slate-400">Nunca</span>
        ),
    },
    {
      accessorKey: "activo",
      header: "Estado",
      cell: ({ row }) => (
        <Badge tone={row.original.activo ? "info" : "neutral"}>{row.original.activo ? "Activo" : "Inactivo"}</Badge>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const proveedor = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Acciones para ${proveedor.razonSocial}`}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => opts.onVerHistorial(proveedor)}>
                <History className="size-4" strokeWidth={1.75} />
                Historial de compras
              </DropdownMenuItem>
              <Permitido modulo="proveedores" accion="editar">
                <DropdownMenuItem onSelect={() => opts.onEditar(proveedor)}>
                  <Pencil className="size-4" strokeWidth={1.75} />
                  Editar
                </DropdownMenuItem>
              </Permitido>
              <Permitido modulo="proveedores" accion="editar">
                <DropdownMenuItem onSelect={() => opts.onCambiarEstado(proveedor)}>
                  {proveedor.activo ? <PowerOff className="size-4" strokeWidth={1.75} /> : <Power className="size-4" strokeWidth={1.75} />}
                  {proveedor.activo ? "Desactivar" : "Activar"}
                </DropdownMenuItem>
              </Permitido>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
