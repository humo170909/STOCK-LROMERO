import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { ComprasView } from "@/components/compras/compras-view";

export const metadata: Metadata = { title: "Compras" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("compras");
  return <ComprasView />;
}
