import Link from "next/link";
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
  href,
  dense,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  href?: string;
  /**
   * Secondary reference metric: same card, smaller type.
   *
   * A grid of equally loud cards makes the reader compare all of them to find
   * the one that matters. Where a ranked panel already states what needs
   * action, these are the supporting numbers and should not compete with it.
   */
  dense?: boolean;
}) {
  const inner = (
    <Card className={dense ? "p-3" : "p-4"}>
      {/* A long single-word label ("recommendations") has no break opportunity
          and runs past the card edge, which is easiest to hit in the dense
          variant. Let it hyphenate rather than overflow. */}
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground [hyphens:auto] break-words">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-semibold tabular-nums",
          dense ? "text-lg" : "text-2xl",
          toneText[tone],
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      {inner}
    </Link>
  );
}
