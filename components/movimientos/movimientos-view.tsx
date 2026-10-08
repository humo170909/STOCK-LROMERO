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
import { DataTable } from "@/components/shared/data-table";
import { movimientosService, type FiltrosMovimientos } from "@/services";
import type { MovimientoInventario } from "@/types";
import { FiltersBar } from "./filters-bar";
import { columns } from "./columns";

export function MovimientosView() {
  // Rango por defecto (últimos 30 días): calculado una sola vez, en el inicializador
  // perezoso de useState, nunca durante el render.
  const [filtros, setFiltros] = useState<FiltrosMovimientos>(() => ({
    fechaDesde: startOfDay(subDays(new Date(), 29)).toISOString(),
    fechaHasta: new Date().toISOString(),
  }));
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
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
        const lista = await movimientosService.listarMovimientos(filtros);
        if (vigente) setMovimientos(lista);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar los movimientos.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [filtros, refreshToken]);

  const exportar = async () => {
    setExportando(true);
    try {
      const blob = await movimientosService.exportarMovimientos(filtros);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kardex-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Kárdex exportado");
    } catch {
      toast.error("No se pudo exportar el Kárdex");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Movimientos (Kárdex)</h1>
          <p className="text-sm text-slate-500">Trazabilidad completa de entradas, salidas y ajustes de inventario.</p>
        </div>
        <Permitido modulo="movimientos" accion="exportar">
          <Button variant="outline" onClick={exportar} disabled={exportando}>
            <FileDown className="size-4" strokeWidth={1.75} />
            {exportando ? "Exportando…" : "Exportar a Excel"}
          </Button>
        </Permitido>
      </div>

      <Card className="p-4">
        <FiltersBar filtros={filtros} onChange={setFiltros} />
      </Card>

      <Card>
        {cargando ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-10" />
            ))}
          </div>
        ) : error ? (
          <ErrorState description={error} onRetry={() => setRefreshToken((t) => t + 1)} className="py-10" />
        ) : (
          <DataTable
            columns={columns}
            data={movimientos}
            pageSize={15}
            getRowId={(m) => m.id}
            emptyTitle="Sin movimientos para estos filtros"
            emptyDescription="Ajusta los filtros o el rango de fechas."
          />
        )}
      </Card>
    </div>
  );
}
