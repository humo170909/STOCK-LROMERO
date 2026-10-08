"use client";

import { useEffect, useState } from "react";
import { startOfDay, subDays } from "date-fns";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { DataTable } from "@/components/shared/data-table";
import { Card } from "@/components/ui/card";
import { auditoriaService, type FiltrosAuditoria, type RegistroAuditoriaListado } from "@/services";
import { FiltersBar } from "./filters-bar";
import { columns } from "./columns";

export function AuditoriaView() {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(() => ({
    fechaDesde: startOfDay(subDays(new Date(), 29)).toISOString(),
    fechaHasta: new Date().toISOString(),
  }));
  const [registros, setRegistros] = useState<RegistroAuditoriaListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const lista = await auditoriaService.listarRegistros(filtros);
        if (vigente) setRegistros(lista);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar la auditoría.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [filtros, refreshToken]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">Auditoría</h1>
        <p className="text-sm text-slate-500">Registro de solo lectura de toda la actividad del sistema.</p>
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
            data={registros}
            pageSize={15}
            getRowId={(r) => r.id}
            emptyTitle="Sin registros para estos filtros"
            emptyDescription="Ajusta los filtros o el rango de fechas."
          />
        )}
      </Card>
    </div>
  );
}
