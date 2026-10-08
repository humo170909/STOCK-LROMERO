import type { Metadata } from "next";
import { requerirPermiso } from "@/lib/auth/requerir-admin";
import { ProductosView } from "@/components/productos/productos-view";

export const metadata: Metadata = { title: "Productos y stock" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirPermiso("productos");
  return <ProductosView />;
}
