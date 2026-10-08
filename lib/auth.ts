/**
 * Mensajes de error de autenticación. La verificación de credenciales ocurre
 * contra Supabase Auth en app/login/actions.ts (supabase.auth.signInWithPassword
 * con el cliente de lib/supabase/server.ts) — este módulo solo centraliza los
 * textos que se muestran en el formulario.
 */
export type AuthErrorCode = "invalid_credentials" | "network" | "inactive";

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials:
    "El correo o la contraseña no coinciden. Revisa tus datos e inténtalo de nuevo.",
  inactive: "Tu usuario está desactivado. Pide al administrador que lo active.",
  network:
    "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo otra vez.",
};
