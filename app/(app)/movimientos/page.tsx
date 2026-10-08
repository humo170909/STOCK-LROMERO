import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { MovimientosView } from "@/components/movimientos/movimientos-view";

export const metadata: Metadata = { title: "Movimientos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("movimientos");
  return <MovimientosView />;
}
