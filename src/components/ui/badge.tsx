import { cn } from "@/lib/utils";

const toneClasses: Record<string, string> = {
  ok: "bg-ok/15 text-ok border-ok/30",
  warn: "bg-warn/15 text-warn border-warn/30",
  alert: "bg-alert/15 text-alert border-alert/30",
  info: "bg-info/15 text-info border-info/30",
  neutral: "bg-neutral/15 text-neutral border-neutral/30",
  primary: "bg-primary/15 text-primary border-primary/30",
};

export function Badge({
  tone = "neutral",
  className,
  title,
  children,
}: {
  tone?: string;
  className?: string;
  /**
   * Hover text. A badge label has room for two or three words, so anything
   * that needs a sentence — which of two things a count refers to, why a
   * state is what it is — belongs here rather than in a longer label.
   */
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        toneClasses[tone] ?? toneClasses.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}
