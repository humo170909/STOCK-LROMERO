"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cotizacionesService } from "@/services";
import { PagosEditor } from "@/components/ventas/pagos-editor";
import { usePagos } from "@/components/ventas/use-pagos";

export function ConvertDialog({
  open,
  onOpenChange,
  cotizacionId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizacionId: string | null;
  onSuccess: (ventaNumero: string) => void;
}) {
  // Total que tendría la venta hoy (precio vigente): sirve para repartir el pago entre medios.
  const [total, setTotal] = useState(0);
  const pagos = usePagos(total);
  const cerrar = (abierto: boolean) => {
    if (!abierto) pagos.reset();
    onOpenChange(abierto);
  };

  useEffect(() => {
    if (!open || !cotizacionId) return;
    let vigente = true;
    cotizacionesService
      .calcularTotalConversion(cotizacionId)
      .then((t) => vigente && setTotal(t))
      .catch(() => vigente && setTotal(0));
    return () => {
      vigente = false;
    };
  }, [open, cotizacionId]);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (!cotizacionId) return;
    setEnviando(true);
    try {
      const venta = await cotizacionesService.convertirAVenta({ cotizacionId, medioPago: pagos.medioPago, pagos: pagos.pagos });
      toast.success("Cotización convertida en venta", { description: venta.numero });
      cerrar(false);
      onSuccess(venta.numero);
    } catch (error) {
      toast.error("No se pudo convertir la cotización", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={cerrar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_64px_-16px_rgb(15_28_51/0.35)] outline-none">
          <Dialog.Title className="text-sm font-semibold text-navy-900">Convertir en venta</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Se usan los mismos productos y descuentos de la cotización, al precio vigente de cada producto. Se descuenta el stock y se registra en caja (la caja debe estar abierta).
          </Dialog.Description>

          <div className="mt-4 space-y-3">
            <PagosEditor pagos={pagos} />
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Cancelar
              </Button>
            </Dialog.Close>
            <Button size="sm" onClick={confirmar} disabled={enviando || !pagos.valido}>
              {enviando ? "Convirtiendo…" : "Confirmar venta"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
