"use client";

import { Permitido } from "@/components/shared/permitido";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileDown, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { productosService, type FiltrosProductos } from "@/services";
import type { Producto } from "@/types";
import { FiltersBar } from "./filters-bar";
import { buildColumns } from "./columns";
import { StockAdjustPanel } from "./stock-adjust-panel";
import { ProductFormPanel } from "./product-form-panel";

export function ProductosView() {
  const [filtros, setFiltros] = useState<FiltrosProductos>({ activo: "activos" });
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productoAjuste, setProductoAjuste] = useState<Producto | null>(null);
  const [panelFormAbierto, setPanelFormAbierto] = useState(false);
  const [productoEdicion, setProductoEdicion] = useState<Producto | null>(null);
  const [productoCambioEstado, setProductoCambioEstado] = useState<Producto | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const recargar = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const [listaProductos, listaCategorias] = await Promise.all([
          productosService.listarProductos(filtros),
          productosService.listarCategorias(),
        ]);
        if (vigente) {
          setProductos(listaProductos);
          setCategorias(listaCategorias);
        }
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar el catálogo de productos.");
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
    if (!productoCambioEstado) return;
    setCambiandoEstado(true);
    try {
      await productosService.cambiarEstado(productoCambioEstado.id, !productoCambioEstado.activo);
      toast.success(productoCambioEstado.activo ? "Producto desactivado" : "Producto activado", {
        description: productoCambioEstado.nombre,
      });
      setProductoCambioEstado(null);
      recargar();
    } catch (err) {
      toast.error("No se pudo actualizar el estado", {
        description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
      });
    } finally {
      setCambiandoEstado(false);
    }
  };

  const exportarKardex = async () => {
    setExportando(true);
    try {
      const blob = await productosService.exportarKardex();
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

  const columns = buildColumns({
    onAjustarStock: setProductoAjuste,
    onEditar: (producto) => {
      setProductoEdicion(producto);
      setPanelFormAbierto(true);
    },
    onCambiarEstado: setProductoCambioEstado,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Productos y stock</h1>
          <p className="text-sm text-slate-500">Catálogo, precios, costos y control de inventario.</p>
        </div>
        <div className="flex gap-2">
          <Permitido modulo="movimientos" accion="exportar">
            <Button variant="outline" onClick={exportarKardex} disabled={exportando}>
              <FileDown className="size-4" strokeWidth={1.75} />
              {exportando ? "Exportando…" : "Exportar Kárdex"}
            </Button>
          </Permitido>
          <Permitido modulo="productos" accion="crear">
            <Button
              onClick={() => {
                setProductoEdicion(null);
                setPanelFormAbierto(true);
              }}
            >
              <Plus className="size-4" strokeWidth={1.75} />
              Nuevo producto
            </Button>
          </Permitido>
        </div>
      </div>

      <Card className="p-4">
        <FiltersBar filtros={filtros} categorias={categorias} onChange={setFiltros} />
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
            data={productos}
            getRowId={(p) => p.id}
            emptyTitle="Sin productos para estos filtros"
            emptyDescription="Ajusta la búsqueda o los filtros, o crea un nuevo producto."
          />
        )}
      </Card>

      <StockAdjustPanel
        producto={productoAjuste}
        onOpenChange={(open) => !open && setProductoAjuste(null)}
        onSuccess={recargar}
      />

      <ProductFormPanel
        open={panelFormAbierto}
        producto={productoEdicion}
        onOpenChange={setPanelFormAbierto}
        onSuccess={recargar}
      />

      <ConfirmDialog
        open={!!productoCambioEstado}
        onOpenChange={(open) => !open && setProductoCambioEstado(null)}
        title={productoCambioEstado?.activo ? "¿Desactivar producto?" : "¿Activar producto?"}
        description={
          productoCambioEstado?.activo
            ? `${productoCambioEstado?.nombre} dejará de aparecer en Nueva venta y en el catálogo activo.`
            : `${productoCambioEstado?.nombre} volverá a estar disponible para la venta.`
        }
        confirmLabel={productoCambioEstado?.activo ? "Desactivar" : "Activar"}
        tone={productoCambioEstado?.activo ? "danger" : "default"}
        loading={cambiandoEstado}
        onConfirm={confirmarCambioEstado}
      />
    </div>
  );
}
