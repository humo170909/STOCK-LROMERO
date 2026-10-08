"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { cotizacionesService } from "@/services";
import { useAppStore } from "@/store/app-store";
import type { CotizacionPdf } from "@/lib/cotizacion-pdf";

/** Genera (solo lectura) el PDF de una cotización y ofrece ver / descargar / compartir. */
export function useCotizacionPdf(cotizacionId: string | null) {
  const empresa = useAppStore((s) => s.configuracionEmpresa);
  const [generando, setGenerando] = useState(false);
  const enCurso = useRef(false);

  const generar = useCallback(async (): Promise<CotizacionPdf | null> => {
    if (!cotizacionId || enCurso.current) return null;
    enCurso.current = true;
    setGenerando(true);
    const cargando = toast.loading("Generando PDF…");
    try {
      const datos = await cotizacionesService.obtenerDatosParaPdf(cotizacionId);
      const { generarCotizacionPdf } = await import("@/lib/cotizacion-pdf");
      const pdf = await generarCotizacionPdf(datos, empresa);
      toast.success("PDF generado correctamente.", { id: cargando });
      return pdf;
    } catch {
      toast.error("No se pudo generar el PDF. Inténtalo nuevamente.", { id: cargando });
      return null;
    } finally {
      enCurso.current = false;
      setGenerando(false);
    }
  }, [cotizacionId, empresa]);

  const ver = useCallback(async () => {
    // La pestaña se abre de forma síncrona para que el navegador no bloquee el popup.
    const ventana = window.open("", "_blank");
    const pdf = await generar();
    if (!pdf) {
      ventana?.close();
      return;
    }
    const url = URL.createObjectURL(pdf.blob);
    if (ventana) ventana.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [generar]);

  const descargar = useCallback(async () => {
    const pdf = await generar();
    if (!pdf) return;
    const url = URL.createObjectURL(pdf.blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = pdf.nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [generar]);

  const compartir = useCallback(async () => {
    const pdf = await generar();
    if (!pdf) return;
    const archivo = new File([pdf.blob], pdf.nombreArchivo, { type: "application/pdf" });
    if (typeof navigator.share === "function" && navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: pdf.nombreArchivo });
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          toast.info("Descarga el PDF y compártelo manualmente.");
        }
      }
      return;
    }
    toast.info("Descarga el PDF y compártelo manualmente.");
  }, [generar]);

  return { generando, ver, descargar, compartir };
}
