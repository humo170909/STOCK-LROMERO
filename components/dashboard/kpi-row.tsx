import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Coins, Package, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cn } from "@/lib/utils";
import type { ComparacionValor, DashboardData } from "@/services/dashboard.types";

function TrendBadge({ comparacion }: { comparacion: ComparacionValor }) {
  if (comparacion.variacionPct === null) return null;
  const subio = comparacion.variacionPct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        subio ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-danger-500",
      )}
    >
      {subio ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(comparacion.variacionPct)}%
    </span>
  );
}

function KpiCard({
  titulo,
  valor,
  icon: Icon,
  comparacion,
}: {
  titulo: string;
  valor: React.ReactNode;
  icon: LucideIcon;
  comparacion?: ComparacionValor;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-500">{titulo}</p>
        <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-brand-600">
          <Icon aria-hidden className="size-4" strokeWidth={1.75} />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-display text-2xl font-semibold tracking-tight text-navy-900">{valor}</p>
        {comparacion ? <TrendBadge comparacion={comparacion} /> : null}
      </div>
    </Card>
  );
}

export function KpiRow({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desk:grid-cols-4">
      <KpiCard
        titulo={`Ventas · ${data.etiquetaPeriodo}`}
        valor={<CurrencyDisplay value={data.kpis.totalVentas} />}
        icon={TrendingUp}
        comparacion={data.comparacionPeriodoAnterior.ventas}
      />
      <KpiCard
        titulo={`Ganancia bruta · ${data.etiquetaPeriodo}`}
        valor={<CurrencyDisplay value={data.kpis.gananciaBruta} />}
        icon={Coins}
        comparacion={data.comparacionPeriodoAnterior.ganancia}
      />
      <KpiCard
        titulo="Costo de ventas"
        valor={<CurrencyDisplay value={data.kpis.costoVentas} />}
        icon={Wallet}
      />
      <KpiCard
        titulo="Productos vendidos"
        valor={data.kpis.productosVendidos.toLocaleString("es-PE")}
        icon={Package}
      />
    </div>
  );
}
