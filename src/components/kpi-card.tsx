import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "default" | "ok" | "warn" | "alert" | "info";

const toneText: Record<Tone, string> = {
  default: "text-foreground",
  ok: "text-ok",
  warn: "text-warn",
  alert: "text-alert",
  info: "text-info",
};

export function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold", toneText[tone])}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
