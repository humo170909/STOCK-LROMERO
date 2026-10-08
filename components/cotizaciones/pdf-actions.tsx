"use client";

import { Download, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCotizacionPdf } from "./use-cotizacion-pdf";

export function PdfActions({ cotizacionId, className }: { cotizacionId: string | null; className?: string }) {
  const pdf = useCotizacionPdf(cotizacionId);

  return (
    <div className={className ?? "flex flex-wrap gap-2"}>
      <Button size="sm" variant="outline" onClick={pdf.ver} disabled={pdf.generando}>
        <FileText className="size-4" strokeWidth={1.75} />
        {pdf.generando ? "Generando PDF…" : "Generar PDF"}
      </Button>
      <Button size="sm" variant="outline" onClick={pdf.descargar} disabled={pdf.generando}>
        <Download className="size-4" strokeWidth={1.75} />
        Descargar PDF
      </Button>
      <Button size="sm" variant="outline" onClick={pdf.compartir} disabled={pdf.generando}>
        <Share2 className="size-4" strokeWidth={1.75} />
        Compartir
      </Button>
    </div>
  );
}
