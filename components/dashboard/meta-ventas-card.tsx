"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MESES, MetaProgreso } from "@/components/shared/meta-progreso";
import { metasService, type ResumenMeta } from "@/services";

export function MetaVentasCard() {
  const [resumen, setResumen] = useState<ResumenMeta | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    const { anio, mes } = metasService.mesActual();
    metasService
      .obtenerResumenMes(anio, mes)
      .then((r) => vigente && setResumen(r))
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <Card className="px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-500">
          Meta de ventas{resumen ? ` · ${MESES[resumen.mes - 1]} ${resumen.anio}` : ""}
        </p>
        <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-brand-600">
          <Target aria-hidden className="size-4" strokeWidth={1.75} />
        </span>
      </div>
      {error ? (
        <p className="text-sm text-slate-500">No se pudo cargar la meta del mes.</p>
      ) : resumen ? (
        <>
          <MetaProgreso resumen={resumen} />
          <p className="mt-2 text-[11px] text-slate-400">Ventas confirmadas del mes de todas las sedes.</p>
        </>
      ) : (
        <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
      )}
    </Card>
  );
}
