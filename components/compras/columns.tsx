"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { AppTableFeatures } from "@/components/shared/table-features";
import type { CompraListado } from "@/services";

export function buildColumns(opts: { onVerDetalle: (compra: CompraListado) => void }): ColumnDef<AppTableFeatures, CompraListado, unknown>[] {
  return [
    {
      accessorKey: "numeroDocumento",
      header: "Documento",
      cell: ({ row }) => <span className="font-medium text-navy-900">{row.original.numeroDocumento}</span>,
    },
    {
      accessorKey: "fecha",
      header: "Fecha",
      cell: ({ row }) => (
        <span className="text-slate-500">{format(new Date(row.original.fecha), "d MMM yyyy", { locale: es })}</span>
      ),
    },
    {
      accessorKey: "nombreProveedor",
      header: "Proveedor",
      cell: ({ row }) => <span className="max-w-56 truncate text-slate-700">{row.original.nombreProveedor}</span>,
    },
    {
      accessorKey: "subtotal",
      header: "Subtotal",
      cell: ({ row }) => <span className="text-slate-500"><CurrencyDisplay value={row.original.subtotal} /></span>,
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => <span className="font-medium text-navy-900"><CurrencyDisplay value={row.original.total} /></span>,
    },
    {
      id: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <Badge tone={row.original.estado === "registrada" ? "success" : "danger"} dot>
          {row.original.estado === "registrada" ? "Registrada" : "Anulada"}
        </Badge>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <button
          type="button"
          aria-label={`Ver detalle de ${row.original.numeroDocumento}`}
          onClick={() => opts.onVerDetalle(row.original)}
          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600"
        >
          <Eye className="size-4" strokeWidth={1.75} />
        </button>
      ),
    },
  ];
}
