"use server";

// Autenticación real contra Supabase Auth. El cliente de lib/supabase/server.ts
// persiste la sesión en cookies automáticamente (@supabase/ssr) — no hay cookie
// propia que gestionar.
import { createClient } from "@/lib/supabase/server";
import type { AuthErrorCode } from "@/lib/auth";

export type Credentials = {
  usuario: string; // correo electrónico
  password: string;
};

export type SesionUsuario = {
  name: string;
  usuario: string;
};

export type AuthResult = { ok: true; user: SesionUsuario } | { ok: false; code: AuthErrorCode };

export async function iniciarSesion({ usuario, password }: Credentials): Promise<AuthResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: usuario.trim(),
    password,
  });

  if (error || !data.user) {
    // Un corte de red no es una contraseña incorrecta.
    const sinRed = error?.name === "AuthRetryableFetchError" || error?.status === 0;
    return { ok: false, code: sinRed ? "network" : "invalid_credentials" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, activo")
    .eq("id", data.user.id)
    .maybeSingle();

  // Usuario desactivado por el administrador: no entra.
  if (profile && !profile.activo) {
    await supabase.auth.signOut();
    return { ok: false, code: "inactive" };
  }

  return {
    ok: true,
    user: { name: profile?.nombre ?? data.user.email ?? "Usuario", usuario: data.user.email ?? usuario },
  };
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
