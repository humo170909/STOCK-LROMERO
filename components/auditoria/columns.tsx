"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { AppTableFeatures } from "@/components/shared/table-features";
import type { RegistroAuditoriaListado } from "@/services";
import { MODULO_LABEL } from "./filters-bar";

export const columns: ColumnDef<AppTableFeatures, RegistroAuditoriaListado, unknown>[] = [
  {
    accessorKey: "fecha",
    header: "Fecha",
    cell: ({ row }) => (
      <span className="text-slate-500">{format(new Date(row.original.fecha), "d MMM yyyy, HH:mm:ss", { locale: es })}</span>
    ),
  },
  {
    accessorKey: "nombreUsuario",
    header: "Usuario",
    cell: ({ row }) => <span className="font-medium text-navy-900">{row.original.nombreUsuario}</span>,
  },
  {
    id: "modulo",
    header: "Módulo",
    cell: ({ row }) => <Badge tone="info">{MODULO_LABEL[row.original.modulo]}</Badge>,
  },
  {
    accessorKey: "accion",
    header: "Acción",
    cell: ({ row }) => <span className="max-w-96 text-slate-700">{row.original.accion}</span>,
  },
  {
    id: "resultado",
    header: "Resultado",
    cell: ({ row }) => (
      <Badge tone={row.original.resultado === "exito" ? "success" : "danger"} dot>
        {row.original.resultado === "exito" ? "Éxito" : "Error"}
      </Badge>
    ),
  },
];
