import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatusDot } from "@/components/ui/status-badge";

const stats = [
  ["Total traces (24h)", "184,222"],
  ["p50 latency", "212ms"],
  ["p95 latency", "618ms"],
  ["Error rate", "0.42%"],
];

const spans = Array.from({ length: 10 }).map((_, i) => ({
  id: `trc_${(i + 1).toString().padStart(4, "0")}`,
  service: ["planner.decompose", "retriever.dense", "tools.sql", "evaluator.score", "memory.write", "planner.reflect", "retriever.rerank", "tools.api", "evaluator.judge", "memory.read"][i],
  duration: 80 + (i * 73) % 720,
  status: i === 3 ? "error" : "active",
}));
const maxDur = Math.max(...spans.map((s) => s.duration));

export const Route = createFileRoute("/observability")({
  head: () => ({ meta: [{ title: "Observability — Harness" }] }),
  component: () => (
    <>
      <PageHeader title="Observability" subtitle="Distributed traces across every agent invocation" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{k}</div>
            <div className="mt-1 text-[22px] font-semibold font-mono-tabular">{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <SectionHeader title="Recent trace spans" />
        <div className="space-y-2">
          {spans.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 text-[12px]">
              <span className="font-mono-tabular text-[11px] text-[var(--text-muted)] w-20">{s.id}</span>
              <StatusDot status={s.status} />
              <span className="w-44 font-mono-tabular text-[var(--text-secondary)] truncate">{s.service}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className={s.status === "error" ? "h-full bg-[var(--danger)]" : "h-full bg-gradient-to-r from-[var(--accent)] to-[var(--violet)]"}
                  style={{ width: `${(s.duration / maxDur) * 100}%`, animationDelay: `${i * 30}ms` }}
                />
              </div>
              <span className="w-16 text-right font-mono-tabular">{s.duration}ms</span>
            </div>
          ))}
        </div>
      </div>
    </>
  ),
});
