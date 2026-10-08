import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { MEDIO_PAGO_LABEL } from "@/types";
import type { TotalPorMedioPago } from "@/services";

export function MediosPagoTable({ totales }: { totales: TotalPorMedioPago[] }) {
  const ordenados = [...totales].sort((a, b) => b.monto - a.monto);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos netos por medio de pago (hoy)</CardTitle>
      </CardHeader>
      <CardContent>
        {ordenados.length === 0 ? (
          <EmptyState title="Sin movimientos todavía" className="py-6" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {ordenados.map((t) => (
              <li key={t.medioPago} className="flex items-center justify-between py-2 text-[13px] first:pt-0 last:pb-0">
                <span className="text-slate-600">{MEDIO_PAGO_LABEL[t.medioPago]}</span>
                <span className="font-medium text-navy-900"><CurrencyDisplay value={t.monto} /></span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
