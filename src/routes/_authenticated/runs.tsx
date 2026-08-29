import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Play, Loader2, ChevronRight, Trash2, Coins, Timer, Cpu, CheckCircle2, XCircle, MinusCircle,
  RotateCcw, Lock,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { useWorkflows } from "@/lib/hooks/use-entities";
import { listRuns, runWorkflow, deleteRun, retryRun } from "@/lib/data/runs.functions";
import { checkPlanEnforcement, recordUsage } from "@/lib/data/billing.functions";

export const Route = createFileRoute("/_authenticated/runs")({
  head: () => ({
    meta: [
      { title: "Runs — Live workflow execution | Harness" },
      {
        name: "description",
        content:
          "Execute harness workflows against live models, stream every stage's output and persist the full execution trace with tokens, latency and cost.",
      },
      { property: "og:title", content: "Runs — Live workflow execution | Harness" },
      {
        property: "og:description",
        content: "Run agent workflows in production and inspect per-node traces, tokens, latency and cost.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RunsView,
});

interface Step {
  nodeId: string;
  label: string;
  typeName: string;
  status: "ok" | "error" | "skipped";
  output: string;
  tokens: number;
  latencyMs: number;
  costUsd: number;
  attempts?: number;
}

const money = (n: number) => `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;

function StepIcon({ status }: { status: Step["status"] }) {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />;
  if (status === "error") return <XCircle className="h-3.5 w-3.5 text-[#EF4444]" />;
  return <MinusCircle className="h-3.5 w-3.5 text-[var(--text-muted)]" />;
}

function RunsView() {
  const qc = useQueryClient();
  const { data: workflows = [] } = useWorkflows();
  const fetchRuns = useServerFn(listRuns);
  const execute = useServerFn(runWorkflow);
  const removeRun = useServerFn(deleteRun);
  const retry = useServerFn(retryRun);

  const [workflowId, setWorkflowId] = useState("");
  const [input, setInput] = useState(
    "Summarise our Q3 support tickets and recommend three product fixes.",
  );
  const [open, setOpen] = useState<string | null>(null);

  const runsQuery = useQuery({ queryKey: ["workflow-runs"], queryFn: () => fetchRuns() });
  const runs = runsQuery.data ?? [];

  const selected = workflowId || workflows[0]?.id || "";

  const checkPlan = useServerFn(checkPlanEnforcement);
  const bumpUsage = useServerFn(recordUsage);

  const runMutation = useMutation({
    mutationFn: async () => {
      const enforcement = await checkPlan({ data: { runs: 1 } });
      if (!enforcement.allowed) {
        const first = enforcement.blocking[0];
        throw new Error(`Plan limit reached: ${first?.reason ?? "upgrade required"}`);
      }
      const row = await execute({ data: { workflowId: selected, input } });
      await bumpUsage({ data: { runs: 1, tokens: row.total_tokens ?? 0, cost_usd: row.cost_usd ?? 0 } });
      return row;
    },
    onSuccess: (row) => {
      toast.success(
        row.status === "succeeded" ? "Run finished" : "Run failed",
        { description: `${row.workflow_name} · ${row.total_tokens} tokens · ${row.latency_ms} ms` },
      );
      setOpen(row.id);
      qc.invalidateQueries({ queryKey: ["workflow-runs"] });
      qc.invalidateQueries({ queryKey: ["usage-meters"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Run failed"),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => retry({ data: { id } }),
    onSuccess: (row) => {
      toast[row.status === "succeeded" ? "success" : "error"](
        row.status === "succeeded" ? "Retry succeeded" : "Retry failed again",
        { description: `${row.workflow_name} · ${row.total_tokens} tokens · ${row.latency_ms} ms` },
      );
      setOpen(row.id);
      qc.invalidateQueries({ queryKey: ["workflow-runs"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Retry failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRun({ data: { id } }),
    onSuccess: () => {
      toast("Run deleted");
      qc.invalidateQueries({ queryKey: ["workflow-runs"] });
    },
  });

  const stats = useMemo(() => {
    const ok = runs.filter((r) => r.status === "succeeded").length;
    return {
      total: runs.length,
      successRate: runs.length ? Math.round((ok / runs.length) * 100) : 0,
      tokens: runs.reduce((s, r) => s + (r.total_tokens ?? 0), 0),
      spend: runs.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0),
      p50: runs.length
        ? Math.round([...runs].sort((a, b) => a.latency_ms - b.latency_ms)[Math.floor(runs.length / 2)].latency_ms)
        : 0,
    };
  }, [runs]);

  return (
    <div>
      <PageHeader
        title="Runs"
        subtitle="Execute saved harness workflows against live models and keep the full trace"
        actions={
          <button
            onClick={() => {
              if (!selected) { toast.error("Save a workflow on the Harness canvas first"); return; }
              if (!input.trim()) { toast.error("Add an input prompt"); return; }
              runMutation.mutate();
            }}
            disabled={runMutation.isPending}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium disabled:opacity-60"
          >
            {runMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</>
              : <><Play className="h-3.5 w-3.5" /> Run live</>}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Runs (last 25)", value: String(stats.total), Icon: Play },
          { label: "Success rate", value: `${stats.successRate}%`, Icon: CheckCircle2 },
          { label: "Tokens used", value: stats.tokens.toLocaleString(), Icon: Cpu },
          { label: "Median latency", value: `${stats.p50} ms`, Icon: Timer },
          { label: "Spend", value: money(stats.spend), Icon: Coins },
        ].slice(0, 4).map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
              <s.Icon className="h-3 w-3" /> {s.label}
            </div>
            <div className="mt-2 text-[22px] font-semibold tracking-tight">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 mb-8">
        <SectionHeader title="New execution" />
        <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
          <select
            value={selected}
            onChange={(e) => setWorkflowId(e.target.value)}
            className="h-10 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] px-3 text-[13px]"
          >
            {workflows.length === 0 && <option value="">No saved workflows</option>}
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="What should this workflow do?"
            className="rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] px-3 py-2 text-[13px] resize-y"
          />
        </div>
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">
          Every node runs in topological order; each stage receives the previous stage's output. Tokens,
          latency and cost are recorded per node. Transient gateway failures are retried automatically
          with exponential backoff, and any failed run can be replayed from history.
        </p>
      </div>

      <SectionHeader title="Execution history" />
      <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
        {runsQuery.isLoading && (
          <div className="p-6 text-[13px] text-[var(--text-secondary)]">Loading runs…</div>
        )}
        {!runsQuery.isLoading && runs.length === 0 && (
          <div className="p-6 text-[13px] text-[var(--text-secondary)]">
            No runs yet — pick a workflow above and hit “Run live”.
          </div>
        )}
        {runs.map((run) => {
          const steps = (Array.isArray(run.steps) ? run.steps : []) as unknown as Step[];
          const isOpen = open === run.id;
          return (
            <div key={run.id} className="border-b border-[var(--border-default)] last:border-b-0">
              <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-surface)]">
                <button
                  onClick={() => setOpen(isOpen ? null : run.id)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                  <span className="text-[13px] font-medium">{run.workflow_name}</span>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      run.status === "succeeded"
                        ? "text-[#22C55E] bg-[#22C55E]/10"
                        : "text-[#EF4444] bg-[#EF4444]/10"
                    }`}
                  >
                    {run.status}
                  </span>
                  <span className="ml-auto flex items-center gap-4 text-[11px] text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" />{run.total_tokens}</span>
                    <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" />{run.latency_ms} ms</span>
                    <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" />{money(Number(run.cost_usd))}</span>
                  </span>
                </button>
                {run.status !== "succeeded" && (
                  <button
                    onClick={() => retryMutation.mutate(run.id)}
                    disabled={retryMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
                    aria-label={`Retry run of ${run.workflow_name}`}
                  >
                    {retryMutation.isPending && retryMutation.variables === run.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Retry
                  </button>
                )}
                <button
                  onClick={() => deleteMutation.mutate(run.id)}
                  className="p-1.5 rounded text-[var(--text-muted)] hover:text-[#EF4444]"
                  aria-label={`Delete run of ${run.workflow_name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-[var(--bg-base)]"
                  >
                    <div className="p-4 space-y-3">
                      <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Input</div>
                      <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap">{run.input}</p>
                      {steps.map((s, i) => (
                        <div
                          key={`${s.nodeId}-${i}`}
                          className="rounded-md border border-[var(--border-default)] p-3"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <StepIcon status={s.status} />
                            <span className="text-[12px] font-medium">{s.label}</span>
                            <span className="text-[10px] text-[var(--text-muted)]">{s.typeName}</span>
                            <span className="ml-auto text-[11px] text-[var(--text-secondary)]">
                              {s.tokens} tok · {s.latencyMs} ms
                              {typeof s.attempts === "number" && s.attempts > 1
                                ? ` · ${s.attempts} attempts`
                                : ""}
                            </span>
                          </div>
                          <pre className="text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap font-sans">
                            {s.output}
                          </pre>
                        </div>
                      ))}
                      {run.output && (
                        <div className="rounded-md border border-[var(--border-strong)] p-3">
                          <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-2">
                            Final output
                          </div>
                          <pre className="text-[13px] whitespace-pre-wrap font-sans">{run.output}</pre>
                        </div>
                      )}
                      {run.error && (
                        <p className="text-[12px] text-[#EF4444]">{run.error}</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
