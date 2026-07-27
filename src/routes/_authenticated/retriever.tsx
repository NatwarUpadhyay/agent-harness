import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Play, RotateCcw, Save, Layers, Filter, Zap } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { toast } from "sonner";

type Strategy = "dense" | "hybrid" | "reranked";

const STRATEGIES: { key: Strategy; label: string; icon: typeof Layers; desc: string }[] = [
  { key: "dense", label: "Dense", icon: Zap, desc: "Vector similarity only. Fastest, weakest on lexical queries." },
  { key: "hybrid", label: "Hybrid (BM25 + dense)", icon: Layers, desc: "Reciprocal rank fusion of lexical + semantic. Best recall." },
  { key: "reranked", label: "Reranked", icon: Filter, desc: "Fetch 50 candidates, rerank down to k. Best precision." },
];

const RERANKERS = ["cohere-rerank-3", "bge-reranker-v2", "voyage-rerank-2", "off"];

const STORAGE_KEY = "harness.retriever.config";

interface Config {
  strategy: Strategy;
  topK: number;
  threshold: number; // 0-100
  reranker: string;
  namespace: string;
}

const DEFAULTS: Config = {
  strategy: "hybrid",
  topK: 8,
  threshold: 72,
  reranker: "cohere-rerank-3",
  namespace: "support-tickets-2025",
};

const NAMESPACES = [
  "support-tickets-2025",
  "product-docs",
  "internal-wiki",
  "compliance-corpus",
  "sales-call-transcripts",
];

/** Derive live metrics deterministically from config so sliders actually move numbers. */
function computeMetrics(c: Config) {
  const strategyBoost = c.strategy === "hybrid" ? 8.4 : c.strategy === "reranked" ? 11.2 : 0;
  const kBoost = Math.min(6, (c.topK - 1) * 0.35);
  const rerankBoost = c.reranker === "off" ? 0 : c.strategy === "reranked" ? 4.8 : 2.1;
  const recall = Math.min(98.9, 78 + strategyBoost + kBoost + rerankBoost - (c.threshold - 50) * 0.08);
  const precision = Math.min(95, 62 + (c.threshold - 50) * 0.18 + (c.strategy === "reranked" ? 14 : c.strategy === "hybrid" ? 6 : 0));
  const baseLatency = c.strategy === "dense" ? 62 : c.strategy === "hybrid" ? 94 : 158;
  const latency = Math.round(baseLatency + c.topK * 3 + (c.reranker === "off" ? 0 : 32));
  const cacheHit = Math.max(24, 70 - (c.topK - 8) * 1.4 - (c.threshold - 72) * 0.4);
  const rerankLift = c.reranker === "off" ? 0 : c.strategy === "reranked" ? 12.3 : c.strategy === "hybrid" ? 6.7 : 3.2;

  return {
    recall: recall.toFixed(1) + "%",
    precision: precision.toFixed(1) + "%",
    latency: latency + "ms",
    cache: cacheHit.toFixed(1) + "%",
    rerankLift: (rerankLift >= 0 ? "+" : "") + rerankLift.toFixed(1) + "%",
  };
}

const SAMPLE_QUERIES = [
  "How do I refund a subscription cancelled mid-cycle?",
  "SKU-A9412 out-of-stock policy for enterprise customers",
  "error code E_TIMEOUT during checkout webhook",
];

interface Hit {
  id: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
}

function fakeSearch(query: string, c: Config): Hit[] {
  if (!query.trim()) return [];
  const seed = query.length + c.topK + c.threshold;
  const pool: Omit<Hit, "score">[] = [
    { id: "d1", title: "Refunds: partial + prorated cycles", snippet: "For mid-cycle cancellations, prorate the remaining days and issue a refund via the billing API…", source: c.namespace },
    { id: "d2", title: "Enterprise SKU stock policy v3", snippet: "Enterprise customers receive priority allocation on SKU-A9412 with 48h SLA on backorder…", source: c.namespace },
    { id: "d3", title: "Webhook error taxonomy", snippet: "E_TIMEOUT indicates the upstream processor did not acknowledge within 30s. Retry with exponential backoff…", source: c.namespace },
    { id: "d4", title: "Billing lifecycle events", snippet: "The subscription.updated event fires on plan changes, quantity changes, and mid-cycle cancellations…", source: c.namespace },
    { id: "d5", title: "Idempotency and retries", snippet: "Every request must include an idempotency key; the server dedupes on this key for 24 hours…", source: c.namespace },
    { id: "d6", title: "SKU catalog operations", snippet: "Bulk-update stock levels via the /catalog/sync endpoint using signed CSV payloads…", source: c.namespace },
    { id: "d7", title: "Customer support playbook", snippet: "Escalate to tier-2 when refund amount exceeds $500 or the account has 3+ prior chargebacks…", source: c.namespace },
    { id: "d8", title: "Data retention & PII", snippet: "Ticket bodies are redacted for PII (email, phone, SSN) before entering the retrieval namespace…", source: c.namespace },
  ];
  return pool.slice(0, c.topK).map((h, i) => ({
    ...h,
    score: Math.max(0.4, Math.min(0.99, 0.94 - i * 0.05 - ((seed % 7) * 0.005))),
  }));
}

