import { Permitido } from "@/components/shared/permitido";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CajaStatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { AperturaCierreCaja } from "@/types";

export function StatusCard({
  caja,
  montoEsperadoEfectivo,
  onCerrar,
  onAbrir,
}: {
  caja: AperturaCierreCaja;
  montoEsperadoEfectivo: number;
  onCerrar: () => void;
  onAbrir: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-4">
        <CajaStatusBadge estado={caja.estado} />
        <div className="text-[13px] text-slate-500">
          {caja.estado === "abierta" ? (
            <>Abierta{caja.abiertaEn ? <> a las {format(new Date(caja.abiertaEn), "HH:mm", { locale: es })}</> : null} con <CurrencyDisplay value={caja.montoApertura} className="font-medium text-slate-700" /></>
          ) : (
            <>Cerrada a las {caja.cerradaEn ? format(new Date(caja.cerradaEn), "HH:mm", { locale: es }) : "—"}</>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {caja.estado === "abierta" ? (
          <>
            <div className="text-right text-[13px]">
              <p className="text-slate-400">Efectivo esperado</p>
              <p className="font-semibold text-navy-900"><CurrencyDisplay value={montoEsperadoEfectivo} /></p>
            </div>
            <Permitido modulo="caja" accion="editar">
              <Button variant="outline" onClick={onCerrar}>
                Cerrar caja
              </Button>
            </Permitido>
          </>
        ) : (
          <Permitido modulo="caja" accion="crear">
            <Button onClick={onAbrir}>Abrir caja</Button>
          </Permitido>
        )}
      </div>
    </Card>
  );
}
