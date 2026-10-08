"use client";

import { endOfDay, format, parseISO } from "date-fns";

export function DateRangePicker({
  desde,
  hasta,
  onChange,
}: {
  desde: Date;
  hasta: Date;
  onChange: (rango: { desde: Date; hasta: Date }) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        aria-label="Desde"
        value={format(desde, "yyyy-MM-dd")}
        max={format(hasta, "yyyy-MM-dd")}
        onChange={(e) => e.target.value && onChange({ desde: parseISO(e.target.value), hasta })}
        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none focus-visible:border-brand-500"
      />
      <span className="text-sm text-slate-400">–</span>
      <input
        type="date"
        aria-label="Hasta"
        value={format(hasta, "yyyy-MM-dd")}
        min={format(desde, "yyyy-MM-dd")}
        onChange={(e) => e.target.value && onChange({ desde, hasta: endOfDay(parseISO(e.target.value)) })}
        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none focus-visible:border-brand-500"
      />
    </div>
  );
}
