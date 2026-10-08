"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MailWarning } from "lucide-react";
import { SidePanel } from "@/components/shared/side-panel";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { RiesgoBadge, VentaStatusBadge } from "@/components/shared/status-badge";
import { clientesService, type ExpedienteCliente } from "@/services";

export function DossierPanel({ clienteId, onOpenChange }: { clienteId: string | null; onOpenChange: (open: boolean) => void }) {
  const [datos, setDatos] = useState<ExpedienteCliente | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviandoAviso, setEnviandoAviso] = useState(false);

  useEffect(() => {
    if (!clienteId) return;
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      setDatos(null);
      try {
        const resultado = await clientesService.obtenerExpediente(clienteId as string);
        if (vigente) setDatos(resultado);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar el expediente.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  const enviarAviso = async () => {
    if (!clienteId) return;
    setEnviandoAviso(true);
    try {
      await clientesService.enviarAvisoCatalogo(clienteId);
      toast.success("Aviso de catálogo enviado");
    } catch {
      toast.error("No se pudo enviar el aviso");
    } finally {
      setEnviandoAviso(false);
    }
  };

  return (
    <SidePanel
      open={!!clienteId}
      onOpenChange={onOpenChange}
      title={datos ? datos.cliente.nombre : "Expediente de cliente"}
      description={datos ? datos.cliente.documento : undefined}
      wide
    >
      {cargando ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-10" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} />
      ) : datos ? (
        <div className="space-y-5">
          {datos.inactivoPorCompra ? (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
              <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-600" strokeWidth={1.75} />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  {datos.ultimaCompra
                    ? `Sin comprar hace ${datos.diasSinComprar} días.`
                    : "Este cliente nunca ha comprado."}
                </p>
                <p className="text-xs text-amber-700">Puedes enviarle un aviso con el catálogo actualizado.</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={enviarAviso} disabled={enviandoAviso}>
                  {enviandoAviso ? "Enviando…" : "Enviar aviso de catálogo"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-slate-400">Total comprado</p>
              <p className="text-base font-semibold text-navy-900"><CurrencyDisplay value={datos.totalComprado} /></p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-slate-400">N° de compras</p>
              <p className="text-base font-semibold text-navy-900">{datos.numeroCompras}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-slate-400">Línea de crédito</p>
              <p className="text-base font-semibold text-navy-900"><CurrencyDisplay value={datos.cliente.lineaCredito} /></p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-slate-400">Riesgo</p>
              <RiesgoBadge riesgo={datos.cliente.riesgo} />
            </div>
          </div>

          <div className="space-y-1 text-[13px] text-slate-500">
            <p>{datos.cliente.direccion || "Sin dirección registrada"}</p>
            <p>{datos.cliente.telefono || "Sin teléfono"} {datos.cliente.correo ? `· ${datos.cliente.correo}` : ""}</p>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-[13px] font-medium text-slate-700">Productos comprados</p>
            {datos.productosComprados.length === 0 ? (
              <EmptyState title="Sin compras todavía" className="py-6" />
            ) : (
              <ul className="space-y-2">
                {datos.productosComprados.slice(0, 8).map((item) => (
                  <li key={item.producto.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-slate-700">{item.producto.nombre}</span>
                    <span className="shrink-0 text-slate-400">{item.cantidad} uds.</span>
                    <CurrencyDisplay value={item.monto} className="shrink-0 font-medium text-navy-900" />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-[13px] font-medium text-slate-700">Historial de compras</p>
            {datos.historial.length === 0 ? (
              <EmptyState title="Sin ventas registradas" className="py-6" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {datos.historial.map((venta) => (
                  <li key={venta.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <div>
                      <p className="font-medium text-navy-900">{venta.numero}</p>
                      <p className="text-xs text-slate-400">
                        {format(new Date(venta.fecha), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <CurrencyDisplay value={venta.total} className="font-medium text-navy-900" />
                      <VentaStatusBadge estado={venta.estado} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </SidePanel>
  );
}
