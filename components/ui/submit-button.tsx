"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type SubmitStatus = "idle" | "loading" | "success" | "error";

const LABELS: Record<SubmitStatus, string> = {
  idle: "INGRESAR",
  loading: "VERIFICANDO",
  success: "ACCESO CONCEDIDO",
  error: "INTENTAR DE NUEVO",
};

function StatusIcon({ status }: { status: SubmitStatus }) {
  if (status === "loading")
    return (
      <LoaderCircle
        aria-hidden
        className="size-4.5 animate-[spin_0.7s_linear_infinite]"
        strokeWidth={2.5}
      />
    );
  if (status === "success")
    return <Check aria-hidden className="size-4.5" strokeWidth={3} />;
  if (status === "error")
    return <TriangleAlert aria-hidden className="size-4.5" strokeWidth={2.5} />;
  return null;
}

export function SubmitButton({ status }: { status: SubmitStatus }) {
  const busy = status === "loading";
  const done = status === "success";

  return (
    <button
      type="submit"
      aria-disabled={busy || done}
      aria-busy={busy}
      onClick={(event) => {
        if (busy || done) event.preventDefault();
      }}
      className={cn(
        "group/btn relative flex h-13 w-full items-center justify-center overflow-hidden rounded-[14px]",
        "bg-linear-to-b from-amber-300 to-amber-400 text-navy-950",
        "font-display text-(length:--login-btn) font-bold tracking-[0.1em]",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_14px_26px_-12px_rgb(246_183_60/0.75),0_2px_0_rgb(160_104_8/0.35)]",
        "transition-[transform,translate,scale,filter,box-shadow] duration-150 ease-out",
        "active:scale-[0.98] active:brightness-95",
        "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-white",
        "[@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:brightness-105",
        "[@media(hover:hover)]:hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_18px_30px_-12px_rgb(246_183_60/0.85),0_2px_0_rgb(160_104_8/0.35)]",
        (busy || done) && "cursor-default",
        busy && "brightness-95",
        done && "from-[#8be0a4] to-[#5fc984] [@media(hover:hover)]:hover:translate-y-0",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 ease-out-expo [@media(hover:hover)]:group-hover/btn:translate-x-[420%]"
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className="inline-flex items-center gap-2.5"
        >
          <StatusIcon status={status} />
          {LABELS[status]}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
