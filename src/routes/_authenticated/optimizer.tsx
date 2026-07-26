import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
  Database,
  Layers,
  GitBranch,
  Filter,
  Archive,
  Check,
  X,
  ArrowRight,
  Brain,
  Search,
  Gauge,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Data — synthetic suggestion catalog                                 */
/* ------------------------------------------------------------------ */

type Impact = "high" | "medium" | "low";
type Category = "retrieval" | "memory" | "context" | "cost";

interface Suggestion {
  id: string;
  category: Category;
  title: string;
  summary: string;
  detail: string;
  impact: Impact;
  effort: "1h" | "half day" | "1-2 days";
  gain: { metric: string; delta: string; direction: "up" | "down" };
  namespace?: string;
  icon: typeof Sparkles;
}

const SUGGESTIONS: Suggestion[] = [
  {
    id: "s1",
    category: "retrieval",
    title: "Enable hybrid retrieval on support-tickets-2025",
    summary: "Dense-only recall is leaving 14% of relevant chunks unretrieved on lexical queries (IDs, SKUs, error codes).",
    detail:
      "Adding BM25 as a parallel path with reciprocal rank fusion will lift recall@10 without hurting precision. Estimated cost delta: +$0.0004 / query.",
    impact: "high",
    effort: "half day",
    gain: { metric: "Recall@10", delta: "+11.4%", direction: "up" },
    namespace: "support-tickets-2025",
    icon: Layers,
  },
  {
    id: "s2",
    category: "retrieval",
    title: "Rerank top-50 → top-8 with cohere-rerank-3",
    summary: "Current top-k=8 dense selection under-scores 22% of gold chunks in eval sweeps.",
    detail:
      "Fetch 50, rerank down to 8. Adds ~40ms latency but yields double-digit precision gains on multi-hop queries.",
    impact: "high",
    effort: "1h",
    gain: { metric: "Precision@10", delta: "+18.2%", direction: "up" },
    icon: Filter,
  },
  {
    id: "s3",
    category: "memory",
    title: "Compress conversation memory older than 24h",
    summary: "62% of stored turns are never re-read but consume 41% of embedding storage.",
    detail:
      "Summarize turns older than 24h into a rolling episodic memory (~200 tokens per session) and archive raw turns to cold storage.",
    impact: "high",
    effort: "1-2 days",
    gain: { metric: "Storage", delta: "-38%", direction: "down" },
    icon: Archive,
  },
  {
    id: "s4",
    category: "memory",
    title: "Split internal-wiki into topic-scoped namespaces",
    summary: "One monolithic namespace forces every query to search 21k unrelated vectors.",
    detail:
      "Auto-cluster docs (HDBSCAN on embeddings) and route queries by intent classifier. Halves ANN query time.",
    impact: "medium",
    effort: "1-2 days",
    gain: { metric: "Query latency", delta: "-46ms", direction: "down" },
    namespace: "internal-wiki",
    icon: GitBranch,
  },
  {
    id: "s5",
    category: "context",
    title: "Trim system prompt with prompt-level dedup",
    summary: "Your Vega-2 agent ships 1,240 tokens of overlapping guardrails on every call.",
    detail:
      "Auto-detected 4 near-duplicate sections. Consolidating saves ~$127/day at current volume without behavior drift (verified against eval suite).",
    impact: "medium",
    effort: "1h",
    gain: { metric: "Tokens/call", delta: "-31%", direction: "down" },
    icon: Sparkles,
  },
  {
    id: "s6",
    category: "context",
    title: "Enable semantic cache for FAQ intents",
    summary: "34% of user queries hit within 0.94 cosine of a prior query in the last 7 days.",
    detail:
      "Response cache keyed on query embedding with a 0.92 threshold. Serves cached completion, revalidates async.",
    impact: "high",
    effort: "half day",
    gain: { metric: "Avg cost/call", delta: "-27%", direction: "down" },
    icon: Zap,
  },
  {
    id: "s7",
    category: "cost",
    title: "Route simple queries to gpt-4o-mini",
    summary: "58% of Vega-2 traffic is single-turn intent classification — GPT-4o is overkill.",
    detail:
      "Add a lightweight router (2ms). Eval suite shows <0.4% quality drop for the routed slice.",
    impact: "high",
    effort: "1h",
    gain: { metric: "Cost/day", delta: "-$412", direction: "down" },
    icon: Gauge,
  },
  {
    id: "s8",
    category: "retrieval",
    title: "Chunk product-docs by section boundaries, not fixed size",
    summary: "Fixed 512-token chunks fragment code samples across boundaries in 19% of files.",
    detail:
      "Use markdown heading tree for chunk boundaries with 128-token overlap. Recovers coherent code + prose pairs.",
    impact: "medium",
    effort: "half day",
    gain: { metric: "Answer accuracy", delta: "+8.6%", direction: "up" },
    namespace: "product-docs",
    icon: Database,
  },
];

