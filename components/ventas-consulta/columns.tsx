"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { VentaStatusBadge } from "@/components/shared/status-badge";
import type { AppTableFeatures } from "@/components/shared/table-features";
import { MEDIO_PAGO_VENTA_LABEL } from "@/types";
import type { VentaListado } from "@/services";

export function buildColumns(opts: {
  onVerDetalle: (venta: VentaListado) => void;
}): ColumnDef<AppTableFeatures, VentaListado, unknown>[] {
  return [
    {
      accessorKey: "numero",
      header: "Nota de venta",
      cell: ({ row }) => <span className="font-medium text-navy-900">{row.original.numero}</span>,
    },
    {
      accessorKey: "fecha",
      header: "Fecha",
      cell: ({ row }) => (
        <span className="text-slate-500">{format(new Date(row.original.fecha), "d MMM yyyy, HH:mm", { locale: es })}</span>
      ),
    },
    {
      accessorKey: "nombreCliente",
      header: "Cliente",
      cell: ({ row }) => <span className="max-w-44 truncate text-slate-700">{row.original.nombreCliente}</span>,
    },
    {
      accessorKey: "nombreUsuario",
      header: "Usuario",
      cell: ({ row }) => <span className="text-slate-500">{row.original.nombreUsuario}</span>,
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => <span className="font-medium text-navy-900"><CurrencyDisplay value={row.original.total} /></span>,
    },
    {
      accessorKey: "gananciaTotal",
      header: "Ganancia",
      cell: ({ row }) => <span className="text-emerald-700"><CurrencyDisplay value={row.original.gananciaTotal} /></span>,
    },
    {
      accessorKey: "medioPago",
      header: "Medio",
      cell: ({ row }) => <span className="text-slate-500">{MEDIO_PAGO_VENTA_LABEL[row.original.medioPago]}</span>,
    },
    {
      id: "estado",
      header: "Estado",
      cell: ({ row }) => <VentaStatusBadge estado={row.original.estado} />,
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
