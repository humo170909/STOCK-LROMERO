"use client";

import { useState } from "react";
import { type ColumnDef, type PaginationState, type SortingState, useTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { appTableFeatures, type AppTableFeatures } from "./table-features";

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  pageSize = 10,
  emptyTitle = "Sin resultados",
  emptyDescription,
  getRowId,
}: {
  columns: ColumnDef<AppTableFeatures, T, unknown>[];
  data: T[];
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  getRowId?: (row: T) => string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });

  const table = useTable({
    features: appTableFeatures,
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} className="px-5 py-10" />;
  }

  const paginaActual = pagination.pageIndex + 1;
  const totalPaginas = table.getPageCount();

  return (
    <div>
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-blue-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
                {headerGroup.headers.map((header) => {
                  const ordenable = header.column.getCanSort();
                  const direccion = header.column.getIsSorted();
                  return (
                    <th key={header.id} className="whitespace-nowrap px-4 py-2.5 first:pl-5 last:pr-5">
                      {header.isPlaceholder ? null : ordenable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-navy-900"
                        >
                          <table.FlexRender header={header} />
                          {direccion === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : direccion === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/80">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-4 py-2.5 first:pl-5 last:pr-5">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 ? (
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-500">
            Página {paginaActual} de {totalPaginas} · {data.length} registros
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Página anterior"
              className={cn(
                "grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100",
                !table.getCanPreviousPage() && "pointer-events-none opacity-40",
              )}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Página siguiente"
              className={cn(
                "grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100",
                !table.getCanNextPage() && "pointer-events-none opacity-40",
              )}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
