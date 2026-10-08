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
import { useAppStore } from "@/store/app-store";
import { trabajadoresService, type FiltrosTrabajadores } from "@/services";
import type { Trabajador } from "@/types";
import { FiltersBar } from "./filters-bar";
import { buildColumns } from "./columns";
import { TrabajadorFormPanel } from "./trabajador-form-panel";

export function TrabajadoresView() {
  const sedes = useAppStore((s) => s.sedes);
  const [filtros, setFiltros] = useState<FiltrosTrabajadores>({ activo: "activos" });
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [panelFormAbierto, setPanelFormAbierto] = useState(false);
  const [trabajadorEdicion, setTrabajadorEdicion] = useState<Trabajador | null>(null);
  const [trabajadorCambioEstado, setTrabajadorCambioEstado] = useState<Trabajador | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const recargar = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const lista = await trabajadoresService.listarTrabajadores(filtros);
        if (vigente) setTrabajadores(lista);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar los trabajadores.");
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
    if (!trabajadorCambioEstado) return;
    setCambiandoEstado(true);
    try {
      await trabajadoresService.cambiarEstado(trabajadorCambioEstado.id, !trabajadorCambioEstado.activo);
      toast.success(trabajadorCambioEstado.activo ? "Trabajador desactivado" : "Trabajador activado", {
        description: trabajadorCambioEstado.nombre,
      });
      setTrabajadorCambioEstado(null);
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
    sedes,
    onEditar: (trabajador) => {
      setTrabajadorEdicion(trabajador);
      setPanelFormAbierto(true);
    },
    onCambiarEstado: setTrabajadorCambioEstado,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Trabajadores</h1>
          <p className="text-sm text-slate-500">Directorio de personal por sede.</p>
        </div>
        <Permitido modulo="trabajadores" accion="crear">
          <Button
            onClick={() => {
              setTrabajadorEdicion(null);
              setPanelFormAbierto(true);
            }}
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Nuevo trabajador
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
            data={trabajadores}
            getRowId={(t) => t.id}
            emptyTitle="Sin trabajadores para estos filtros"
            emptyDescription="Ajusta los filtros o registra un nuevo trabajador."
          />
        )}
      </Card>

      <TrabajadorFormPanel
        open={panelFormAbierto}
        trabajador={trabajadorEdicion}
        onOpenChange={setPanelFormAbierto}
        onSuccess={recargar}
      />

      <ConfirmDialog
        open={!!trabajadorCambioEstado}
        onOpenChange={(open) => !open && setTrabajadorCambioEstado(null)}
        title={trabajadorCambioEstado?.activo ? "¿Desactivar trabajador?" : "¿Activar trabajador?"}
        description={
          trabajadorCambioEstado?.activo
            ? `${trabajadorCambioEstado?.nombre} quedará marcado como inactivo.`
            : `${trabajadorCambioEstado?.nombre} volverá a estar activo.`
        }
        confirmLabel={trabajadorCambioEstado?.activo ? "Desactivar" : "Activar"}
        tone={trabajadorCambioEstado?.activo ? "danger" : "default"}
        loading={cambiandoEstado}
        onConfirm={confirmarCambioEstado}
      />
    </div>
  );
}
