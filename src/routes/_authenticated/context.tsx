import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { agents } from "@/lib/data/synthetic";
import { toast } from "sonner";
import { Minimize2 } from "lucide-react";

const MAX = 128000;
const initial = agents.slice(0, 8).map((a, i) => ({
  id: a.id,
  name: a.name,
  used: 4000 + ((i * 1213) % 90000),
  max: MAX,
}));

export const Route = createFileRoute("/_authenticated/context")({
  head: () => ({
    meta: [
      { title: "Context — Harness" },
      { name: "description", content: "Live context windows across every active agent." },
    ],
  }),
  component: ContextPage,
});

function ContextPage() {
  const [windows, setWindows] = useState(initial);

  const totalUsed = windows.reduce((s, w) => s + w.used, 0);
  const totalMax = windows.length * MAX;
  const pctUsed = totalMax ? (totalUsed / totalMax) * 100 : 0;

  const compact = (id: string) => {
    setWindows((ws) => ws.map((w) => {
      if (w.id !== id) return w;
      const saved = Math.round(w.used * 0.38);
      toast.success(`Compacted ${w.name}`, { description: `${saved.toLocaleString()} tokens reclaimed` });
      return { ...w, used: w.used - saved };
    }));
  };

  const compactAll = () => {
    setWindows((ws) => ws.map((w) => ({ ...w, used: Math.round(w.used * 0.62) })));
    toast.success("Compacted all context windows", { description: "Episodic summaries applied fleet-wide" });
  };

  return (
    <>
      <PageHeader
        title="Context"
        subtitle="Live context windows across every active agent"
        actions={
          <button
            onClick={compactAll}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            <Minimize2 className="h-3.5 w-3.5" /> Compact all
          </button>
        }
      />

      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Aggregate token usage" />
          <span className="text-[12px] text-[var(--text-secondary)] font-mono-tabular">
            {totalUsed.toLocaleString()} / {totalMax.toLocaleString()} tokens
          </span>
        </div>
        <div className="h-3 rounded-full bg-[var(--bg-elevated)] overflow-hidden flex">
          <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--violet)] transition-all duration-500" style={{ width: `${pctUsed}%` }} />
          <div className="bg-[color:rgb(245_158_11_/_0.4)]" style={{ width: "9%" }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-5 text-[11px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> Active {pctUsed.toFixed(0)}%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--warning)]" /> Reserved 9%</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)]" /> Free {Math.max(0, 91 - pctUsed).toFixed(0)}%</span>
        </div>
      </div>

      <SectionHeader title="Per-agent windows" />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
        {windows.map((w) => {
          const pct = (w.used / w.max) * 100;
          return (
            <div key={w.id} className="px-5 py-3 flex flex-wrap items-center gap-4">
              <div className="w-32 font-medium text-[13px] truncate">{w.name}</div>
              <div className="flex-1 min-w-[120px] h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--violet)] transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="w-44 text-right text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                {w.used.toLocaleString()} / {w.max.toLocaleString()}
              </div>
              <div className="w-12 text-right text-[12px] font-mono-tabular">{pct.toFixed(0)}%</div>
              <button
                onClick={() => compact(w.id)}
                className="h-7 px-2.5 rounded-md border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
              >
                Compact
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
