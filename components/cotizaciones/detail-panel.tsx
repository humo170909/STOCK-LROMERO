"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SidePanel } from "@/components/shared/side-panel";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Permitido } from "@/components/shared/permitido";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { CotizacionStatusBadge } from "@/components/shared/status-badge";
import { cotizacionesService, type DetalleCotizacionCompleto } from "@/services";
import { ConvertDialog } from "./convert-dialog";
import { PdfActions } from "./pdf-actions";

export function DetailPanel({
  cotizacionId,
  onOpenChange,
  onCambio,
}: {
  cotizacionId: string | null;
  onOpenChange: (open: boolean) => void;
  onCambio: () => void;
}) {
  const [datos, setDatos] = useState<DetalleCotizacionCompleto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [convertirAbierto, setConvertirAbierto] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!cotizacionId) return;
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const resultado = await cotizacionesService.obtenerDetalleCotizacion(cotizacionId as string);
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
  }, [cotizacionId, refreshToken]);

  const recargar = () => setRefreshToken((t) => t + 1);

  const cambiarEstado = async (estado: "enviada" | "aceptada" | "rechazada") => {
    if (!cotizacionId) return;
    setProcesando(true);
    try {
      await cotizacionesService.cambiarEstado(cotizacionId, estado);
      toast.success("Estado actualizado");
      recargar();
      onCambio();
    } catch (err) {
      toast.error("No se pudo actualizar el estado", {
        description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
      });
    } finally {
      setProcesando(false);
    }
  };

  return (
    <SidePanel
      open={!!cotizacionId}
      onOpenChange={onOpenChange}
      title={datos ? datos.cotizacion.numero : "Detalle de cotización"}
      description={datos?.nombreCliente}
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
          <div className="flex items-center justify-between">
            <CotizacionStatusBadge estado={datos.cotizacion.estado} />
            <span className="text-xs text-slate-400">
              Vence {format(new Date(datos.cotizacion.fechaVencimiento), "d MMM yyyy", { locale: es })}
            </span>
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
                      {d.cantidad} × <CurrencyDisplay value={d.precio} />
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
              <dd className="font-medium text-navy-900"><CurrencyDisplay value={datos.cotizacion.subtotal} /></dd>
            </div>
            {datos.cotizacion.impuesto > 0 ? (
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Impuesto</dt>
              <dd className="font-medium text-navy-900"><CurrencyDisplay value={datos.cotizacion.impuesto} /></dd>
              </div>
            ) : null}
            {(datos.cotizacion.movilidad ?? 0) > 0 ? (
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Movilidad</dt>
                <dd className="font-medium text-navy-900"><CurrencyDisplay value={datos.cotizacion.movilidad ?? 0} /></dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-sm">
              <dt className="font-semibold text-navy-900">Total</dt>
              <dd className="font-display text-base font-semibold text-navy-900"><CurrencyDisplay value={datos.cotizacion.total} /></dd>
            </div>
          </dl>

          {datos.cotizacion.condiciones ? (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{datos.cotizacion.condiciones}</p>
          ) : null}

          <Separator />

          <PdfActions cotizacionId={cotizacionId} />

          <Permitido modulo="cotizaciones" accion="editar">
          <div className="flex flex-wrap gap-2">
            {datos.cotizacion.estado === "borrador" ? (
              <Button size="sm" onClick={() => cambiarEstado("enviada")} disabled={procesando}>
                Marcar como enviada
              </Button>
            ) : null}
            {datos.cotizacion.estado === "enviada" ? (
              <>
                <Button size="sm" onClick={() => cambiarEstado("aceptada")} disabled={procesando}>
                  Marcar como aceptada
                </Button>
                <Button size="sm" variant="outline" onClick={() => cambiarEstado("rechazada")} disabled={procesando}>
                  Rechazar
                </Button>
              </>
            ) : null}
            {datos.cotizacion.estado === "aceptada" ? (
              <Permitido modulo="ventas" accion="crear">
                <Button size="sm" onClick={() => setConvertirAbierto(true)}>
                  Convertir en venta
                </Button>
              </Permitido>
            ) : null}
          </div>
          </Permitido>
        </div>
      ) : null}

      <ConvertDialog
        open={convertirAbierto}
        onOpenChange={setConvertirAbierto}
        cotizacionId={cotizacionId}
        onSuccess={() => {
          recargar();
          onCambio();
        }}
      />
    </SidePanel>
  );
}
