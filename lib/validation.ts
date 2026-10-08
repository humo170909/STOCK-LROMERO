import { z } from "zod";

// Autenticación real (Supabase Auth): "usuario" es el correo con el que se inició sesión.
export const loginSchema = z.object({
  usuario: z.string().trim().email("Ingresa un correo válido."),
  password: z.string().min(1, "Ingresa tu contraseña."),
  remember: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;
