"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { cajaService, type ResumenCaja } from "@/services";
import { StatusCard } from "./status-card";
import { ResumenDiarioCards } from "./resumen-diario-cards";
import { MediosPagoTable } from "./medios-pago-table";
import { MovementsTable } from "./movements-table";
import { HistorialCajas } from "./historial-cajas";
import { ManualMovementDialog } from "./manual-movement-dialog";
import { CloseCajaDialog } from "./close-caja-dialog";
import { OpenCajaDialog } from "./open-caja-dialog";

export function CajaView() {
  const [datos, setDatos] = useState<ResumenCaja | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [movDialogAbierto, setMovDialogAbierto] = useState(false);
  const [cerrarDialogAbierto, setCerrarDialogAbierto] = useState(false);
  const [abrirDialogAbierto, setAbrirDialogAbierto] = useState(false);

  const recargar = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const resultado = await cajaService.obtenerResumen();
        if (vigente) setDatos(resultado);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar la caja.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [refreshToken]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">Ingresos y Caja</h1>
        <p className="text-sm text-slate-500">Apertura, cierre y movimientos de caja de la sede.</p>
      </div>

      {cargando ? (
        <div className="space-y-3">
          <SkeletonBlock className="h-16" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desk:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-20" />
            ))}
          </div>
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={recargar} className="py-10" />
      ) : datos ? (
        <>
          <StatusCard
            caja={datos.cajaActual}
            montoEsperadoEfectivo={datos.montoEsperadoEfectivo}
            onCerrar={() => setCerrarDialogAbierto(true)}
            onAbrir={() => setAbrirDialogAbierto(true)}
          />

          <ResumenDiarioCards resumen={datos.resumen} />

          <div className="grid grid-cols-1 gap-4 desk:grid-cols-[2fr_1fr]">
            <MovementsTable movimientos={datos.movimientosHoy} onRegistrar={() => setMovDialogAbierto(true)} />
            <div className="space-y-4">
              <MediosPagoTable totales={datos.totalesPorMedioPago} />
              <HistorialCajas historial={datos.historial} />
            </div>
          </div>
        </>
      ) : null}

      <ManualMovementDialog open={movDialogAbierto} onOpenChange={setMovDialogAbierto} onSuccess={recargar} />
      {datos ? (
        <CloseCajaDialog
          open={cerrarDialogAbierto}
          onOpenChange={setCerrarDialogAbierto}
          montoEsperado={datos.montoEsperadoEfectivo}
          onSuccess={recargar}
        />
      ) : null}
      <OpenCajaDialog open={abrirDialogAbierto} onOpenChange={setAbrirDialogAbierto} onSuccess={recargar} />
    </div>
  );
}
