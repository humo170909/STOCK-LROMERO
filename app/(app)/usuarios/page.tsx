import type { Metadata } from "next";
import { requerirAdmin } from "@/lib/auth/requerir-admin";
import { UsuariosView } from "@/components/usuarios/usuarios-view";

export const metadata: Metadata = { title: "Usuarios y Permisos" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requerirAdmin();
  return <UsuariosView />;
}
