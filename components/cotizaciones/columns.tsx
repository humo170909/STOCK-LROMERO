"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { CotizacionStatusBadge } from "@/components/shared/status-badge";
import type { AppTableFeatures } from "@/components/shared/table-features";
import type { CotizacionListado } from "@/services";

export function buildColumns(opts: {
  onVerDetalle: (cotizacion: CotizacionListado) => void;
}): ColumnDef<AppTableFeatures, CotizacionListado, unknown>[] {
  return [
    {
      accessorKey: "numero",
      header: "N°",
      cell: ({ row }) => <span className="font-medium text-navy-900">{row.original.numero}</span>,
    },
    {
      accessorKey: "nombreCliente",
      header: "Cliente",
      cell: ({ row }) => <span className="max-w-48 truncate text-slate-700">{row.original.nombreCliente}</span>,
    },
    {
      accessorKey: "fechaEmision",
      header: "Emisión",
      cell: ({ row }) => (
        <span className="text-slate-500">{format(new Date(row.original.fechaEmision), "d MMM yyyy", { locale: es })}</span>
      ),
    },
    {
      accessorKey: "fechaVencimiento",
      header: "Vencimiento",
      cell: ({ row }) => (
        <span className="text-slate-500">{format(new Date(row.original.fechaVencimiento), "d MMM yyyy", { locale: es })}</span>
      ),
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => <span className="font-medium text-navy-900"><CurrencyDisplay value={row.original.total} /></span>,
    },
    {
      id: "estado",
      header: "Estado",
      cell: ({ row }) => <CotizacionStatusBadge estado={row.original.estado} />,
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <button
          type="button"
          aria-label={`Ver detalle de ${row.original.numero}`}
          onClick={() => opts.onVerDetalle(row.original)}
          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600"
        >
          <Eye className="size-4" strokeWidth={1.75} />
        </button>
      ),
    },
  ];
}
