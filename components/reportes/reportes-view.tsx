"use client";

import { Permitido } from "@/components/shared/permitido";
import { useEffect, useState } from "react";
import { startOfDay, subDays } from "date-fns";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { cn } from "@/lib/utils";
import {
  reportesService,
  type AgrupacionCostoGanancia,
  type FiltrosReporte,
  type ReporteCompras,
  type ReporteCostoGanancia,
  type ReporteInventario,
  type ReporteVentas,
} from "@/services";
import { FiltersBar } from "./filters-bar";
import { VentasTab } from "./ventas-tab";
import { InventarioTab } from "./inventario-tab";
import { ComprasTab } from "./compras-tab";
import { CostoGananciaTab } from "./costo-ganancia-tab";

type TabId = "ventas" | "inventario" | "compras" | "costo-ganancia";

const TABS: { id: TabId; label: string }[] = [
  { id: "ventas", label: "Ventas" },
  { id: "inventario", label: "Inventario" },
  { id: "compras", label: "Compras" },
  { id: "costo-ganancia", label: "Costo y ganancia" },
];

export function ReportesView() {
  const [filtros, setFiltros] = useState<FiltrosReporte>(() => ({
    fechaDesde: startOfDay(subDays(new Date(), 29)).toISOString(),
    fechaHasta: new Date().toISOString(),
  }));
  const [tab, setTab] = useState<TabId>("ventas");
  const [agrupacion, setAgrupacion] = useState<AgrupacionCostoGanancia>("dia");

  const [ventas, setVentas] = useState<ReporteVentas | null>(null);
  const [inventario, setInventario] = useState<ReporteInventario | null>(null);
  const [compras, setCompras] = useState<ReporteCompras | null>(null);
  const [costoGanancia, setCostoGanancia] = useState<ReporteCostoGanancia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const [rVentas, rInventario, rCompras, rCostoGanancia] = await Promise.all([
          reportesService.obtenerReporteVentas(filtros),
          reportesService.obtenerReporteInventario(filtros),
          reportesService.obtenerReporteCompras(filtros),
          reportesService.obtenerReporteCostoGanancia(filtros, agrupacion),
        ]);
        if (vigente) {
          setVentas(rVentas);
          setInventario(rInventario);
          setCompras(rCompras);
          setCostoGanancia(rCostoGanancia);
        }
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudieron cargar los reportes.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [filtros, agrupacion, refreshToken]);

  const exportar = async () => {
    setExportando(true);
    try {
      const blob = await reportesService.exportarReporte(tab, filtros);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Reporte exportado");
    } catch {
      toast.error("No se pudo exportar el reporte");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Reportes</h1>
          <p className="text-sm text-slate-500">Ventas, inventario, compras y costo-ganancia en un solo lugar.</p>
        </div>
        <Permitido modulo="reportes" accion="exportar">
          <Button variant="outline" onClick={exportar} disabled={exportando}>
            <FileDown className="size-4" strokeWidth={1.75} />
            {exportando ? "Exportando…" : "Exportar a Excel"}
          </Button>
        </Permitido>
      </div>

      <Card className="p-4">
        <FiltersBar filtros={filtros} onChange={setFiltros} />
      </Card>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-medium",
              tab === t.id ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desk:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-20" />
            ))}
          </div>
          <SkeletonBlock className="h-64" />
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={() => setRefreshToken((t) => t + 1)} className="py-10" />
      ) : (
        <>
          {tab === "ventas" && ventas ? <VentasTab reporte={ventas} /> : null}
          {tab === "inventario" && inventario ? <InventarioTab reporte={inventario} /> : null}
          {tab === "compras" && compras ? <ComprasTab reporte={compras} /> : null}
          {tab === "costo-ganancia" && costoGanancia ? (
            <CostoGananciaTab reporte={costoGanancia} agrupacion={agrupacion} onAgrupacionChange={setAgrupacion} />
          ) : null}
        </>
      )}
    </div>
  );
}
