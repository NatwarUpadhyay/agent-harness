import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { agents } from "@/lib/data/synthetic";

const windows = agents.slice(0, 8).map((a, i) => ({
  ...a,
  used: 4000 + ((i * 1213) % 90000),
  max: 128000,
}));

export const Route = createFileRoute("/context")({
  head: () => ({ meta: [{ title: "Context — Harness" }] }),
  component: () => (
    <>
      <PageHeader title="Context" subtitle="Live context windows across every active agent" />

      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Aggregate token usage" />
          <span className="text-[12px] text-[var(--text-secondary)] font-mono-tabular">438,212 / 1,024,000 tokens</span>
        </div>
        <div className="h-3 rounded-full bg-[var(--bg-elevated)] overflow-hidden flex">
          <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--violet)]" style={{ width: "42%" }} />
          <div className="bg-[color:rgb(245_158_11_/_0.4)]" style={{ width: "9%" }} />
        </div>
        <div className="mt-3 flex items-center gap-5 text-[11px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> Active 42%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--warning)]" /> Reserved 9%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)]" /> Free 49%</span>
        </div>
      </div>

      <SectionHeader title="Per-agent windows" />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
        {windows.map((w) => {
          const pct = (w.used / w.max) * 100;
          return (
            <div key={w.id} className="px-5 py-3 flex items-center gap-4">
              <div className="w-32 font-medium text-[13px]">{w.name}</div>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--violet)]" style={{ width: `${pct}%` }} />
              </div>
              <div className="w-44 text-right text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                {w.used.toLocaleString()} / {w.max.toLocaleString()}
              </div>
              <div className="w-12 text-right text-[12px] font-mono-tabular">{pct.toFixed(0)}%</div>
            </div>
          );
        })}
      </div>
    </>
  ),
});
