"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { AppTableFeatures } from "@/components/shared/table-features";
import type { MovimientoInventario } from "@/types";
import { TIPO_MOVIMIENTO_LABEL } from "./filters-bar";

const TONO_TIPO = {
  entrada: "success",
  compra: "success",
  devolucion: "success",
  salida: "neutral",
  venta: "info",
  ajuste: "warning",
  correccion: "warning",
} as const;

export const columns: ColumnDef<AppTableFeatures, MovimientoInventario, unknown>[] = [
  {
    accessorKey: "fecha",
    header: "Fecha",
    cell: ({ row }) => (
      <span className="text-slate-500">{format(new Date(row.original.fecha), "d MMM yyyy, HH:mm", { locale: es })}</span>
    ),
  },
  {
    accessorKey: "nombreProducto",
    header: "Producto",
    cell: ({ row }) => <span className="max-w-56 truncate font-medium text-navy-900">{row.original.nombreProducto}</span>,
  },
  {
    id: "tipo",
    header: "Tipo",
    cell: ({ row }) => <Badge tone={TONO_TIPO[row.original.tipo]}>{TIPO_MOVIMIENTO_LABEL[row.original.tipo]}</Badge>,
  },
  {
    accessorKey: "cantidadAnterior",
    header: "Anterior",
    cell: ({ row }) => <span className="text-slate-500">{row.original.cantidadAnterior}</span>,
  },
  {
    accessorKey: "cantidadModificada",
    header: "Modificada",
    cell: ({ row }) => {
      const valor = row.original.cantidadModificada;
      return (
        <span className={valor >= 0 ? "font-medium text-emerald-700" : "font-medium text-danger-500"}>
          {valor >= 0 ? "+" : ""}
          {valor}
        </span>
      );
    },
  },
  {
    accessorKey: "cantidadNueva",
    header: "Nueva",
    cell: ({ row }) => <span className="font-medium text-navy-900">{row.original.cantidadNueva}</span>,
  },
  {
    accessorKey: "motivo",
    header: "Motivo",
    cell: ({ row }) => <span className="max-w-56 truncate text-slate-600">{row.original.motivo}</span>,
  },
];
