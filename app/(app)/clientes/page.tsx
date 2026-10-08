import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { ClientesView } from "@/components/clientes/clientes-view";

export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("clientes");
  return <ClientesView />;
}
