import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { CajaView } from "@/components/caja/caja-view";

export const metadata: Metadata = { title: "Ingresos y Caja" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("caja");
  return <CajaView />;
}
