"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SidePanel } from "@/components/shared/side-panel";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { tienePermiso, useAppStore } from "@/store/app-store";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { VentaStatusBadge } from "@/components/shared/status-badge";
import { montoEnLetras } from "@/lib/numero-a-letras";
import { ventasService, type DetalleVentaCompleto } from "@/services";
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_VENTA_LABEL } from "@/types";
import { Download, FileText, Printer, Share2 } from "lucide-react";
import { useVentaPdf } from "./use-venta-pdf";

export function DetailPanel({
  ventaId,
  onOpenChange,
  onCambio,
}: {
  ventaId: string | null;
  onOpenChange: (open: boolean) => void;
  onCambio: () => void;
}) {
  const puedeAnular = useAppStore((s) => tienePermiso(s.permisos, "ventas", "cancelar"));
  const [anularAbierto, setAnularAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [datos, setDatos] = useState<DetalleVentaCompleto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ventaId) return;
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      setDatos(null);
      try {
        const resultado = await ventasService.obtenerDetalleVenta(ventaId as string);
        if (vigente) setDatos(resultado);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar el detalle.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [ventaId, refreshToken]);

  const pdf = useVentaPdf(datos);

  const anular = async () => {
    if (!ventaId) return;
    if (motivo.trim().length < 3) {
      toast.error("Indica el motivo de la anulación.");
      return;
    }
    setAnulando(true);
    try {
      await ventasService.anularVenta(ventaId, motivo);
      toast.success("Venta anulada", { description: "El stock volvió al inventario y la caja se actualizó." });
      setAnularAbierto(false);
      setMotivo("");
      setRefreshToken((t) => t + 1);
      onCambio();
    } catch (err) {
      toast.error("No se pudo anular la venta", {
        description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
      });
    } finally {
      setAnulando(false);
    }
  };

  return (
    <SidePanel
      open={!!ventaId}
      onOpenChange={onOpenChange}
      title={datos ? datos.venta.numero : "Detalle de venta"}
      description={datos ? "Nota de venta" : undefined}
    >
      {cargando ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-10" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} />
      ) : datos ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <p className="text-slate-400">Cliente</p>
              <p className="font-medium text-navy-900">{datos.cliente?.nombre ?? "—"}</p>
              <p className="text-slate-500">
                {datos.cliente?.documento}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Usuario</p>
              <p className="font-medium text-navy-900">{datos.nombreUsuario}</p>
            </div>
            <div>
              <p className="text-slate-400">Fecha</p>
              <p className="font-medium text-navy-900">
                {format(new Date(datos.venta.fecha), "d MMM yyyy, HH:mm", { locale: es })}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Estado</p>
              <VentaStatusBadge estado={datos.venta.estado} />
            </div>
            <div>
              <p className="text-slate-400">Medio de pago</p>
              <p className="font-medium text-navy-900">{MEDIO_PAGO_VENTA_LABEL[datos.venta.medioPago]}</p>
              {datos.pagos.length > 1 ? (
                <ul className="mt-0.5 space-y-0.5 text-xs text-slate-500">
                  {datos.pagos.map((p) => (
                    <li key={p.medioPago} className="flex items-center justify-between gap-3">
                      <span>{MEDIO_PAGO_LABEL[p.medioPago]}</span>
                      <CurrencyDisplay value={p.monto} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-[13px] font-medium text-slate-700">Productos</p>
            <ul className="space-y-2.5">
              {datos.detalle.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 text-[13px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{d.nombreProducto}</p>
                    <p className="text-xs text-slate-500">
                      {d.cantidad} × <CurrencyDisplay value={d.precioHistorico} /> · costo <CurrencyDisplay value={d.costoHistorico} />
                    </p>
                  </div>
                  <CurrencyDisplay value={d.subtotal} className="shrink-0 font-medium text-navy-900" />
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <dl className="space-y-1.5 text-[13px]">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-medium text-navy-900"><CurrencyDisplay value={datos.venta.subtotal} /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Descuento</dt>
              <dd className="font-medium text-navy-900"><CurrencyDisplay value={datos.venta.descuento} /></dd>
            </div>
            {datos.venta.impuesto > 0 ? (
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Impuesto</dt>
              <dd className="font-medium text-navy-900"><CurrencyDisplay value={datos.venta.impuesto} /></dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-sm">
              <dt className="font-semibold text-navy-900">Total</dt>
              <dd className="font-display text-base font-semibold text-navy-900"><CurrencyDisplay value={datos.venta.total} /></dd>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
              <dt className="text-slate-500">Costo de venta</dt>
              <dd className="text-slate-500"><CurrencyDisplay value={datos.venta.costoTotal} /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Ganancia</dt>
              <dd className="font-medium text-emerald-700"><CurrencyDisplay value={datos.venta.gananciaTotal} /></dd>
            </div>
          </dl>
          <p className="text-xs italic text-slate-400">{montoEnLetras(datos.venta.total)}</p>
          {datos.venta.observaciones ? (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{datos.venta.observaciones}</p>
          ) : null}
          {datos.venta.estado === "confirmada" ? (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={pdf.ver} disabled={pdf.generando}>
                  <FileText className="size-4" strokeWidth={1.75} />
                  {pdf.generando ? "Generando PDF…" : "Generar PDF A4"}
                </Button>
                <Button variant="outline" size="sm" onClick={pdf.descargar} disabled={pdf.generando}>
                  <Download className="size-4" strokeWidth={1.75} />
                  Descargar PDF
                </Button>
                <Button variant="outline" size="sm" onClick={pdf.compartir} disabled={pdf.generando}>
                  <Share2 className="size-4" strokeWidth={1.75} />
                  Compartir
                </Button>
                <Button variant="outline" size="sm" onClick={pdf.imprimir} disabled={pdf.generando}>
                  <Printer className="size-4" strokeWidth={1.75} />
                  Imprimir
                </Button>
              </div>
            </>
          ) : null}
          {puedeAnular && datos.venta.estado === "confirmada" ? (
            <>
              <Separator />
              <Button variant="outline" size="sm" onClick={() => setAnularAbierto(true)}>
                Anular venta
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <Dialog.Root open={anularAbierto} onOpenChange={(abierto) => !anulando && setAnularAbierto(abierto)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-navy-950/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_64px_-16px_rgb(15_28_51/0.35)] outline-none">
            <Dialog.Title className="text-sm font-semibold text-navy-900">¿Anular esta venta?</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">
              El stock vuelve al inventario y el dinero sale de la caja abierta. Esta acción no se puede deshacer.
            </Dialog.Description>
            <label htmlFor="motivo-anulacion" className="mt-4 mb-1.5 block text-[13px] font-medium text-slate-700">
              Motivo (obligatorio)
            </label>
            <Textarea id="motivo-anulacion" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" size="sm" disabled={anulando}>
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button size="sm" onClick={anular} disabled={anulando || motivo.trim().length < 3}>
                {anulando ? "Anulando…" : "Anular venta"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </SidePanel>
  );
}
