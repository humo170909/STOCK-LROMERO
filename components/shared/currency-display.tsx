import { cn } from "@/lib/utils";

const formatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return formatter.format(value);
}

export function CurrencyDisplay({
  value,
  className,
  signed = false,
}: {
  value: number;
  className?: string;
  signed?: boolean;
}) {
  const text = formatCurrency(Math.abs(value));
  const prefix = signed && value !== 0 ? (value > 0 ? "+" : "−") : "";
  return <span className={cn("tabular-nums", className)}>{prefix}{text}</span>;
}