function RetrieverView() {
  const [config, setConfig] = useState<Config>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch { /* ignore */ }
  }, [config]);

  const metrics = useMemo(() => computeMetrics(config), [config]);

  const runQuery = (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) {
      toast.error("Enter a query to test retrieval");
      return;
    }
    setQuery(text);
    setRunning(true);
    setHits([]);
    setTimeout(() => {
      setHits(fakeSearch(text, config));
      setRunning(false);
      toast.success(`Retrieved ${config.topK} chunks`, {
        description: `${config.strategy} · ${metrics.latency} · ${metrics.recall} recall`,
      });
    }, 420);
  };

  const reset = () => {
    setConfig(DEFAULTS);
    setHits([]);
    setQuery("");
    toast("Defaults restored");
  };

  const save = () => {
    toast.success("Retriever config saved", {
      description: `${config.strategy} · k=${config.topK} · τ=${(config.threshold / 100).toFixed(2)}`,
    });
  };

  return (
    <>
      <PageHeader
        title="Retriever"
        subtitle="Configure how agents find the right context, fast"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            <button
              onClick={save}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
            >
              <Save className="h-3.5 w-3.5" /> Save config
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: config */}
        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-6">
          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Retrieval strategy
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STRATEGIES.map((s) => {
                const active = config.strategy === s.key;
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => setConfig((c) => ({ ...c, strategy: s.key }))}
                    className={`h-auto py-2.5 px-3 rounded-md text-[13px] border text-left transition-colors ${
                      active
                        ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text-accent)]"
                        : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Icon className="h-3.5 w-3.5" /> {s.label}
                    </div>
                    <div className="text-[11px] mt-1 text-[var(--text-muted)] leading-snug">{s.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Namespace
            </label>
            <select
              value={config.namespace}
              onChange={(e) => setConfig((c) => ({ ...c, namespace: e.target.value }))}
              className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 text-[13px]"
            >
              {NAMESPACES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] uppercase tracking-wider text-[var(--text-muted)]">Top-k</label>
              <span className="text-[13px] font-mono-tabular">{config.topK}</span>
            </div>
            <input
              type="range"
              min={1}
              max={32}
              value={config.topK}
              onChange={(e) => setConfig((c) => ({ ...c, topK: Number(e.target.value) }))}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] uppercase tracking-wider text-[var(--text-muted)]">
                Similarity threshold
              </label>
              <span className="text-[13px] font-mono-tabular">{(config.threshold / 100).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={config.threshold}
              onChange={(e) => setConfig((c) => ({ ...c, threshold: Number(e.target.value) }))}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Reranker
            </label>
            <select
              value={config.reranker}
              onChange={(e) => setConfig((c) => ({ ...c, reranker: e.target.value }))}
              className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 text-[13px]"
            >
              {RERANKERS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Playground */}
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <SectionHeader title="Test playground" />
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runQuery()}
                  placeholder="Type a test query…"
                  className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] pl-8 pr-3 text-[13px]"
                />
              </div>
              <button
                onClick={() => runQuery()}
                disabled={running}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" /> {running ? "Running…" : "Run"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => runQuery(q)}
                  className="text-[11px] px-2 py-1 rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {q.length > 42 ? q.slice(0, 42) + "…" : q}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {hits.length === 0 && !running && (
                <div className="rounded-md border border-dashed border-[var(--border-default)] p-6 text-center text-[12px] text-[var(--text-muted)]">
                  Run a query to see ranked chunks.
                </div>
              )}
              {hits.map((h, i) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-[13px] font-semibold truncate">{h.title}</div>
                    <span className="text-[11px] font-mono-tabular text-[var(--text-accent)]">
                      {h.score.toFixed(3)}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                    {h.snippet}
                  </p>
                  <div className="mt-1 text-[10px] font-mono-tabular text-[var(--text-muted)]">
                    #{i + 1} · {h.source}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: metrics */}
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Live metrics" />
          <ul className="space-y-3">
            {[
              ["Recall @10", metrics.recall],
              ["Precision @10", metrics.precision],
              ["Avg latency", metrics.latency],
              ["Cache hit rate", metrics.cache],
              ["Rerank lift", metrics.rerankLift],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between text-[13px]">
                <span className="text-[var(--text-secondary)]">{k}</span>
                <motion.span
                  key={v}
                  initial={{ opacity: 0.5, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-mono-tabular"
                >
                  {v}
                </motion.span>
              </li>
            ))}
          </ul>

          <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Config snapshot
            </div>
            <pre className="text-[11px] font-mono-tabular text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-all">
{`strategy : ${config.strategy}
namespace: ${config.namespace}
top_k    : ${config.topK}
threshold: ${(config.threshold / 100).toFixed(2)}
reranker : ${config.reranker}`}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}

export const Route = createFileRoute("/_authenticated/retriever")({
  head: () => ({
    meta: [
      { title: "Retriever — Harness" },
      { name: "description", content: "Tune retrieval strategy, top-k, threshold, and reranker with a live test playground." },
    ],
  }),
  component: RetrieverView,
});
