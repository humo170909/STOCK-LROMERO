"use client";

import { useEffect, useState } from "react";
import { FileText, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export function ComprobantesTab() {
  // Último correlativo emitido; la numeración real la asigna la base de datos (fn_registrar_venta).
  const [ultimo, setUltimo] = useState<number | null | "error">(null);

  useEffect(() => {
    let vigente = true;
    createClient()
      .from("ventas")
      .select("correlativo")
      .order("correlativo", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (vigente) setUltimo(error ? "error" : (data?.correlativo ?? 0));
      });
    return () => {
      vigente = false;
    };
  }, []);

  const siguiente =
    ultimo === null ? "…" : ultimo === "error" ? "—" : `NV-${(ultimo + 1).toString().padStart(6, "0")}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Numeración de notas de venta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-50 text-brand-600">
              <FileText className="size-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-[13px] text-slate-500">Nota de venta</p>
              <p className="font-display text-lg font-semibold text-navy-900">{siguiente}</p>
              <p className="text-xs text-slate-400">Siguiente número disponible</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2.5 rounded-xl bg-blue-50/70 px-4 py-3 text-[13px] text-brand-700">
        <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <p>
          Las ventas se registran como notas de venta internas con numeración correlativa propia. El sistema no emite
          comprobantes electrónicos ni se conecta a servicios tributarios externos.
        </p>
      </div>
    </div>
  );
}
