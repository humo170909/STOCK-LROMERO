"use client";

import { Permitido } from "@/components/shared/permitido";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, FolderOpen, MoreVertical, Pencil, PowerOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { RiesgoBadge } from "@/components/shared/status-badge";
import type { AppTableFeatures } from "@/components/shared/table-features";
import type { ClienteListado } from "@/services";

export function buildColumns(opts: {
  onVerExpediente: (cliente: ClienteListado) => void;
  onEditar: (cliente: ClienteListado) => void;
  onCambiarEstado: (cliente: ClienteListado) => void;
  onEliminar: (cliente: ClienteListado) => void;
}): ColumnDef<AppTableFeatures, ClienteListado, unknown>[] {
  return [
    {
      accessorKey: "nombre",
      header: "Cliente",
      cell: ({ row }) => (
        <div className="max-w-56 min-w-40">
          <p className="truncate font-medium text-navy-900">{row.original.nombre}</p>
          <p className="text-xs text-slate-400">
            {row.original.documento}
          </p>
        </div>
      ),
    },
    {
      id: "contacto",
      header: "Contacto",
      cell: ({ row }) => (
        <div className="text-slate-500">
          <p>{row.original.telefono || "—"}</p>
          <p className="truncate text-xs">{row.original.correo || "—"}</p>
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
      id: "riesgo",
      header: "Riesgo",
      cell: ({ row }) => <RiesgoBadge riesgo={row.original.riesgo} />,
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
        const cliente = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Acciones para ${cliente.nombre}`}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => opts.onVerExpediente(cliente)}>
                <FolderOpen className="size-4" strokeWidth={1.75} />
                Ver expediente
              </DropdownMenuItem>
              <Permitido modulo="clientes" accion="editar">
                <DropdownMenuItem onSelect={() => opts.onEditar(cliente)}>
                  <Pencil className="size-4" strokeWidth={1.75} />
                  Editar
                </DropdownMenuItem>
              </Permitido>
              <Permitido modulo="clientes" accion="editar">
                <DropdownMenuItem onSelect={() => opts.onCambiarEstado(cliente)}>
                  {cliente.activo ? <PowerOff className="size-4" strokeWidth={1.75} /> : <Ban className="size-4" strokeWidth={1.75} />}
                  {cliente.activo ? "Desactivar" : "Activar"}
                </DropdownMenuItem>
              </Permitido>
              <Permitido modulo="clientes" accion="eliminar">
                <DropdownMenuItem onSelect={() => opts.onEliminar(cliente)}>
                  <Trash2 className="size-4" strokeWidth={1.75} />
                  Eliminar
                </DropdownMenuItem>
              </Permitido>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
