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
import { clientesService, type ClienteListado, type FiltrosClientes } from "@/services";
import { FiltersBar } from "./filters-bar";
import { buildColumns } from "./columns";
import { ClientFormPanel } from "./client-form-panel";
import { DossierPanel } from "./dossier-panel";

export function ClientesView() {
  const [filtros, setFiltros] = useState<FiltrosClientes>({ activo: "activos" });
  const [clientes, setClientes] = useState<ClienteListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [expedienteId, setExpedienteId] = useState<string | null>(null);
  const [panelFormAbierto, setPanelFormAbierto] = useState(false);
  const [clienteEdicion, setClienteEdicion] = useState<ClienteListado | null>(null);
  const [clienteCambioEstado, setClienteCambioEstado] = useState<ClienteListado | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const [clienteEliminar, setClienteEliminar] = useState<ClienteListado | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const recargar = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const lista = await clientesService.listarClientes(filtros);
        if (vigente) setClientes(lista);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar los clientes.");
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
    if (!clienteCambioEstado) return;
    setCambiandoEstado(true);
    try {
      await clientesService.cambiarEstado(clienteCambioEstado.id, !clienteCambioEstado.activo);
      toast.success(clienteCambioEstado.activo ? "Cliente desactivado" : "Cliente activado", {
        description: clienteCambioEstado.nombre,
      });
      setClienteCambioEstado(null);
      recargar();
    } catch (err) {
      toast.error("No se pudo actualizar el estado", {
        description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
      });
    } finally {
      setCambiandoEstado(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!clienteEliminar) return;
    setEliminando(true);
    try {
      await clientesService.eliminarCliente(clienteEliminar.id);
      toast.success("Cliente eliminado", { description: clienteEliminar.nombre });
      setClienteEliminar(null);
      recargar();
    } catch (err) {
      toast.error("No se pudo eliminar el cliente", {
        description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEliminando(false);
    }
  };

  const columns = buildColumns({
    onVerExpediente: (cliente) => setExpedienteId(cliente.id),
    onEditar: (cliente) => {
      setClienteEdicion(cliente);
      setPanelFormAbierto(true);
    },
    onCambiarEstado: setClienteCambioEstado,
    onEliminar: setClienteEliminar,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Clientes</h1>
          <p className="text-sm text-slate-500">Cartera de clientes, historial de compras y riesgo.</p>
        </div>
        <Permitido modulo="clientes" accion="crear">
          <Button
            onClick={() => {
              setClienteEdicion(null);
              setPanelFormAbierto(true);
            }}
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Nuevo cliente
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
            data={clientes}
            getRowId={(c) => c.id}
            emptyTitle="Sin clientes para estos filtros"
            emptyDescription="Ajusta los filtros o registra un nuevo cliente."
          />
        )}
      </Card>

      <DossierPanel clienteId={expedienteId} onOpenChange={(open) => !open && setExpedienteId(null)} />

      <ClientFormPanel
        open={panelFormAbierto}
        cliente={clienteEdicion}
        onOpenChange={setPanelFormAbierto}
        onSuccess={recargar}
      />

      <ConfirmDialog
        open={!!clienteCambioEstado}
        onOpenChange={(open) => !open && setClienteCambioEstado(null)}
        title={clienteCambioEstado?.activo ? "¿Desactivar cliente?" : "¿Activar cliente?"}
        description={
          clienteCambioEstado?.activo
            ? `${clienteCambioEstado?.nombre} dejará de aparecer para seleccionarlo en Nueva venta.`
            : `${clienteCambioEstado?.nombre} volverá a estar disponible para la venta.`
        }
        confirmLabel={clienteCambioEstado?.activo ? "Desactivar" : "Activar"}
        tone={clienteCambioEstado?.activo ? "danger" : "default"}
        loading={cambiandoEstado}
        onConfirm={confirmarCambioEstado}
      />

      <ConfirmDialog
        open={!!clienteEliminar}
        onOpenChange={(open) => !open && setClienteEliminar(null)}
        title="¿Eliminar cliente?"
        description="¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        tone="danger"
        loading={eliminando}
        onConfirm={confirmarEliminar}
      />
    </div>
  );
}
