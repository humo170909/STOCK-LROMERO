import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { CotizacionesView } from "@/components/cotizaciones/cotizaciones-view";

export const metadata: Metadata = { title: "Cotizaciones" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("cotizaciones");
  return <CotizacionesView />;
}
