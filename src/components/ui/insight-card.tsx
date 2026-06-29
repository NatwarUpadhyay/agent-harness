import { cn } from "@/lib/utils";

export function InsightCard({
  category,
  text,
  timestamp,
  tone = "blue",
}: {
  category: string;
  text: string;
  timestamp: string;
  tone?: "blue" | "violet" | "teal" | "amber";
}) {
  const toneMap = {
    blue:   "text-[var(--text-accent)] bg-[var(--accent-muted)]",
    violet: "text-[var(--violet)] bg-[color:rgb(139_92_246_/_0.12)]",
    teal:   "text-[var(--teal)] bg-[color:rgb(20_184_166_/_0.12)]",
    amber:  "text-[var(--warning)] bg-[color:rgb(245_158_11_/_0.10)]",
  };
  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-medium", toneMap[tone])}>
          {category}
        </span>
        <span className="text-[10px] text-[var(--text-muted)] font-mono-tabular">{timestamp}</span>
      </div>
      <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{text}</p>
    </div>
  );
}
