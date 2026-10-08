import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/requerir-admin";
import { AuditoriaView } from "@/components/auditoria/auditoria-view";

export const metadata: Metadata = { title: "Auditoría" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirAdmin();
  return <AuditoriaView />;
}
