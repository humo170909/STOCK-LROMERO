"use client";

import { useEffect, useState } from "react";
import { subDays } from "date-fns";
import { useQueryState } from "nuqs";
import { dashboardService, type DashboardData, type PeriodoDashboardId, type RangoFechas } from "@/services";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Permitido } from "@/components/shared/permitido";
import { PeriodSelector } from "./period-selector";
import { KpiRow } from "./kpi-row";
import { SecondaryStats } from "./secondary-stats";
import { SalesProfitChart } from "./sales-profit-chart";
import { PaymentMethodBreakdown } from "./payment-method-breakdown";
import { TopProducts } from "./top-products";
import { CriticalStock } from "./critical-stock";
import { RecentSales } from "./recent-sales";
import { RecentActivity } from "./recent-activity";
import { CashSummary } from "./cash-summary";

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desk:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <SkeletonBlock className="h-64" />
      <div className="grid grid-cols-1 gap-4 desk:grid-cols-2">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>
    </div>
  );
}

export function DashboardView() {
  const [periodo, setPeriodo] = useQueryState<PeriodoDashboardId>("periodo", {
    defaultValue: "hoy",
    parse: (v) => (["hoy", "ayer", "7d", "30d", "mes", "personalizado"].includes(v) ? (v as PeriodoDashboardId) : null),
  });
  const [rango, setRango] = useState<RangoFechas>({ desde: subDays(new Date(), 6), hasta: new Date() });
  const [data, setData] = useState<DashboardData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const resultado = await dashboardService.obtenerDashboard(
          periodo === "personalizado" ? { id: periodo, rango } : { id: periodo },
        );
        if (vigente) setData(resultado);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar el Dashboard.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [periodo, rango, reintento]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Resumen operativo de Grupo LRomero Importaciones.</p>
        </div>
        <PeriodSelector periodo={periodo} rango={rango} onPeriodoChange={setPeriodo} onRangoChange={setRango} />
      </div>

      {cargando ? (
        <DashboardSkeleton />
      ) : error ? (
        <ErrorState description={error} onRetry={() => setReintento((n) => n + 1)} />
      ) : data ? (
        <>
          <KpiRow data={data} />
          <SecondaryStats data={data} />
          <div className="grid grid-cols-1 gap-4 desk:grid-cols-[2fr_1fr]">
            <SalesProfitChart serie={data.serieVentas} />
            <PaymentMethodBreakdown data={data} />
          </div>
          <div className="grid grid-cols-1 gap-4 desk:grid-cols-3">
            <TopProducts data={data} />
            <CriticalStock data={data} />
            <Permitido modulo="auditoria">
              <RecentActivity data={data} />
            </Permitido>
          </div>
          <RecentSales data={data} />
          <CashSummary data={data} />
        </>
      ) : null}
    </div>
  );
}
