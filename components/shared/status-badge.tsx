import { Badge } from "@/components/ui/badge";
import { ESTADO_STOCK_LABEL, type EstadoStock } from "@/types";

const TONO_STOCK: Record<EstadoStock, "success" | "warning" | "danger"> = {
  disponible: "success",
  stock_bajo: "warning",
  agotado: "danger",
};

export function StockStatusBadge({ estado }: { estado: EstadoStock }) {
  return (
    <Badge tone={TONO_STOCK[estado]} dot>
      {ESTADO_STOCK_LABEL[estado]}
    </Badge>
  );
}

const ESTADO_CAJA_LABEL = { abierta: "Caja abierta", cerrada: "Caja cerrada" } as const;

export function CajaStatusBadge({ estado }: { estado: "abierta" | "cerrada" }) {
  return (
    <Badge tone={estado === "abierta" ? "success" : "neutral"} dot>
      {ESTADO_CAJA_LABEL[estado]}
    </Badge>
  );
}

const ESTADO_VENTA_LABEL = { confirmada: "Confirmada", anulada: "Anulada" } as const;

export function VentaStatusBadge({ estado }: { estado: "confirmada" | "anulada" }) {
  return (
    <Badge tone={estado === "confirmada" ? "success" : "danger"} dot>
      {ESTADO_VENTA_LABEL[estado]}
    </Badge>
  );
}

const TONO_RIESGO = { bajo: "success", medio: "warning", alto: "danger" } as const;
const RIESGO_LABEL = { bajo: "Riesgo bajo", medio: "Riesgo medio", alto: "Riesgo alto" } as const;

export function RiesgoBadge({ riesgo }: { riesgo: "bajo" | "medio" | "alto" }) {
  return <Badge tone={TONO_RIESGO[riesgo]}>{RIESGO_LABEL[riesgo]}</Badge>;
}

const TONO_COTIZACION = {
  borrador: "neutral",
  enviada: "info",
  aceptada: "success",
  rechazada: "danger",
  vencida: "warning",
  convertida: "success",
} as const;
const COTIZACION_LABEL = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
  convertida: "Convertida",
} as const;

const ROL_LABEL = {
  administrador: "Administrador",
  supervisor: "Supervisor",
} as const;

export function RolBadge({ rol }: { rol: keyof typeof ROL_LABEL }) {
  return <Badge tone={rol === "administrador" ? "info" : "neutral"}>{ROL_LABEL[rol]}</Badge>;
}

export function CotizacionStatusBadge({
  estado,
}: {
  estado: "borrador" | "enviada" | "aceptada" | "rechazada" | "vencida" | "convertida";
}) {
  return <Badge tone={TONO_COTIZACION[estado]}>{COTIZACION_LABEL[estado]}</Badge>;
}
