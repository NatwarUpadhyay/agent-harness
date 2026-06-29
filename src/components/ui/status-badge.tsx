import { cn } from "@/lib/utils";

type Variant = "active" | "idle" | "error" | "running" | "completed" | "stopped" | "healthy" | "degraded" | "down" | "pending";

const styles: Record<Variant, { dot: string; text: string; bg: string }> = {
  active:    { dot: "bg-[var(--success)]", text: "text-[var(--success)]", bg: "bg-[color:rgb(34_197_94_/_0.10)]" },
  healthy:   { dot: "bg-[var(--success)]", text: "text-[var(--success)]", bg: "bg-[color:rgb(34_197_94_/_0.10)]" },
  completed: { dot: "bg-[var(--success)]", text: "text-[var(--success)]", bg: "bg-[color:rgb(34_197_94_/_0.10)]" },
  running:   { dot: "bg-[var(--accent)]",  text: "text-[var(--text-accent)]", bg: "bg-[var(--accent-muted)]" },
  pending:   { dot: "bg-[var(--accent)]",  text: "text-[var(--text-accent)]", bg: "bg-[var(--accent-muted)]" },
  idle:      { dot: "bg-[var(--text-muted)]", text: "text-[var(--text-secondary)]", bg: "bg-[var(--bg-elevated)]" },
  stopped:   { dot: "bg-[var(--text-muted)]", text: "text-[var(--text-secondary)]", bg: "bg-[var(--bg-elevated)]" },
  degraded:  { dot: "bg-[var(--warning)]", text: "text-[var(--warning)]", bg: "bg-[color:rgb(245_158_11_/_0.10)]" },
  error:     { dot: "bg-[var(--danger)]",  text: "text-[var(--danger)]",  bg: "bg-[color:rgb(239_68_68_/_0.10)]" },
  down:      { dot: "bg-[var(--danger)]",  text: "text-[var(--danger)]",  bg: "bg-[color:rgb(239_68_68_/_0.10)]" },
};

export function StatusBadge({ status, className }: { status: Variant | string; className?: string }) {
  const s = styles[(status as Variant)] ?? styles.idle;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-medium capitalize", s.bg, s.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {status}
    </span>
  );
}

export function StatusDot({ status }: { status: Variant | string }) {
  const s = styles[(status as Variant)] ?? styles.idle;
  return <span className={cn("inline-block h-2 w-2 rounded-full", s.dot)} />;
}
