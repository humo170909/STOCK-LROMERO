"use client";

import { Permitido } from "@/components/shared/permitido";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreVertical, Pencil, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppTableFeatures } from "@/components/shared/table-features";
import type { Sede, Trabajador } from "@/types";

export function buildColumns(opts: {
  sedes: Sede[];
  onEditar: (trabajador: Trabajador) => void;
  onCambiarEstado: (trabajador: Trabajador) => void;
}): ColumnDef<AppTableFeatures, Trabajador, unknown>[] {
  const nombreSede = (sedeId: string) => opts.sedes.find((s) => s.id === sedeId)?.nombre ?? "—";

  return [
    {
      accessorKey: "nombre",
      header: "Trabajador",
      cell: ({ row }) => (
        <div className="max-w-52 min-w-40">
          <p className="truncate font-medium text-navy-900">{row.original.nombre}</p>
          <p className="text-xs text-slate-400">DNI {row.original.documento}</p>
        </div>
      ),
    },
    {
      accessorKey: "cargo",
      header: "Cargo",
      cell: ({ row }) => <span className="text-slate-600">{row.original.cargo}</span>,
    },
    {
      accessorKey: "telefono",
      header: "Teléfono",
      cell: ({ row }) => <span className="text-slate-500">{row.original.telefono}</span>,
    },
    {
      id: "sede",
      header: "Sede",
      cell: ({ row }) => <span className="text-slate-500">{nombreSede(row.original.sedeId)}</span>,
    },
    {
      accessorKey: "ingresadoEn",
      header: "Ingreso",
      cell: ({ row }) => (
        <span className="text-slate-500">{format(parseISO(row.original.ingresadoEn), "d MMM yyyy", { locale: es })}</span>
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
        const trabajador = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Acciones para ${trabajador.nombre}`}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Permitido modulo="trabajadores" accion="editar">
                <DropdownMenuItem onSelect={() => opts.onEditar(trabajador)}>
                  <Pencil className="size-4" strokeWidth={1.75} />
                  Editar
                </DropdownMenuItem>
              </Permitido>
              <Permitido modulo="trabajadores" accion="editar">
                <DropdownMenuItem onSelect={() => opts.onCambiarEstado(trabajador)}>
                  {trabajador.activo ? <PowerOff className="size-4" strokeWidth={1.75} /> : <Power className="size-4" strokeWidth={1.75} />}
                  {trabajador.activo ? "Desactivar" : "Activar"}
                </DropdownMenuItem>
              </Permitido>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
