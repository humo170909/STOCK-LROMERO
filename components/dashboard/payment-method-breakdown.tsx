import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/components/shared/currency-display";
import { MEDIO_PAGO_LABEL } from "@/types";
import type { DashboardData } from "@/services/dashboard.types";

const COLORES = ["#082a66", "#1558c0", "#2a6bd4", "#9cc7ff", "#bcd3fb", "#dbe7ff"];

export function PaymentMethodBreakdown({ data }: { data: DashboardData }) {
  const total = data.ventasPorMedioPago.reduce((acc, v) => acc + v.monto, 0);
  const ordenado = [...data.ventasPorMedioPago].sort((a, b) => b.monto - a.monto);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas por medio de pago</CardTitle>
      </CardHeader>
      <CardContent>
        {ordenado.length === 0 ? (
          <EmptyState title="Sin ventas en este periodo" className="py-6" />
        ) : (
          <ul role="list" className="space-y-3">
            {ordenado.map((item, index) => {
              const pct = total > 0 ? Math.round((item.monto / total) * 100) : 0;
              return (
                <li key={item.medioPago}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="font-medium text-slate-700">{MEDIO_PAGO_LABEL[item.medioPago]}</span>
                    <span className="text-slate-500">
                      {formatCurrency(item.monto)} <span className="text-slate-400">· {pct}%</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: COLORES[index % COLORES.length] }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
