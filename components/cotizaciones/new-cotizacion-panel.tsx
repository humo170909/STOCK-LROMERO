"use client";

import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { SidePanel } from "@/components/shared/side-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { clientesService, cotizacionesService } from "@/services";
import type { Cliente, Cotizacion } from "@/types";
import { ProductPicker } from "./product-picker";
import { useCotizacionLines } from "./use-cotizacion-lines";

export function NewCotizacionPanel({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (cotizacion: Cotizacion, nombreCliente: string) => void;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const lineas = useCotizacionLines();

  useEffect(() => {
    if (!open) return;
    let vigente = true;
    clientesService.listarClientes({ activo: "activos" }).then((lista) => {
      if (vigente) setClientes(lista);
    });
    return () => {
      vigente = false;
    };
  }, [open]);
  const [clienteId, setClienteId] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState(format(addDays(new Date(), 15), "yyyy-MM-dd"));
  const [condiciones, setCondiciones] = useState("");
  const [enviando, setEnviando] = useState(false);

  const limpiarYcerrar = () => {
    onOpenChange(false);
    lineas.vaciar();
    setClienteId("");
    setCondiciones("");
    setFechaVencimiento(format(addDays(new Date(), 15), "yyyy-MM-dd"));
  };

  const confirmar = async () => {
    if (!clienteId) {
      toast.error("Selecciona un cliente.");
      return;
    }
    if (lineas.lineas.length === 0) {
      toast.error("Agrega al menos un producto.");
      return;
    }
    setEnviando(true);
    try {
      const cotizacion = await cotizacionesService.crearCotizacion({
        clienteId,
        fechaVencimiento: new Date(`${fechaVencimiento}T23:59:59`).toISOString(),
        condiciones: condiciones.trim() || undefined,
        movilidad: lineas.movilidad,
        lineas: lineas.lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad, descuento: l.descuento })),
      });
      const nombreCliente = clientes.find((c) => c.id === clienteId)?.nombre ?? "Cliente";
      limpiarYcerrar();
      onSuccess(cotizacion, nombreCliente);
    } catch (error) {
      toast.error("No se pudo crear la cotización", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={(o) => !o && limpiarYcerrar()} title="Nueva cotización" wide>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Cliente">
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fecha de vencimiento">
              <Input
                type="date"
                value={fechaVencimiento}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
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
                    <th className="px-3 py-2">Descuento</th>
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
                          step="0.1"
                          value={l.descuento}
                          onChange={(e) => lineas.actualizarDescuento(l.producto.id, Number(e.target.value) || 0)}
                          className="h-8 w-20 rounded-md border border-slate-200 px-2 outline-none focus-visible:border-brand-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-navy-900">
                        <CurrencyDisplay value={l.producto.precioVenta * l.cantidad - l.descuento} />
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

          <Field label="Condiciones (opcional)">
            <Textarea rows={2} value={condiciones} onChange={(e) => setCondiciones(e.target.value)} placeholder="Validez, forma de pago, entrega…" />
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
            <div className="flex items-center justify-between">
              <label htmlFor="movilidad" className="text-slate-500">Movilidad</label>
              <input
                id="movilidad"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={lineas.movilidadTexto}
                onChange={(e) => lineas.setMovilidadTexto(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="h-8 w-28 rounded-md border border-slate-200 bg-white px-2 text-right font-medium text-navy-900 outline-none focus-visible:border-brand-500"
              />
            </div>
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
            {enviando ? "Guardando…" : "Guardar borrador"}
          </Button>
        </div>
      </div>
    </SidePanel>
  );
}
