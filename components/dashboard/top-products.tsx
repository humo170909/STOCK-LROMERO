import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/components/shared/currency-display";
import type { DashboardData } from "@/services/dashboard.types";

export function TopProducts({ data }: { data: DashboardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos más vendidos</CardTitle>
      </CardHeader>
      <CardContent>
        {data.productosMasVendidos.length === 0 ? (
          <EmptyState title="Sin productos vendidos en este periodo" className="py-6" />
        ) : (
          <ul role="list" className="divide-y divide-slate-100">
            {data.productosMasVendidos.map((item, index) => (
              <li key={item.producto.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-50 text-[11px] font-semibold text-brand-600">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-navy-900">{item.producto.nombre}</p>
                  <p className="text-xs text-slate-500">{item.producto.sku}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-semibold text-navy-900">{formatCurrency(item.monto)}</p>
                  <p className="text-xs text-slate-500">{item.cantidad} uds.</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
