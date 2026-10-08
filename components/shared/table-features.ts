// TanStack Table v9: las features se registran explícitamente (no vienen todas por defecto
// como en v8). Este archivo es el único lugar donde se arma el set de features que usa
// toda la app, para que DataTable y cada columns.tsx compartan el mismo TFeatures.
import {
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

export const appTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

export type AppTableFeatures = typeof appTableFeatures;
