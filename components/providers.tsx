"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "rounded-xl border border-slate-200 bg-white shadow-lg",
            title: "text-sm font-medium text-navy-900",
            description: "text-sm text-slate-500",
          },
        }}
      />
    </NuqsAdapter>
  );
}
