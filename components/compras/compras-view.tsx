"use client";

import { Permitido } from "@/components/shared/permitido";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { DataTable } from "@/components/shared/data-table";
import { comprasService, proveedoresService, type CompraListado, type FiltrosCompras } from "@/services";
import type { Proveedor } from "@/types";
import { FiltersBar } from "./filters-bar";
import { buildColumns } from "./columns";
import { DetailPanel } from "./detail-panel";
import { NewCompraPanel } from "./new-compra-panel";

export function ComprasView() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [filtros, setFiltros] = useState<FiltrosCompras>({});
  const [compras, setCompras] = useState<CompraListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [compraSeleccionadaId, setCompraSeleccionadaId] = useState<string | null>(null);
  const [panelNuevaAbierto, setPanelNuevaAbierto] = useState(false);

  const recargar = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const lista = await comprasService.listarCompras(filtros);
        if (vigente) setCompras(lista);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar las compras.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [filtros, refreshToken]);

  useEffect(() => {
    let vigente = true;
    proveedoresService.listarProveedores({ activo: "activos" }).then((lista) => {
      if (vigente) setProveedores(lista);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const columns = buildColumns({ onVerDetalle: (compra) => setCompraSeleccionadaId(compra.id) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Compras</h1>
          <p className="text-sm text-slate-500">Registro de compras a proveedores y su impacto en stock y costos.</p>
        </div>
        <Permitido modulo="compras" accion="crear">
          <Button onClick={() => setPanelNuevaAbierto(true)}>
            <Plus className="size-4" strokeWidth={1.75} />
            Nueva compra
          </Button>
        </Permitido>
      </div>

      <Card className="p-4">
        <FiltersBar filtros={filtros} proveedores={proveedores} onChange={setFiltros} />
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
            data={compras}
            getRowId={(c) => c.id}
            emptyTitle="Sin compras para estos filtros"
            emptyDescription="Ajusta los filtros o registra una nueva compra."
          />
        )}
      </Card>

      <DetailPanel compraId={compraSeleccionadaId} onOpenChange={(open) => !open && setCompraSeleccionadaId(null)} />
      <NewCompraPanel open={panelNuevaAbierto} onOpenChange={setPanelNuevaAbierto} onSuccess={recargar} />
    </div>
  );
}
