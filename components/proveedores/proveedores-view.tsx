"use client";

import { Permitido } from "@/components/shared/permitido";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { proveedoresService, type FiltrosProveedores, type ProveedorListado } from "@/services";
import { FiltersBar } from "./filters-bar";
import { buildColumns } from "./columns";
import { ProviderFormPanel } from "./provider-form-panel";
import { HistorialPanel } from "./historial-panel";

export function ProveedoresView() {
  const [filtros, setFiltros] = useState<FiltrosProveedores>({ activo: "activos" });
  const [proveedores, setProveedores] = useState<ProveedorListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [proveedorHistorial, setProveedorHistorial] = useState<ProveedorListado | null>(null);
  const [panelFormAbierto, setPanelFormAbierto] = useState(false);
  const [proveedorEdicion, setProveedorEdicion] = useState<ProveedorListado | null>(null);
  const [proveedorCambioEstado, setProveedorCambioEstado] = useState<ProveedorListado | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const recargar = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const lista = await proveedoresService.listarProveedores(filtros);
        if (vigente) setProveedores(lista);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar los proveedores.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [filtros, refreshToken]);

  const confirmarCambioEstado = async () => {
    if (!proveedorCambioEstado) return;
    setCambiandoEstado(true);
    try {
      await proveedoresService.cambiarEstado(proveedorCambioEstado.id, !proveedorCambioEstado.activo);
      toast.success(proveedorCambioEstado.activo ? "Proveedor desactivado" : "Proveedor activado", {
        description: proveedorCambioEstado.razonSocial,
      });
      setProveedorCambioEstado(null);
      recargar();
    } catch (err) {
      toast.error("No se pudo actualizar el estado", {
        description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
      });
    } finally {
      setCambiandoEstado(false);
    }
  };

  const columns = buildColumns({
    onVerHistorial: setProveedorHistorial,
    onEditar: (proveedor) => {
      setProveedorEdicion(proveedor);
      setPanelFormAbierto(true);
    },
    onCambiarEstado: setProveedorCambioEstado,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Proveedores</h1>
          <p className="text-sm text-slate-500">Directorio de proveedores e historial de compras.</p>
        </div>
        <Permitido modulo="proveedores" accion="crear">
          <Button
            onClick={() => {
              setProveedorEdicion(null);
              setPanelFormAbierto(true);
            }}
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Nuevo proveedor
          </Button>
        </Permitido>
      </div>

      <Card className="p-4">
        <FiltersBar filtros={filtros} onChange={setFiltros} />
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
            data={proveedores}
            getRowId={(p) => p.id}
            emptyTitle="Sin proveedores para estos filtros"
            emptyDescription="Ajusta los filtros o registra un nuevo proveedor."
          />
        )}
      </Card>

      <HistorialPanel proveedor={proveedorHistorial} onOpenChange={(open) => !open && setProveedorHistorial(null)} />

      <ProviderFormPanel
        open={panelFormAbierto}
        proveedor={proveedorEdicion}
        onOpenChange={setPanelFormAbierto}
        onSuccess={recargar}
      />

      <ConfirmDialog
        open={!!proveedorCambioEstado}
        onOpenChange={(open) => !open && setProveedorCambioEstado(null)}
        title={proveedorCambioEstado?.activo ? "¿Desactivar proveedor?" : "¿Activar proveedor?"}
        description={
          proveedorCambioEstado?.activo
            ? `${proveedorCambioEstado?.razonSocial} dejará de aparecer para seleccionarlo en Nueva compra.`
            : `${proveedorCambioEstado?.razonSocial} volverá a estar disponible para comprar.`
        }
        confirmLabel={proveedorCambioEstado?.activo ? "Desactivar" : "Activar"}
        tone={proveedorCambioEstado?.activo ? "danger" : "default"}
        loading={cambiandoEstado}
        onConfirm={confirmarCambioEstado}
      />
    </div>
  );
}