const CATEGORIES: { key: Category | "all"; label: string; icon: typeof Sparkles }[] = [
  { key: "all", label: "All", icon: Sparkles },
  { key: "retrieval", label: "Retrieval", icon: Search },
  { key: "memory", label: "Memory", icon: Database },
  { key: "context", label: "Context", icon: Brain },
  { key: "cost", label: "Cost", icon: Gauge },
];

const IMPACT_STYLES: Record<Impact, string> = {
  high: "text-[var(--text-accent)] bg-[var(--accent-muted)] border-[var(--accent-border)]",
  medium: "text-[var(--violet)] bg-[color:rgb(139_92_246_/_0.12)] border-[color:rgb(139_92_246_/_0.25)]",
  low: "text-[var(--text-muted)] bg-[var(--bg-elevated)] border-[var(--border-default)]",
};

/* ------------------------------------------------------------------ */

function ImpactBadge({ impact }: { impact: Impact }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border font-mono-tabular ${IMPACT_STYLES[impact]}`}
    >
      {impact}
    </span>
  );
}

function SuggestionCard({
  s,
  index,
  applied,
  dismissed,
  onApply,
  onDismiss,
  onOpen,
}: {
  s: Suggestion;
  index: number;
  applied: boolean;
  dismissed: boolean;
  onApply: () => void;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const Icon = s.icon;
  const DeltaIcon = s.gain.direction === "up" ? TrendingUp : TrendingDown;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: dismissed ? 0.4 : 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className="group rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] transition-colors flex flex-col gap-3 min-w-0"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)]">
          <Icon className="h-4 w-4 text-[var(--text-secondary)]" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <ImpactBadge impact={s.impact} />
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-mono-tabular">
              {s.category}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono-tabular">· {s.effort}</span>
          </div>
          <h3 className="mt-1.5 text-[14px] font-semibold leading-snug text-[var(--text-primary)]">
            {s.title}
          </h3>
        </div>
        <div className="hidden sm:flex flex-col items-end shrink-0">
          <div className="inline-flex items-center gap-1 text-[13px] font-mono-tabular font-semibold text-[var(--text-primary)]">
            <DeltaIcon
              className={`h-3.5 w-3.5 ${
                s.gain.direction === "up" ? "text-[var(--text-accent)]" : "text-[var(--teal)]"
              }`}
            />
            {s.gain.delta}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {s.gain.metric}
          </div>
        </div>
      </div>

      <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{s.summary}</p>

      {s.namespace && (
        <div className="text-[11px] font-mono-tabular text-[var(--text-muted)] truncate">
          namespace · <span className="text-[var(--text-secondary)]">{s.namespace}</span>
        </div>
      )}

      <div className="flex sm:hidden items-center gap-1 text-[13px] font-mono-tabular font-semibold">
        <DeltaIcon
          className={`h-3.5 w-3.5 ${
            s.gain.direction === "up" ? "text-[var(--text-accent)]" : "text-[var(--teal)]"
          }`}
        />
        {s.gain.delta}
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] ml-1">
          {s.gain.metric}
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {applied ? (
          <span className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[12px] bg-[var(--accent-muted)] text-[var(--text-accent)] border border-[var(--accent-border)]">
            <Check className="h-3.5 w-3.5" /> Applied
          </span>
        ) : (
          <button
            onClick={onApply}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[12px] font-medium hover:bg-[var(--accent-hover)]"
          >
            Apply <ArrowRight className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={onOpen}
          className="inline-flex items-center h-8 px-2.5 rounded-md border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Details
        </button>
        {!dismissed && !applied && (
          <button
            onClick={onDismiss}
            className="ml-auto inline-flex items-center h-8 px-2 rounded-md text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function DetailDrawer({ s, onClose }: { s: Suggestion | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {s && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg rounded-t-[16px] sm:rounded-[12px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <ImpactBadge impact={s.impact} />
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-mono-tabular">
                    {s.category}
                  </span>
                </div>
                <h3 className="text-[16px] font-semibold leading-snug">{s.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  Projected {s.gain.metric}
                </div>
                <div className="mt-1 text-[18px] font-semibold font-mono-tabular">
                  {s.gain.delta}
                </div>
              </div>
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  Effort
                </div>
                <div className="mt-1 text-[18px] font-semibold font-mono-tabular">{s.effort}</div>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {s.summary}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {s.detail}
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={onClose}
                className="h-9 px-3 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  toast.success(`Applied “${s.title}”`, {
                    description: `${s.gain.metric} projected ${s.gain.delta}`,
                  });
                  onClose();
                }}
                className="h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
              >
                Apply suggestion
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */

function OptimizerView() {
  const [cat, setCat] = useState<Category | "all">("all");
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Suggestion | null>(null);

  const visible = useMemo(() => {
    return SUGGESTIONS.filter((s) => (cat === "all" ? true : s.category === cat)).filter(
      (s) => !dismissed.has(s.id),
    );
  }, [cat, dismissed]);

  const stats = useMemo(() => {
    const openCount = SUGGESTIONS.filter((s) => !applied.has(s.id) && !dismissed.has(s.id)).length;
    const high = SUGGESTIONS.filter(
      (s) => s.impact === "high" && !applied.has(s.id) && !dismissed.has(s.id),
    ).length;
    return { openCount, high, applied: applied.size };
  }, [applied, dismissed]);

  const apply = (id: string, title: string) => {
    setApplied((prev) => new Set(prev).add(id));
    toast.success(`Applied “${title}”`);
  };
  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <>
      <PageHeader
        title="Optimizer"
        subtitle="RAG and memory suggestions from your live telemetry — apply high-impact fixes with one click"
        actions={
          <button
            onClick={() => toast.success("Re-scanning telemetry…", { description: "New suggestions will appear as they're detected." })}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            <Sparkles className="h-3.5 w-3.5" /> Re-scan
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Open suggestions", value: stats.openCount, hint: "actionable" },
          { label: "High-impact", value: stats.high, hint: "recommended first" },
          { label: "Applied this session", value: stats.applied, hint: "" },
          { label: "Est. monthly savings", value: "$3.2K", hint: "if all applied" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 min-w-0"
          >
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] truncate">
              {s.label}
            </div>
            <div className="mt-1 text-[22px] font-semibold font-mono-tabular truncate">
              {s.value}
            </div>
            {s.hint && (
              <div className="text-[11px] text-[var(--text-muted)] truncate">{s.hint}</div>
            )}
          </div>
        ))}
      </div>

      <SectionHeader title="Filter" />
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = cat === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12px] border ${
                active
                  ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text-accent)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-3 w-3" /> {c.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[var(--border-default)] p-12 text-center">
          <p className="text-[13px] text-[var(--text-secondary)]">
            No suggestions in this category. Re-scan telemetry to check for new opportunities.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((s, i) => (
            <SuggestionCard
              key={s.id}
              s={s}
              index={i}
              applied={applied.has(s.id)}
              dismissed={dismissed.has(s.id)}
              onApply={() => apply(s.id, s.title)}
              onDismiss={() => dismiss(s.id)}
              onOpen={() => setOpen(s)}
            />
          ))}
        </div>
      )}

      <DetailDrawer s={open} onClose={() => setOpen(null)} />
    </>
  );
}

export const Route = createFileRoute("/_authenticated/optimizer")({
  head: () => ({
    meta: [
      { title: "Optimizer — Harness" },
      {
        name: "description",
        content:
          "Advanced RAG and memory optimization suggestions surfaced from your live agent telemetry.",
      },
    ],
  }),
  component: OptimizerView,
});
