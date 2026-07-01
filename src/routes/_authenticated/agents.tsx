import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Filter, Trash2, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusDot } from "@/components/ui/status-badge";
import { InlineBarStat } from "@/components/ui/inline-bar-stat";
import { relativeTime } from "@/lib/data/synthetic";
import {
  useAgents,
  useCreateAgent,
  useDeleteAgent,
  type AgentRow,
} from "@/lib/hooks/use-entities";
import { toast } from "sonner";

const MODELS = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"] as const;
const STATUSES = ["active", "idle", "error"] as const;
const FILTERS = ["All", "active", "idle", "error"] as const;

const modelColors: Record<string, string> = {
  "gpt-4o": "text-[var(--text-accent)] bg-[var(--accent-muted)]",
  "claude-3-5-sonnet": "text-[var(--violet)] bg-[color:rgb(139_92_246_/_0.12)]",
  "gemini-1.5-pro": "text-[var(--teal)] bg-[color:rgb(20_184_166_/_0.12)]",
};

function AgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [model, setModel] = useState<(typeof MODELS)[number]>("gpt-4o");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("idle");
  const create = useCreateAgent();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await create.mutateAsync({
        name: name.trim(),
        model,
        status,
        success_rate: Math.round(80 + Math.random() * 18),
        total_calls: Math.round(Math.random() * 500),
        avg_latency: Math.round(200 + Math.random() * 250),
        last_active: new Date().toISOString(),
      });
      toast.success(`Agent “${name}” deployed`);
      setName("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create agent");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-[12px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold">Deploy agent</h3>
              <button type="button" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Name</label>
                <input
                  autoFocus value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vega-2"
                  className="w-full h-9 px-2.5 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Model</label>
                <select
                  value={model} onChange={(e) => setModel(e.target.value as typeof model)}
                  className="w-full h-9 px-2.5 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px] focus:outline-none focus:border-[var(--accent)]"
                >
                  {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Initial status</label>
                <select
                  value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
                  className="w-full h-9 px-2.5 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px] focus:outline-none focus:border-[var(--accent)]"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose}
                className="h-9 px-3 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Cancel
              </button>
              <button type="submit" disabled={create.isPending || !name.trim()}
                className="h-9 px-3 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 inline-flex items-center gap-1.5">
                {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Deploy
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AgentCardLive({ agent, index }: { agent: AgentRow; index: number }) {
  const del = useDeleteAgent();
  const remove = async () => {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    try {
      await del.mutateAsync(agent.id);
      toast.success(`Agent “${agent.name}” removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      whileHover={{ y: -2 }}
      className="group rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition-colors relative"
    >
      <button
        onClick={remove} aria-label="Remove agent"
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-center justify-between mb-3 pr-6">
        <div className="flex items-center gap-2">
          <StatusDot status={agent.status as "active" | "idle" | "error"} />
          <span className="font-semibold text-[14px]">{agent.name}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono-tabular ${modelColors[agent.model] ?? modelColors["gpt-4o"]}`}>
          {agent.model}
        </span>
      </div>
      <InlineBarStat label="Success" value={Number(agent.success_rate)} />
      <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono-tabular">
        <span>{Number(agent.total_calls).toLocaleString()} calls</span>
        <span>{agent.avg_latency}ms · {relativeTime(agent.last_active)}</span>
      </div>
    </motion.div>
  );
}

function AgentsView() {
  const { data: agents = [], isLoading } = useAgents();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = filter === "All" ? agents : agents.filter((a) => a.status === filter);

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle={`${agents.length} agents · ${agents.filter(a => a.status === "active").length} active`}
        actions={
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> Deploy agent
          </button>
        }
      />
      <div className="flex items-center gap-2 mb-5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`h-7 px-2.5 rounded-md text-[12px] border capitalize ${
              filter === f
                ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text-accent)]"
                : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}>
            {f}
          </button>
        ))}
        <button className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <Filter className="h-3 w-3" /> Filter
        </button>
      </div>

      {isLoading ? (
        <div className="text-[13px] text-[var(--text-muted)]">Loading agents…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[var(--border-default)] p-12 text-center">
          <p className="text-[13px] text-[var(--text-secondary)]">No agents match this filter.</p>
          <button onClick={() => setDialogOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--accent)] text-white text-[12px] font-medium">
            <Plus className="h-3 w-3" /> Deploy your first agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((a, i) => <AgentCardLive key={a.id} agent={a} index={i} />)}
        </div>
      )}

      <AgentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}

export const Route = createFileRoute("/_authenticated/agents")({
  head: () => ({ meta: [{ title: "Agents — Harness" }] }),
  component: AgentsView,
});
