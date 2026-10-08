import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { ProveedoresView } from "@/components/proveedores/proveedores-view";

export const metadata: Metadata = { title: "Proveedores" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("proveedores");
  return <ProveedoresView />;
}
