"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import type { DetalleVentaCompleto } from "@/services";
import type { VentaPdf } from "@/lib/venta-pdf";

/** Genera (solo lectura) el PDF A4 de una venta ya cargada y ofrece ver / descargar / compartir / imprimir. */
export function useVentaPdf(datos: DetalleVentaCompleto | null) {
  const empresa = useAppStore((s) => s.configuracionEmpresa);
  const sedes = useAppStore((s) => s.sedes);
  const [generando, setGenerando] = useState(false);
  const enCurso = useRef(false);

  const generar = useCallback(async (): Promise<VentaPdf | null> => {
    if (!datos || enCurso.current) return null;
    enCurso.current = true;
    setGenerando(true);
    const cargando = toast.loading("Generando PDF…");
    try {
      const { generarVentaPdf } = await import("@/lib/venta-pdf");
      const nombreSede = sedes.find((s) => s.id === datos.venta.sedeId)?.nombre;
      const pdf = await generarVentaPdf(datos, empresa, nombreSede);
      toast.success("PDF generado correctamente.", { id: cargando });
      return pdf;
    } catch {
      toast.error("No se pudo generar el PDF. Inténtalo nuevamente.", { id: cargando });
      return null;
    } finally {
      enCurso.current = false;
      setGenerando(false);
    }
  }, [datos, empresa, sedes]);

  const ver = useCallback(async () => {
    // Pestaña abierta de forma síncrona para que el navegador no bloquee el popup.
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

  const imprimir = useCallback(async () => {
    const pdf = await generar();
    if (!pdf) return;
    const url = URL.createObjectURL(pdf.blob);
    const marco = document.createElement("iframe");
    marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    marco.src = url;
    marco.onload = () => {
      try {
        marco.contentWindow?.focus();
        marco.contentWindow?.print();
      } catch {
        toast.info("Descarga el PDF e imprímelo desde tu visor.");
      }
    };
    document.body.appendChild(marco);
    setTimeout(() => {
      marco.remove();
      URL.revokeObjectURL(url);
    }, 120_000);
  }, [generar]);

  return { generando, ver, descargar, compartir, imprimir };
}
