import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({ label = "Cargando…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-32 flex-col items-center justify-center gap-2.5 py-10 text-slate-500", className)}>
      <LoaderCircle aria-hidden className="size-5 animate-[spin_0.7s_linear_infinite] text-brand-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-100", className)} />;
}
