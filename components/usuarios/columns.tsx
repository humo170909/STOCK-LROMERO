"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreVertical, Pencil, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RolBadge } from "@/components/shared/status-badge";
import type { AppTableFeatures } from "@/components/shared/table-features";
import type { Trabajador, Usuario } from "@/types";

export function buildColumns(opts: {
  trabajadores: Trabajador[];
  onEditar: (usuario: Usuario) => void;
  onCambiarEstado: (usuario: Usuario) => void;
}): ColumnDef<AppTableFeatures, Usuario, unknown>[] {
  const nombreTrabajador = (id?: string) => opts.trabajadores.find((t) => t.id === id)?.nombre ?? "—";

  return [
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: ({ row }) => (
        <div className="max-w-52 min-w-36">
          <p className="truncate font-medium text-navy-900">{row.original.nombre}</p>
          {row.original.usuario ? <p className="text-xs text-slate-400">@{row.original.usuario}</p> : null}
        </div>
      ),
    },
    {
      id: "rol",
      header: "Rol",
      cell: ({ row }) => <RolBadge rol={row.original.rol} />,
    },
    {
      id: "trabajador",
      header: "Trabajador vinculado",
      cell: ({ row }) => <span className="text-slate-500">{nombreTrabajador(row.original.trabajadorId)}</span>,
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
        const usuario = row.original;
        const esAdmin = usuario.rol === "administrador";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Acciones para ${usuario.nombre}`}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => opts.onEditar(usuario)}>
                <Pencil className="size-4" strokeWidth={1.75} />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem disabled={esAdmin} onSelect={() => opts.onCambiarEstado(usuario)}>
                {usuario.activo ? <PowerOff className="size-4" strokeWidth={1.75} /> : <Power className="size-4" strokeWidth={1.75} />}
                {usuario.activo ? "Desactivar" : "Activar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
