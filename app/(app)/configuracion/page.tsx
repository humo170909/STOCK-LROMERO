import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/requerir-admin";
import { ConfiguracionView } from "@/components/configuracion/configuracion-view";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirAdmin();
  return <ConfiguracionView />;
}
