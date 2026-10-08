"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowBigUp,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  TriangleAlert,
} from "lucide-react";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth";
import { iniciarSesion } from "@/app/login/actions";
import {
  removeSavedUser,
  saveUser,
  useSavedUsers,
  type SavedUser,
} from "@/lib/saved-users";
import { loginSchema, type LoginValues } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton, type SubmitStatus } from "@/components/ui/submit-button";
import { SavedUsers } from "./saved-users";
import { itemVariants } from "./motion";

const linkClass =
  "type-label inline-flex items-center whitespace-nowrap rounded-md pointer-coarse:min-h-11 text-ice-100 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

// Un campo que pierde el foco porque la ventana o pestaña se desenfocó no cuenta como "tocado".
const isPageFocused = () => document.hasFocus();

export function LoginForm() {
  const router = useRouter();
  const savedUsers = useSavedUsers();
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const {
    register,
    handleSubmit,
    setFocus,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { usuario: "", password: "", remember: false },
    mode: "onTouched",
  });

  const resetFeedback = () => {
    setFormError(null);
    setStatus((current) => (current === "error" ? "idle" : current));
  };

  const onSubmit = async (values: LoginValues) => {
    setStatus("loading");
    setFormError(null);

    let result: Awaited<ReturnType<typeof iniciarSesion>>;
    try {
      result = await iniciarSesion({
        usuario: values.usuario,
        password: values.password,
      });
    } catch {
      setStatus("error");
      setFormError(AUTH_ERROR_MESSAGES.network);
      return;
    }

    if (result.ok) {
      if (values.remember) saveUser(result.user);
      setStatus("success");
      setTimeout(() => router.push("/dashboard"), 550);
      return;
    }

    setStatus("error");
    setFormError(AUTH_ERROR_MESSAGES[result.code]);
    setShaking(true);
    setValue("password", "");
    setFocus("password");
  };

  const selectSavedUser = (user: SavedUser) => {
    setValue("usuario", user.usuario, { shouldValidate: true });
    setValue("remember", true);
    clearErrors();
    resetFeedback();
    setFocus("password");
  };

  const trackCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState("CapsLock"));
  };

  const passwordRegistration = register("password", { onChange: resetFeedback });
  const usuarioRegistration = register("usuario", { onChange: resetFeedback });

  return (
    <div className="flex w-full flex-col">
      <motion.div variants={itemVariants}>
        <h1 className="font-display text-(length:--login-h1) font-bold leading-[1.08] tracking-[-0.03em] text-white text-balance">
          Bienvenido de nuevo
        </h1>
        <p className="mt-2 text-(length:--login-sub) leading-[1.5] tracking-[0.005em] text-ice-200">
          Ingresa con tu cuenta corporativa.
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className={savedUsers.length > 0 ? "mt-8 max-sm:mt-6" : undefined}>
        <SavedUsers
          users={savedUsers}
          onSelect={selectSavedUser}
          onRemove={removeSavedUser}
        />
      </motion.div>

      <div
        className={cn(savedUsers.length > 0 ? "mt-5" : "mt-8 max-sm:mt-6", shaking && "animate-shake")}
        onAnimationEnd={() => setShaking(false)}
      >
        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          aria-describedby={formError ? "form-error" : undefined}
          className="flex flex-col"
        >
          <motion.div variants={itemVariants}>
            <TextField
              label="Correo electrónico"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="tucorreo@grupolromero.com"
              icon={<Mail className="size-4.5" strokeWidth={1.5} />}
              error={errors.usuario?.message}
              {...usuarioRegistration}
              onBlur={(event) => {
                if (!isPageFocused()) return;
                void usuarioRegistration.onBlur(event);
              }}
            />
          </motion.div>

          <motion.div variants={itemVariants} className="mt-5">
            <TextField
              label="Contraseña"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              enterKeyHint="go"
              placeholder="Tu contraseña"
              icon={<LockKeyhole className="size-4.5" strokeWidth={1.5} />}
              error={errors.password?.message}
              hintId="caps-hint"
              hint={
                <AnimatePresence initial={false}>
                  {capsLock ? (
                    <motion.p
                      key="caps"
                      id="caps-hint"
                      role="status"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-center gap-1.5 overflow-hidden pt-2 text-(length:--login-label) font-medium tracking-[0.01em] text-amber-300"
                    >
                      <ArrowBigUp aria-hidden className="size-4 shrink-0" />
                      Bloq Mayús está activado.
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              }
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="grid size-9 pointer-coarse:size-11 place-items-center rounded-[10px] text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden className="size-4.5" strokeWidth={1.5} />
                  ) : (
                    <Eye aria-hidden className="size-4.5" strokeWidth={1.5} />
                  )}
                </button>
              }
              onKeyDown={trackCapsLock}
              onKeyUp={trackCapsLock}
              {...passwordRegistration}
              onBlur={(event) => {
                setCapsLock(false);
                if (!isPageFocused()) return;
                void passwordRegistration.onBlur(event);
              }}
            />
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5"
          >
            <label className="inline-flex cursor-pointer select-none items-center whitespace-nowrap gap-2.5 pointer-coarse:min-h-11 type-label text-ice-100">
              <input
                type="checkbox"
                role="switch"
                aria-describedby="remember-note"
                className="peer sr-only"
                {...register("remember")}
              />
              <span
                aria-hidden
                className={cn(
                  "relative h-6 w-10 shrink-0 rounded-full bg-white/15 ring-1 ring-inset ring-white/45",
                  "transition-colors duration-200 ease-out",
                  "peer-checked:bg-amber-400 peer-checked:ring-amber-300",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white",
                  "[&>span]:absolute [&>span]:left-0.75 [&>span]:top-0.75 [&>span]:size-4.5 [&>span]:rounded-full [&>span]:bg-white",
                  "[&>span]:shadow-sm [&>span]:transition-[transform,translate,background-color] [&>span]:duration-200 [&>span]:ease-out-expo",
                  "peer-checked:[&>span]:translate-x-4 peer-checked:[&>span]:bg-navy-900",
                )}
              >
                <span />
              </span>
              Recordar usuario
              <span id="remember-note" className="sr-only">
                Se guarda solo tu nombre y correo en este equipo. Nunca la contraseña.
              </span>
            </label>

            <span className={linkClass}>
              ¿Olvidaste tu contraseña? Pide al administrador que la restablezca.
            </span>
          </motion.div>

          <AnimatePresence initial={false}>
            {formError ? (
              <motion.div
                key="form-error"
                id="form-error"
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <p className="mt-4 flex items-start gap-2.5 rounded-[14px] bg-danger-500/20 px-3.5 py-3 text-(length:--login-label) font-medium leading-snug tracking-[0.01em] text-danger-200 ring-1 ring-inset ring-danger-200/40">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {formError}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.div variants={itemVariants} className="mt-6">
            <SubmitButton status={status} />
          </motion.div>
        </form>
      </div>
    </div>
  );
}
