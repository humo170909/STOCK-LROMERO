"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SidePanel } from "@/components/shared/side-panel";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Badge } from "@/components/ui/badge";
import { proveedoresService, type CompraListado } from "@/services";
import type { Proveedor } from "@/types";

export function HistorialPanel({
  proveedor,
  onOpenChange,
}: {
  proveedor: Proveedor | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [compras, setCompras] = useState<CompraListado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!proveedor) return;
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const lista = await proveedoresService.obtenerHistorialCompras(proveedor!.id);
        if (vigente) setCompras(lista);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [proveedor]);

  return (
    <SidePanel
      open={!!proveedor}
      onOpenChange={onOpenChange}
      title={proveedor ? proveedor.razonSocial : "Historial de compras"}
      description={proveedor ? `Doc. ${proveedor.documento}` : undefined}
    >
      {cargando ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-12" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} />
      ) : compras.length === 0 ? (
        <EmptyState title="Sin compras registradas a este proveedor" className="py-10" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {compras.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-[13px] font-medium text-navy-900">{c.numeroDocumento}</p>
                <p className="text-xs text-slate-400">{format(new Date(c.fecha), "d MMM yyyy", { locale: es })}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <CurrencyDisplay value={c.total} className="text-[13px] font-medium text-navy-900" />
                <Badge tone={c.estado === "registrada" ? "success" : "danger"} dot>
                  {c.estado === "registrada" ? "Registrada" : "Anulada"}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SidePanel>
  );
}
