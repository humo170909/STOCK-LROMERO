"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EmpresaTab } from "./empresa-tab";
import { SistemaTab } from "./sistema-tab";
import { SedesTab } from "./sedes-tab";
import { ComprobantesTab } from "./comprobantes-tab";
import { BackupsTab } from "./backups-tab";

type TabId = "empresa" | "sistema" | "sedes" | "comprobantes" | "backups";

const TABS: { id: TabId; label: string }[] = [
  { id: "empresa", label: "Empresa" },
  { id: "sistema", label: "Sistema" },
  { id: "sedes", label: "Sedes" },
  { id: "comprobantes", label: "Numeración" },
  { id: "backups", label: "Backups" },
];

export function ConfiguracionView() {
  const [tab, setTab] = useState<TabId>("empresa");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">Configuración</h1>
        <p className="text-sm text-slate-500">Empresa, sistema, sedes y numeración.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-medium",
              tab === t.id ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "empresa" ? <EmpresaTab /> : null}
      {tab === "sistema" ? <SistemaTab /> : null}
      {tab === "sedes" ? <SedesTab /> : null}
      {tab === "comprobantes" ? <ComprobantesTab /> : null}
      {tab === "backups" ? <BackupsTab /> : null}
    </div>
  );
}
