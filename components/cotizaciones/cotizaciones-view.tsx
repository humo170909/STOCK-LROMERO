"use client";

import { Permitido } from "@/components/shared/permitido";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { DataTable } from "@/components/shared/data-table";
import { clientesService, cotizacionesService, type CotizacionListado, type FiltrosCotizaciones } from "@/services";
import type { Cliente } from "@/types";
import { FiltersBar } from "./filters-bar";
import { buildColumns } from "./columns";
import { DetailPanel } from "./detail-panel";
import { NewCotizacionPanel } from "./new-cotizacion-panel";
import { CreatedDialog, type CotizacionCreada } from "./created-dialog";

export function CotizacionesView() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtros, setFiltros] = useState<FiltrosCotizaciones>({});
  const [cotizaciones, setCotizaciones] = useState<CotizacionListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [cotizacionSeleccionadaId, setCotizacionSeleccionadaId] = useState<string | null>(null);
  const [panelNuevaAbierto, setPanelNuevaAbierto] = useState(false);
  const [cotizacionCreada, setCotizacionCreada] = useState<CotizacionCreada | null>(null);

  const recargar = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    let vigente = true;
    clientesService.listarClientes({ activo: "activos" }).then((lista) => {
      if (vigente) setClientes(lista);
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const lista = await cotizacionesService.listarCotizaciones(filtros);
        if (vigente) setCotizaciones(lista);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar las cotizaciones.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [filtros, refreshToken]);

  const columns = buildColumns({ onVerDetalle: (cotizacion) => setCotizacionSeleccionadaId(cotizacion.id) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Cotizaciones</h1>
          <p className="text-sm text-slate-500">Crea, da seguimiento y convierte cotizaciones en ventas.</p>
        </div>
        <Permitido modulo="cotizaciones" accion="crear">
          <Button onClick={() => setPanelNuevaAbierto(true)}>
            <Plus className="size-4" strokeWidth={1.75} />
            Nueva cotización
          </Button>
        </Permitido>
      </div>

      <Card className="p-4">
        <FiltersBar filtros={filtros} clientes={clientes} onChange={setFiltros} />
      </Card>

      <Card>
        {cargando ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-10" />
            ))}
          </div>
        ) : error ? (
          <ErrorState description={error} onRetry={recargar} className="py-10" />
        ) : (
          <DataTable
            columns={columns}
            data={cotizaciones}
            getRowId={(c) => c.id}
            emptyTitle="Sin cotizaciones para estos filtros"
            emptyDescription="Ajusta los filtros o crea una nueva cotización."
          />
        )}
      </Card>

      <DetailPanel
        cotizacionId={cotizacionSeleccionadaId}
        onOpenChange={(open) => !open && setCotizacionSeleccionadaId(null)}
        onCambio={recargar}
      />
      <NewCotizacionPanel
        open={panelNuevaAbierto}
        onOpenChange={setPanelNuevaAbierto}
        onSuccess={(cotizacion, nombreCliente) => {
          recargar();
          setCotizacionCreada({ cotizacion, nombreCliente });
        }}
      />
      <CreatedDialog
        creada={cotizacionCreada}
        onVerCotizacion={(id) => {
          setCotizacionCreada(null);
          setCotizacionSeleccionadaId(id);
        }}
        onClose={() => setCotizacionCreada(null)}
      />
    </div>
  );
}
