"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  icon: ReactNode;
  error?: string;
  /** Elemento al final del campo (por ejemplo el botón de mostrar contraseña). */
  trailing?: ReactNode;
  /** Texto de ayuda adicional enlazado con aria-describedby. */
  hint?: ReactNode;
  hintId?: string;
};

export function TextField({
  label,
  icon,
  error,
  trailing,
  hint,
  hintId,
  className,
  "aria-describedby": describedBy,
  ref,
  ...props
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const describedIds =
    [error ? errorId : null, hint ? hintId : null, describedBy]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="type-label text-ice-100">
        {label}
      </label>

      <div
        className={cn(
          "group relative mt-2 flex h-12 items-center overflow-hidden rounded-[14px] border bg-white",
          "border-white shadow-[inset_0_1px_2px_rgb(10_40_100/0.10),0_6px_14px_-8px_rgb(3_16_50/0.6)]",
          "transition-[border-color,box-shadow] duration-200 ease-out",
          "has-[input:focus]:border-brand-500 has-[input:focus]:shadow-[0_0_0_3px_var(--color-ring-sky)]",
          error &&
            "border-danger-500 has-[input:focus]:border-danger-500 has-[input:focus]:shadow-[0_0_0_3px_rgb(255_208_208/0.85)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3.5 text-slate-500 transition-colors duration-200",
            "group-has-[input:focus]:text-brand-600",
          )}
        >
          {icon}
        </span>

        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedIds}
          className={cn(
            "h-full w-full min-w-0 bg-transparent pl-11 text-(length:--login-input) text-slate-900 outline-none",
            "placeholder:text-slate-500",
            trailing ? "pr-12 pointer-coarse:pr-14" : "pr-4",
            className,
          )}
          {...props}
        />

        {trailing ? (
          <div className="absolute right-1.5 flex items-center">{trailing}</div>
        ) : null}

        {/* Línea de foco: entra desde la izquierda. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-brand-500",
            "transition-transform duration-300 ease-out-expo group-has-[input:focus]:scale-x-100",
            error && "bg-danger-500",
          )}
        />
      </div>

      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="error"
            id={errorId}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-start gap-1.5 overflow-hidden pt-2 text-(length:--login-label) font-medium leading-snug tracking-[0.01em] text-danger-200"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </motion.p>
        ) : null}
      </AnimatePresence>

      {hint}
    </div>
  );
}
