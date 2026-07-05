import { useMemo, useState } from "react";
import { Play, GitCompareArrows, ShieldCheck, FileStack, Gauge, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { rubrics, datasets, evalRuns, scoreTone, delta, type EvalRun } from "@/lib/data/evals";
import { agents, relativeTime } from "@/lib/data/synthetic";

const rubricColor: Record<string, string> = {
  safety: "text-[var(--danger)]",
  quality: "text-[var(--accent)]",
  format: "text-[var(--text-primary)]",
  performance: "text-[var(--warning)]",
};

export function EvaluationsView() {
  const [datasetId, setDatasetId] = useState(datasets[0].id);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [detailRun, setDetailRun] = useState<EvalRun | null>(null);

  const filtered = useMemo(
    () => evalRuns.filter((r) => r.datasetId === datasetId),
    [datasetId],
  );

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id],
    );

  const totals = useMemo(() => {
    const runs = filtered.length || 1;
    const avgScore = filtered.reduce((a, r) => a + r.score, 0) / runs;
    const avgPass = filtered.reduce((a, r) => a + r.passRate, 0) / runs;
    const totalCases = filtered.reduce((a, r) => a + r.cases, 0);
    const critFails = filtered.filter((r) => r.score < 70).length;
    return { avgScore, avgPass, totalCases, critFails, runs: filtered.length };
  }, [filtered]);

  const compareRuns = selected
    .map((id) => evalRuns.find((r) => r.id === id))
    .filter(Boolean) as EvalRun[];

  return (
    <>
      <PageHeader
        title="Evaluations"
        subtitle="Run agents against curated datasets, score them by rubric, and compare candidates head-to-head"
        actions={
          <div className="flex items-center gap-2">
            <button
              disabled={selected.length !== 2}
              onClick={() => setCompareOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              Compare {selected.length === 2 ? "(2)" : `(${selected.length}/2)`}
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]">
              <Play className="h-3.5 w-3.5" /> New run
            </button>
          </div>
        }
      />

      {/* Dataset picker */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FileStack className="h-4 w-4 text-[var(--text-muted)]" />
        <span className="text-[12px] uppercase tracking-wider text-[var(--text-muted)] mr-2">Dataset</span>
        {datasets.map((d) => {
          const active = d.id === datasetId;
          return (
            <button
              key={d.id}
              onClick={() => { setDatasetId(d.id); setSelected([]); }}
              className={`h-8 px-3 rounded-md text-[12px] border transition-colors ${
                active
                  ? "bg-[var(--accent-muted)] border-[var(--accent)] text-[var(--text-primary)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
              }`}
            >
              {d.name}
              <span className="ml-2 font-mono-tabular text-[10px] text-[var(--text-muted)]">
                {d.rowCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          ["Runs", totals.runs.toString(), <Gauge key="g" className="h-3.5 w-3.5" />],
          ["Avg score", totals.avgScore.toFixed(1), <TrendingUp key="t" className="h-3.5 w-3.5 text-[var(--success)]" />],
          ["Avg pass rate", `${totals.avgPass.toFixed(1)}%`, <ShieldCheck key="s" className="h-3.5 w-3.5 text-[var(--success)]" />],
          ["Critical fails", totals.critFails.toString(), <TrendingDown key="d" className="h-3.5 w-3.5 text-[var(--danger)]" />],
        ].map(([k, v, icon]) => (
          <div key={k as string} className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              <span>{k}</span>
              {icon}
            </div>
            <div className="mt-1 text-[22px] font-semibold font-mono-tabular">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Runs table */}
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="flex items-center justify-between px-4 h-11 border-b border-[var(--border-subtle)]">
            <h3 className="text-[13px] font-medium">Runs</h3>
            <span className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
              select two rows to compare
            </span>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <th className="w-8" />
                <th className="text-left px-3 py-2 font-medium">Run</th>
                <th className="text-left px-3 py-2 font-medium">Agent</th>
                <th className="text-right px-3 py-2 font-medium">Score</th>
                <th className="text-right px-3 py-2 font-medium">Pass</th>
                <th className="text-right px-3 py-2 font-medium">Cases</th>
                <th className="text-right px-3 py-2 font-medium">Latency</th>
                <th className="text-right px-3 py-2 font-medium">Cost</th>
                <th className="text-right px-3 py-2 font-medium pr-4">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const agent = agents.find((a) => a.id === r.agentId);
                const checked = selected.includes(r.id);
                return (
                  <tr
                    key={r.id}
                    onClick={() => setDetailRun(r)}
                    className={`border-t border-[var(--border-subtle)] cursor-pointer transition-colors ${
                      checked ? "bg-[var(--accent-muted)]/50" : "hover:bg-[var(--bg-elevated)]/60"
                    }`}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(r.id)}
                        className="h-3.5 w-3.5 accent-[var(--accent)]"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium">{r.name}</td>
                    <td className="px-3 py-2.5 font-mono-tabular text-[12px] text-[var(--text-secondary)]">{agent?.name}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`inline-block font-mono-tabular text-[12px] px-1.5 py-0.5 rounded-sm ${scoreTone(r.score)}`}>
                        {r.score}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular text-[12px]">{r.passRate}%</td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular text-[12px] text-[var(--text-muted)]">{r.cases}</td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular text-[12px] text-[var(--text-muted)]">{r.avgLatencyMs}ms</td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular text-[12px] text-[var(--text-muted)]">${r.costUsd.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-[var(--text-muted)] pr-4">{relativeTime(r.startedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rubric panel */}
        <aside className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 h-fit sticky top-16">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium">Rubrics</h3>
            <span className="text-[10px] font-mono-tabular text-[var(--text-muted)]">weighted · 100%</span>
          </div>
          <ul className="space-y-3">
            {rubrics.map((rb) => (
              <li key={rb.id}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${rubricColor[rb.kind].replace("text-", "bg-")}`} />
                    <span className="font-medium">{rb.name}</span>
                  </span>
                  <span className="font-mono-tabular text-[10px] text-[var(--text-muted)]">
                    {Math.round(rb.weight * 100)}%
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">{rb.description}</p>
                <div className="mt-1.5 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)]"
                    style={{ width: `${rb.weight * 100 * 5}%`, maxWidth: "100%" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Run detail drawer */}
      {detailRun && (
        <Drawer onClose={() => setDetailRun(null)} title={detailRun.name}>
          <RunDetail run={detailRun} />
        </Drawer>
      )}

      {/* Compare drawer */}
      {compareOpen && compareRuns.length === 2 && (
        <Drawer onClose={() => setCompareOpen(false)} title="Compare runs" wide>
          <RunCompare a={compareRuns[0]} b={compareRuns[1]} />
        </Drawer>
      )}
    </>
  );
}

function Drawer({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${wide ? "w-[720px]" : "w-[520px]"} max-w-[95vw] h-full bg-[var(--bg-surface)] border-l border-[var(--border-strong)] overflow-y-auto`}
      >
        <div className="sticky top-0 bg-[var(--bg-surface)] flex items-center justify-between px-5 h-12 border-b border-[var(--border-subtle)]">
          <h2 className="text-[14px] font-medium">{title}</h2>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md hover:bg-[var(--bg-elevated)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function RunDetail({ run }: { run: EvalRun }) {
  const agent = agents.find((a) => a.id === run.agentId);
  const dataset = datasets.find((d) => d.id === run.datasetId);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Score", run.score.toString()],
          ["Pass rate", `${run.passRate}%`],
          ["Duration", `${run.durationSec}s`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{k}</div>
            <div className="mt-0.5 text-[20px] font-semibold font-mono-tabular">{v}</div>
          </div>
        ))}
      </div>
      <div className="text-[12px] text-[var(--text-secondary)] space-y-1">
        <div><span className="text-[var(--text-muted)]">Agent:</span> <span className="font-mono-tabular">{agent?.name}</span></div>
        <div><span className="text-[var(--text-muted)]">Dataset:</span> {dataset?.name} · <span className="font-mono-tabular">{dataset?.rowCount}</span> rows</div>
        <div><span className="text-[var(--text-muted)]">Cases:</span> <span className="font-mono-tabular">{run.passed} pass · {run.failed} fail</span></div>
      </div>
      <div>
        <h4 className="text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Per-rubric</h4>
        <ul className="space-y-2">
          {rubrics.map((rb) => {
            const s = run.perRubric[rb.id];
            return (
              <li key={rb.id} className="flex items-center gap-3">
                <span className="w-40 text-[12px] truncate">{rb.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    className={`h-full ${s >= rb.threshold ? "bg-[var(--success)]" : s >= rb.threshold - 10 ? "bg-[var(--warning)]" : "bg-[var(--danger)]"}`}
                    style={{ width: `${s}%` }}
                  />
                </div>
                <span className={`w-12 text-right font-mono-tabular text-[12px] px-1.5 py-0.5 rounded-sm ${scoreTone(s, rb.threshold)}`}>{s}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function RunCompare({ a, b }: { a: EvalRun; b: EvalRun }) {
  const agentA = agents.find((x) => x.id === a.agentId);
  const agentB = agents.find((x) => x.id === b.agentId);
  const row = (label: string, av: number, bv: number, suffix = "") => {
    const d = delta(bv, av);
    const tone = d.value > 0 ? "text-[var(--success)]" : d.value < 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]";
    const Icon = d.value > 0 ? TrendingUp : d.value < 0 ? TrendingDown : Minus;
    return (
      <tr className="border-t border-[var(--border-subtle)]">
        <td className="py-2 text-[12px]">{label}</td>
        <td className="py-2 text-right font-mono-tabular text-[12px]">{av.toFixed(1)}{suffix}</td>
        <td className="py-2 text-right font-mono-tabular text-[12px]">{bv.toFixed(1)}{suffix}</td>
        <td className={`py-2 text-right font-mono-tabular text-[12px] ${tone}`}>
          <span className="inline-flex items-center gap-1 justify-end">
            <Icon className="h-3 w-3" /> {d.label}
          </span>
        </td>
      </tr>
    );
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((r, i) => (
          <div key={r.id} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Run {String.fromCharCode(65 + i)}</div>
            <div className="text-[13px] font-medium mt-0.5">{r.name}</div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular mt-1">
              {(i === 0 ? agentA : agentB)?.name} · {relativeTime(r.startedAt)}
            </div>
          </div>
        ))}
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            <th className="text-left py-2 font-medium">Metric</th>
            <th className="text-right py-2 font-medium">A</th>
            <th className="text-right py-2 font-medium">B</th>
            <th className="text-right py-2 font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {row("Score", a.score, b.score)}
          {row("Pass rate", a.passRate, b.passRate, "%")}
          {row("Avg latency (ms)", a.avgLatencyMs, b.avgLatencyMs)}
          {row("Cost per call ($)", a.costUsd, b.costUsd)}
          {row("Cases", a.cases, b.cases)}
        </tbody>
      </table>
      <div>
        <h4 className="text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Per-rubric delta</h4>
        <ul className="space-y-1.5">
          {rubrics.map((rb) => {
            const av = a.perRubric[rb.id];
            const bv = b.perRubric[rb.id];
            const d = bv - av;
            const tone = d > 0 ? "text-[var(--success)]" : d < 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]";
            return (
              <li key={rb.id} className="flex items-center gap-3 text-[12px]">
                <span className="w-40 truncate">{rb.name}</span>
                <span className="w-10 text-right font-mono-tabular text-[var(--text-muted)]">{av}</span>
                <span className="w-10 text-right font-mono-tabular text-[var(--text-muted)]">{bv}</span>
                <span className={`flex-1 text-right font-mono-tabular ${tone}`}>{d >= 0 ? "+" : ""}{d}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
