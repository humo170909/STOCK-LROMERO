import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { VentasView } from "@/components/ventas-consulta/ventas-view";

export const metadata: Metadata = { title: "Ventas" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("ventas");
  return <VentasView />;
}
