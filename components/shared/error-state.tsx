import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "No se pudo cargar la información",
  description = "Verifique su conexión e inténtelo nuevamente.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl py-10 text-center", className)}>
      <div className="grid size-11 place-items-center rounded-full bg-red-50 text-danger-500">
        <TriangleAlert aria-hidden className="size-5" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-navy-900">{title}</p>
      <p className="max-w-sm text-sm text-slate-500">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}
