"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { SidePanel } from "@/components/shared/side-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { comprasService, proveedoresService } from "@/services";
import type { Proveedor } from "@/types";
import { ProductPicker } from "./product-picker";
import { useCompraLines } from "./use-compra-lines";

export function NewCompraPanel({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const lineas = useCompraLines();

  useEffect(() => {
    if (!open) return;
    let vigente = true;
    proveedoresService
      .listarProveedores({ activo: "activos" })
      .then((lista) => {
        if (vigente) setProveedores(lista);
      })
      .catch((err) => {
        if (vigente) {
          toast.error("No se pudo cargar la lista de proveedores", {
            description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
          });
        }
      });
    return () => {
      vigente = false;
    };
  }, [open]);
  const [proveedorId, setProveedorId] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);

  const limpiarYcerrar = () => {
    onOpenChange(false);
    lineas.vaciar();
    setProveedorId("");
    setNumeroDocumento("");
    setObservaciones("");
  };

  const confirmar = async () => {
    if (!proveedorId) {
      toast.error("Selecciona un proveedor.");
      return;
    }
    if (!numeroDocumento.trim()) {
      toast.error("Ingresa el número de documento del proveedor.");
      return;
    }
    if (lineas.lineas.length === 0) {
      toast.error("Agrega al menos un producto.");
      return;
    }
    setEnviando(true);
    try {
      const compra = await comprasService.registrarCompra({
        proveedorId,
        numeroDocumento: numeroDocumento.trim(),
        observaciones: observaciones.trim() || undefined,
        lineas: lineas.lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad, costoUnitario: l.costoUnitario })),
      });
      toast.success("Compra registrada", { description: compra.numeroDocumento });
      limpiarYcerrar();
      onSuccess();
    } catch (error) {
      toast.error("No se pudo registrar la compra", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={(o) => !o && limpiarYcerrar()} title="Nueva compra" wide>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Proveedor">
              <Select value={proveedorId} onValueChange={setProveedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.razonSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="N° de documento">
              <Input value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} placeholder="FC-000123" />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-slate-700">Productos</p>
            <ProductPicker onSelect={lineas.agregar} />
          </div>

          {lineas.lineas.length === 0 ? (
            <EmptyState title="Sin productos agregados" className="py-8" />
          ) : (
            <div className="thin-scroll overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-blue-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Cantidad</th>
                    <th className="px-3 py-2">Costo unit.</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineas.lineas.map((l) => (
                    <tr key={l.producto.id}>
                      <td className="max-w-40 truncate px-3 py-2 font-medium text-navy-900">{l.producto.nombre}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={l.cantidad}
                          onChange={(e) => lineas.actualizarCantidad(l.producto.id, Number(e.target.value) || 1)}
                          className="h-8 w-16 rounded-md border border-slate-200 px-2 outline-none focus-visible:border-brand-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.costoUnitario}
                          onChange={(e) => lineas.actualizarCosto(l.producto.id, Number(e.target.value) || 0)}
                          className="h-8 w-24 rounded-md border border-slate-200 px-2 outline-none focus-visible:border-brand-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-navy-900">
                        <CurrencyDisplay value={l.cantidad * l.costoUnitario} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          aria-label={`Quitar ${l.producto.nombre}`}
                          onClick={() => lineas.quitar(l.producto.id)}
                          className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-danger-500"
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Field label="Observaciones (opcional)">
            <Textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </Field>

          <div className="space-y-1.5 rounded-lg bg-slate-50 p-3.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-navy-900"><CurrencyDisplay value={lineas.totales.subtotal} /></span>
            </div>
            {lineas.totales.impuesto > 0 ? (
              <div className="flex justify-between">
                <span className="text-slate-500">Impuesto</span>
              <span className="font-medium text-navy-900"><CurrencyDisplay value={lineas.totales.impuesto} /></span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm">
              <span className="font-semibold text-navy-900">Total</span>
              <span className="font-semibold text-navy-900"><CurrencyDisplay value={lineas.totales.total} /></span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={limpiarYcerrar}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando ? "Registrando…" : "Registrar compra"}
          </Button>
        </div>
      </div>
    </SidePanel>
  );
}
