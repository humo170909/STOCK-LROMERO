import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { ReportesView } from "@/components/reportes/reportes-view";

export const metadata: Metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("reportes");
  return <ReportesView />;
}
