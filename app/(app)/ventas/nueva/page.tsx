import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { NuevaVentaView } from "@/components/ventas/nueva-venta-view";

export const metadata: Metadata = { title: "Nueva venta" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("ventas", "crear");
  return <NuevaVentaView />;
}
