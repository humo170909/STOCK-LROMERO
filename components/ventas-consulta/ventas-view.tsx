"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { DataTable } from "@/components/shared/data-table";
import { useAppStore } from "@/store/app-store";
import { clientesService, usuariosService, ventasService, type FiltrosVentas, type VentaListado } from "@/services";
import type { Cliente, Usuario } from "@/types";
import { FiltersBar } from "./filters-bar";
import { buildColumns } from "./columns";
import { DetailPanel } from "./detail-panel";

export function VentasView() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const sedes = useAppStore((s) => s.sedes);

  useEffect(() => {
    let vigente = true;
    Promise.all([clientesService.listarClientes({ activo: "activos" }), usuariosService.listarUsuarios({ activo: "activos" })]).then(
      ([listaClientes, listaUsuarios]) => {
        if (!vigente) return;
        setClientes(listaClientes);
        setUsuarios(listaUsuarios);
      },
    );
    return () => {
      vigente = false;
    };
  }, []);

  const [filtros, setFiltros] = useState<FiltrosVentas>({});
  const [atajo, setAtajo] = useState<"hoy" | "semana" | "mes" | "todas">("todas");
  const [ventas, setVentas] = useState<VentaListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [ventaSeleccionadaId, setVentaSeleccionadaId] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const lista = await ventasService.listarVentas(filtros);
        if (vigente) setVentas(lista);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar las ventas.");
      } finally {
        if (vigente) setCargando(false);
      }
    }
    cargar();
    return () => {
      vigente = false;
    };
  }, [filtros, refreshToken]);

  const columns = buildColumns({ onVerDetalle: (venta) => setVentaSeleccionadaId(venta.id) });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">Ventas</h1>
        <p className="text-sm text-slate-500">Historial de ventas confirmadas y anuladas.</p>
      </div>

      <Card className="p-4">
        <FiltersBar
          filtros={filtros}
          clientes={clientes}
          usuarios={usuarios}
          sedes={sedes}
          atajo={atajo}
          onAtajoChange={(id, rango) => {
            setAtajo(id);
            setFiltros((f) => ({ ...f, fechaDesde: rango.desde, fechaHasta: rango.hasta }));
          }}
          onChange={setFiltros}
        />
      </Card>

      <Card>
        {cargando ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-10" />
            ))}
          </div>
        ) : error ? (
          <ErrorState description={error} onRetry={() => setRefreshToken((t) => t + 1)} className="py-10" />
        ) : (
          <DataTable
            columns={columns}
            data={ventas}
            pageSize={10}
            getRowId={(v) => v.id}
            emptyTitle="Sin ventas para estos filtros"
            emptyDescription="Ajusta los filtros o el rango de fechas."
          />
        )}
      </Card>

      <DetailPanel
        ventaId={ventaSeleccionadaId}
        onOpenChange={(open) => !open && setVentaSeleccionadaId(null)}
        onCambio={() => setRefreshToken((t) => t + 1)}
      />
    </div>
  );
}
