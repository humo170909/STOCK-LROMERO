import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="max-w-sm text-center">
        <p className="font-display text-5xl font-semibold text-navy-900">404</p>
        <h1 className="mt-3 text-lg font-semibold text-navy-900">Página no encontrada</h1>
        <p className="mt-1 text-sm text-slate-500">
          La página no existe o no tienes permiso para verla.
        </p>
        <Link href="/dashboard" className={buttonVariants({ className: "mt-5" })}>
          Ir al Dashboard
        </Link>
      </div>
    </main>
  );
}
