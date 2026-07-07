import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X, Trash2, DollarSign } from "lucide-react";
import { useHarnessUsage, formatCost } from "@/lib/data/harness-usage";

export function UsagePanel() {
  const [open, setOpen] = useState(false);
  const { runs, totalRuns, totalCost, totalTokens, avgLatencyMs, costByType, clear } = useHarnessUsage();
  const recent = [...runs].reverse().slice(0, 12);
  const maxTypeCost = costByType[0]?.cost ?? 0;

  return (
    <>
      {/* Floating usage pill (bottom-right of canvas) */}
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]/90 backdrop-blur text-[11px] font-mono-tabular text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/50"
        title="Harness usage & cost"
      >
        <Activity className="h-3 w-3 text-[var(--accent)]" />
        <span>{totalRuns} runs</span>
        <span className="h-3 w-px bg-[var(--border-default)]" />
        <DollarSign className="h-3 w-3 text-[#22C55E]" />
        <span>{formatCost(totalCost)}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black/40" onClick={() => setOpen(false)}
            />
            <motion.aside
              key="panel"
              initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.32, 1] }}
              className="absolute top-0 right-0 h-full w-[360px] border-l border-[var(--border-default)] bg-[var(--bg-surface)] z-40 flex flex-col"
            >
              <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--border-default)]">
                <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Usage & cost</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={clear}
                    disabled={totalRuns === 0}
                    className="p-1 rounded hover:bg-white/5 text-[var(--text-secondary)] disabled:opacity-30"
                    title="Clear runs"
                  ><Trash2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/5 text-[var(--text-secondary)]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 gap-2 border-b border-[var(--border-default)]">
                <Kpi label="Runs" value={String(totalRuns)} />
                <Kpi label="Total cost" value={formatCost(totalCost)} accent="#22C55E" />
                <Kpi label="Tokens" value={totalTokens.toLocaleString()} />
                <Kpi label="Avg latency" value={`${avgLatencyMs}ms`} />
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Cost by node type</div>
                <div className="px-4 pb-4 space-y-2">
                  {costByType.length === 0 && (
                    <div className="text-[12px] text-[var(--text-muted)]">No runs yet — hit Simulate to record usage.</div>
                  )}
                  {costByType.map((t) => (
                    <div key={t.type}>
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span className="text-[var(--text-primary)]">{t.type}</span>
                        <span className="text-[var(--text-secondary)] font-mono-tabular">{formatCost(t.cost)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent)]"
                          style={{ width: `${maxTypeCost ? (t.cost / maxTypeCost) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 pt-2 pb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Recent runs</div>
                <div className="px-4 pb-4 space-y-1.5">
                  {recent.length === 0 && (
                    <div className="text-[12px] text-[var(--text-muted)]">History appears here after each simulation.</div>
                  )}
                  {recent.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-[var(--border-default)] px-2.5 py-1.5">
                      <div className="min-w-0">
                        <div className="text-[12px] text-[var(--text-primary)] truncate">{r.workflowName}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono-tabular">
                          {new Date(r.ts).toLocaleTimeString()} · {r.nodeCount}n · {r.totalTokens.toLocaleString()} tok · {r.totalLatencyMs}ms
                        </div>
                      </div>
                      <span className="text-[12px] font-mono-tabular text-[#22C55E] ml-2 shrink-0">{formatCost(r.totalCost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-md border border-[var(--border-default)] px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold font-mono-tabular" style={{ color: accent ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
