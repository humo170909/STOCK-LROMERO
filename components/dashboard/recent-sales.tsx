import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { VentaStatusBadge } from "@/components/shared/status-badge";
import { MEDIO_PAGO_VENTA_LABEL } from "@/types";
import type { DashboardData } from "@/services/dashboard.types";

export function RecentSales({ data }: { data: DashboardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimas ventas</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {data.ultimasVentas.length === 0 ? (
          <EmptyState title="Todavía no hay ventas registradas" className="px-5 py-6" />
        ) : (
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="bg-blue-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5">Nota de venta</th>
                  <th className="px-3 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Medio</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-5 py-2.5 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.ultimasVentas.map((venta) => (
                  <tr key={venta.id}>
                    <td className="px-5 py-2.5 font-medium text-navy-900">{venta.numero}</td>
                    <td className="max-w-40 truncate px-3 py-2.5 text-slate-600">{venta.nombreCliente}</td>
                    <td className="px-3 py-2.5 text-slate-600">{MEDIO_PAGO_VENTA_LABEL[venta.medioPago]}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-navy-900">
                      <CurrencyDisplay value={venta.total} />
                    </td>
                    <td className="px-3 py-2.5">
                      <VentaStatusBadge estado={venta.estado} />
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-500">
                      {format(new Date(venta.fecha), "d MMM, HH:mm", { locale: es })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
