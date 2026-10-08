import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { TrabajadoresView } from "@/components/trabajadores/trabajadores-view";

export const metadata: Metadata = { title: "Trabajadores" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("trabajadores");
  return <TrabajadoresView />;
}
