import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Play, RotateCcw, Trash2, Square, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  useExperiments, successRate, avgLatency,
  type ExperimentRecord, type ExperimentVariant,
} from "@/lib/data/experiments-store";
import { formatCost } from "@/lib/data/harness-usage";

function StatCell({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
      <div className={`text-[15px] mt-0.5 ${mono ? "font-mono-tabular" : ""}`}>{value}</div>
    </div>
  );
}

function VariantCard({
  v, isWinner, planned,
}: { v: ExperimentVariant; isWinner: boolean; planned: number }) {
  const pct = planned ? Math.min(100, (v.result.trials / planned) * 100) : 0;
  return (
    <div className={`rounded-[10px] border p-4 transition-colors ${
      isWinner ? "border-[var(--accent)] bg-[var(--accent-muted)]/40" : "border-[var(--border-default)] bg-[var(--bg-elevated)]/30"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono-tabular px-1.5 py-0.5 rounded-sm bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
            Variant {v.key}
          </span>
          <span className="text-[13px] font-medium">{v.label}</span>
        </div>
        {isWinner && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-accent)]">
            <Trophy className="h-3 w-3" /> Winning
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <StatCell label="Success" value={`${successRate(v).toFixed(1)}%`} />
        <StatCell label="Latency" value={`${avgLatency(v)}ms`} />
        <StatCell label="Tokens"  value={v.result.totalTokens.toLocaleString()} />
        <StatCell label="Cost"    value={formatCost(v.result.totalCost)} />
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <motion.div
          className="h-full bg-[var(--accent)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.32, 1] }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-[var(--text-muted)] font-mono-tabular">
        {v.result.trials} / {planned} trials
      </div>
    </div>
  );
}

function ExperimentCard({ e }: { e: ExperimentRecord }) {
  const { runBatch, reset, remove, stop } = useExperiments();
  const [running, setRunning] = useState(false);

  const [a, b] = e.variants;
  const winner: "A" | "B" | null = useMemo(() => {
    if (a.result.trials < 5 || b.result.trials < 5) return null;
    const ra = successRate(a); const rb = successRate(b);
    if (Math.abs(ra - rb) < 1) return null;
    return ra > rb ? "A" : "B";
  }, [a, b]);

  const done = e.status === "completed";
  const stopped = e.status === "stopped";

  const handleRun = async () => {
    if (done || stopped) return;
    setRunning(true);
    // Simulated batches: do 4 batches of 5 trials with a short delay for feel.
    for (let i = 0; i < 4; i++) {
      runBatch(e.id, 5);
      await new Promise((r) => setTimeout(r, 220));
    }
    setRunning(false);
    toast.success(`Ran 20 trials on "${e.name}"`);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
    >
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[15px] font-semibold truncate">{e.name}</h3>
            <StatusBadge status={e.status} />
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2">{e.hypothesis}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleRun}
            disabled={running || done || stopped}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[12px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="h-3 w-3" /> {running ? "Running…" : done ? "Done" : "Run 20"}
          </button>
          {!done && !stopped && (
            <button
              onClick={() => { stop(e.id); toast("Experiment stopped"); }}
              className="grid place-items-center h-8 w-8 rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              title="Stop"
            >
              <Square className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => { reset(e.id); toast("Reset"); }}
            className="grid place-items-center h-8 w-8 rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            title="Reset"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            onClick={() => { remove(e.id); toast("Experiment deleted"); }}
            className="grid place-items-center h-8 w-8 rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <VariantCard v={a} isWinner={winner === "A"} planned={e.trialsPlanned} />
        <VariantCard v={b} isWinner={winner === "B"} planned={e.trialsPlanned} />
      </div>
    </motion.div>
  );
}

function NewExperimentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useExperiments();
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [trials, setTrials] = useState(20);
  const [labelA, setLabelA] = useState("Variant A");
  const [labelB, setLabelB] = useState("Variant B");
  const [rateA, setRateA] = useState(70);
  const [rateB, setRateB] = useState(75);
  const [latA, setLatA] = useState(800);
  const [latB, setLatB] = useState(700);

  if (!open) return null;

  const submit = () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    create({
      name: name.trim(),
      hypothesis: hypothesis.trim() || "—",
      trialsPlanned: Math.max(5, Math.min(200, trials)),
      variantA: { label: labelA.trim() || "Variant A", baseLatencyMs: latA, baseSuccessRate: rateA / 100 },
      variantB: { label: labelB.trim() || "Variant B", baseLatencyMs: latB, baseSuccessRate: rateB / 100 },
    });
    toast.success("Experiment created");
    onClose();
    setName(""); setHypothesis("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-[560px] rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold">New experiment</h2>
          <button onClick={onClose} className="grid place-items-center h-7 w-7 rounded-md hover:bg-[var(--bg-elevated)]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Support triage: gpt-4o vs claude"
              className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Hypothesis</label>
            <textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)}
              placeholder="What do you expect to happen?" rows={2}
              className="mt-1 w-full px-3 py-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Trials per variant: {trials}</label>
            <input type="range" min={10} max={100} step={5} value={trials} onChange={(e) => setTrials(Number(e.target.value))}
              className="mt-1 w-full accent-[var(--accent)]" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { key: "A", label: labelA, setLabel: setLabelA, rate: rateA, setRate: setRateA, lat: latA, setLat: setLatA },
              { key: "B", label: labelB, setLabel: setLabelB, rate: rateB, setRate: setRateB, lat: latB, setLat: setLatB },
            ].map((v) => (
              <div key={v.key} className="rounded-md border border-[var(--border-subtle)] p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Variant {v.key}</div>
                <input value={v.label} onChange={(e) => v.setLabel(e.target.value)}
                  className="w-full h-8 px-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[12px] focus:outline-none focus:border-[var(--accent)]" />
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Success rate: {v.rate}%</div>
                  <input type="range" min={30} max={99} value={v.rate} onChange={(e) => v.setRate(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Base latency: {v.lat}ms</div>
                  <input type="range" min={200} max={2000} step={50} value={v.lat} onChange={(e) => v.setLat(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="h-9 px-3 rounded-md text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]">Cancel</button>
          <button onClick={submit} className="h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]">Create</button>
        </div>
      </div>
    </div>
  );
}

function ExperimentsView() {
  const { experiments } = useExperiments();
  const [dialog, setDialog] = useState(false);

  const running = experiments.filter((e) => e.status === "running").length;
  const completed = experiments.filter((e) => e.status === "completed").length;
  const totalTrials = experiments.reduce((s, e) => s + e.variants[0].result.trials + e.variants[1].result.trials, 0);
  const totalCost = experiments.reduce((s, e) => s + e.variants[0].result.totalCost + e.variants[1].result.totalCost, 0);

  return (
    <>
      <PageHeader
        title="Experiments"
        subtitle="A/B test prompts, models, and pipelines side-by-side"
        actions={
          <button
            onClick={() => setDialog(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> New experiment
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Experiments</div>
          <div className="text-[22px] font-semibold mt-1 font-mono-tabular">{experiments.length}</div>
        </div>
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Running</div>
          <div className="text-[22px] font-semibold mt-1 font-mono-tabular">{running}</div>
        </div>
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Completed</div>
          <div className="text-[22px] font-semibold mt-1 font-mono-tabular">{completed}</div>
        </div>
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Trials · Cost</div>
          <div className="text-[15px] font-semibold mt-1 font-mono-tabular">
            {totalTrials.toLocaleString()} · {formatCost(totalCost)}
          </div>
        </div>
      </div>

      <SectionHeader title="All experiments" />
      <div className="space-y-3">
        <AnimatePresence>
          {experiments.map((e) => <ExperimentCard key={e.id} e={e} />)}
        </AnimatePresence>
        {experiments.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-[var(--border-default)] p-10 text-center text-[13px] text-[var(--text-muted)]">
            No experiments yet — create one to start comparing variants.
          </div>
        )}
      </div>

      <NewExperimentDialog open={dialog} onClose={() => setDialog(false)} />
    </>
  );
}

export const Route = createFileRoute("/_authenticated/experiments")({
  head: () => ({ meta: [{ title: "Experiments — Harness" }] }),
  component: ExperimentsView,
});
