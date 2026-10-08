import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CajaStatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Separator } from "@/components/ui/separator";
import type { DashboardData } from "@/services/dashboard.types";

export function CashSummary({ data }: { data: DashboardData }) {
  const { estadoCaja, kpis } = data;
  const totalIngresado = estadoCaja.montoApertura; // la apertura ya está contabilizada en el resumen del día

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de caja y resumen del período</CardTitle>
        <CajaStatusBadge estado={estadoCaja.estado} />
      </CardHeader>
      <CardContent className="space-y-3">
      <p className="text-xs text-slate-500">
          {estadoCaja.abiertaEn ? (
            <>
              Abierta a las {format(new Date(estadoCaja.abiertaEn), "HH:mm", { locale: es })} con{" "}
              <CurrencyDisplay value={totalIngresado} className="font-medium text-slate-700" /> de monto inicial.
            </>
          ) : (
            "No hay una caja abierta en este momento."
          )}
        </p>
        <Separator />
        <dl className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Ventas ({data.etiquetaPeriodo})</dt>
            <dd className="font-medium text-navy-900"><CurrencyDisplay value={kpis.totalVentas} /></dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Costo de productos vendidos</dt>
            <dd className="font-medium text-navy-900"><CurrencyDisplay value={kpis.costoVentas} /></dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Ganancia bruta</dt>
            <dd className="font-medium text-emerald-700"><CurrencyDisplay value={kpis.gananciaBruta} /></dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
