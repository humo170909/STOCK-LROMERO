import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 pointer-coarse:h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm pointer-coarse:text-base text-slate-900 outline-none placeholder:text-slate-400",
        "focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/20",
        "aria-[invalid=true]:border-danger-500",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm pointer-coarse:text-base text-slate-900 outline-none placeholder:text-slate-400",
        "focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/20",
        className,
      )}
      {...props}
    />
  );
}
