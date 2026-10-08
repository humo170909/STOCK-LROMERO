import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginScreen } from "@/components/login/login-screen";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Acceso corporativo de Grupo LRomero Importaciones. Ingresa con tu cuenta para continuar.",
};

export default async function Page() {
  // Con sesión iniciada, /login lleva directo al dashboard.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return <LoginScreen />;
}
