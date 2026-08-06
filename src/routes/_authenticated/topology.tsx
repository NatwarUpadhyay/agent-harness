import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch, RefreshCw, AlertTriangle, Unplug, CornerDownRight, Split,
  Download, CheckCircle2, Repeat, Clock, Layers, Wand2,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useWorkflows } from "@/lib/hooks/use-entities";
import {
  analyzeTopology, type TopoEdge, type TopoNode, type TopologyIssue,
} from "@/lib/context/topology";

export const Route = createFileRoute("/_authenticated/topology")({
  component: TopologyPage,
  head: () => ({
    meta: [
      { title: "Workflow Topology Audit · Harness" },
      {
        name: "description",
        content:
          "Audit agent workflows for circular dependencies, unreachable nodes, dead ends and critical-path latency before they reach production.",
      },
      { property: "og:title", content: "Workflow Topology Audit · Harness" },
      {
        property: "og:description",
        content:
          "Graph and loop analysis for agent workflows: cycles, orphans, unreachable nodes and critical-path latency.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const LATENCY: Record<string, number> = {
  planner: 800, memory: 120, retriever: 240, tools: 450,
  evaluator: 320, reflection: 1200, output: 60,
};

interface Graph {
  id: string;
  name: string;
  origin: "saved" | "sample";
  nodes: TopoNode[];
  edges: TopoEdge[];
}

const node = (id: string, label: string, type: string): TopoNode => ({
  id, label, type, latencyMs: LATENCY[type] ?? 200,
});

const SAMPLES: Graph[] = [
  {
    id: "sample-rag", name: "RAG pipeline (sample)", origin: "sample",
    nodes: [
      node("p", "Planner", "planner"), node("r", "Retriever", "retriever"),
      node("m", "Memory", "memory"), node("o", "Output", "output"),
    ],
    edges: [
      { source: "p", target: "r" }, { source: "r", target: "m" }, { source: "m", target: "o" },
    ],
  },
  {
    id: "sample-reflect", name: "Reflection loop (sample)", origin: "sample",
    nodes: [
      node("p", "Planner", "planner"), node("t", "Tools", "tools"),
      node("e", "Evaluator", "evaluator"), node("x", "Reflection", "reflection"),
      node("o", "Output", "output"), node("m", "Memory", "memory"),
    ],
    edges: [
      { source: "p", target: "t" }, { source: "t", target: "e" },
      { source: "e", target: "x" }, { source: "x", target: "t" },
      { source: "e", target: "o" },
    ],
  },
];

function toGraph(row: {
  id: string; name: string; nodes: unknown; edges: unknown;
}): Graph {
  const rawNodes = Array.isArray(row.nodes) ? row.nodes : [];
  const rawEdges = Array.isArray(row.edges) ? row.edges : [];
  const nodes: TopoNode[] = rawNodes
    .map((n): TopoNode | null => {
      const obj = (n ?? {}) as { id?: string; data?: { label?: string; iconKey?: string } };
      if (!obj.id) return null;
      const type = obj.data?.iconKey ?? "";
      return {
        id: obj.id,
        label: obj.data?.label ?? obj.id,
        type,
        latencyMs: LATENCY[type] ?? 200,
      };
    })
    .filter((n): n is TopoNode => n !== null);
  const edges: TopoEdge[] = rawEdges
    .map((e) => {
      const obj = (e ?? {}) as { source?: string; target?: string };
      return obj.source && obj.target ? { source: obj.source, target: obj.target } : null;
    })
    .filter((e): e is TopoEdge => e !== null);
  return { id: row.id, name: row.name, origin: "saved", nodes, edges };
}

const ICONS: Record<TopologyIssue["kind"], typeof AlertTriangle> = {
  cycle: Repeat, orphan: Unplug, unreachable: AlertTriangle,
  "dead-end": CornerDownRight, "fan-out": Split, "no-entry": AlertTriangle,
};

const TONE: Record<TopologyIssue["severity"], string> = {
  high: "var(--danger)", medium: "var(--warning)", low: "var(--text-muted)",
};

function HealthRing({ value }: { value: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? "var(--success)" : value >= 50 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="relative h-[112px] w-[112px]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="7" stroke="var(--border-default)" />
        <motion.circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="7" stroke={color} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * value) / 100 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.32, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[24px] font-semibold">{value}</span>
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">health</span>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 font-mono text-[20px] font-semibold">{value}</div>
    </div>
  );
}

function TopologyPage() {
  const { data: saved = [], isLoading, refetch } = useWorkflows();
  const [selected, setSelected] = useState<string>(SAMPLES[0]!.id);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const graphs = useMemo<Graph[]>(
    () => [...saved.map(toGraph), ...SAMPLES],
    [saved],
  );

  const graph = graphs.find((g) => g.id === selected) ?? graphs[0]!;
  const report = useMemo(() => analyzeTopology(graph.nodes, graph.edges), [graph]);

  const key = (i: TopologyIssue, idx: number) => `${graph.id}:${i.kind}:${i.nodeIds.join("-")}:${idx}`;
  const openIssues = report.issues.filter((i, idx) => !resolved.has(key(i, idx)));
  const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;

  const exportCsv = () => {
    const rows = [
      ["workflow", "severity", "kind", "title", "detail", "nodes"],
      ...report.issues.map((i) => [
        graph.name, i.severity, i.kind, i.title, i.detail,
        i.nodeIds.map(label).join(" > "),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `topology-audit-${graph.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${report.issues.length} findings`);
  };

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Workflow topology audit"
        subtitle="Graph and loop analysis over your agent flows — cycles, orphans, dead ends and critical-path latency."
        actions={
          <>
            <Button
              variant="outline" size="sm"
              onClick={() => { setResolved(new Set()); void refetch(); toast.success("Re-ran topology audit"); }}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Re-run audit
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={exportCsv} disabled={report.issues.length === 0}
            >
              <Download className="mr-2 h-3.5 w-3.5" /> Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {graphs.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelected(g.id)}
            className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
              g.id === graph.id
                ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
            }`}
          >
            <GitBranch className="mr-1.5 inline h-3 w-3" />
            {g.name}
          </button>
        ))}
        {isLoading && (
          <span className="self-center text-[12px] text-[var(--text-muted)]">loading saved flows…</span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-5 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <HealthRing value={report.health} />
          <div className="text-[13px] text-[var(--text-secondary)]">
            <div className="font-medium text-[var(--text-primary)]">{graph.name}</div>
            <div className="mt-1">
              {report.issues.length === 0
                ? "No structural issues detected."
                : `${report.issues.filter((i) => i.severity === "high").length} high · ${report.issues.filter((i) => i.severity === "medium").length} medium · ${report.issues.filter((i) => i.severity === "low").length} low`}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={Layers} label="Nodes / edges" value={`${report.nodeCount} / ${report.edgeCount}`} />
          <Stat icon={Repeat} label="Cycles" value={String(report.cycles.length)} />
          <Stat icon={GitBranch} label="Critical depth" value={String(report.maxDepth)} />
          <Stat icon={Clock} label="Path latency" value={`${(report.criticalPathLatencyMs / 1000).toFixed(2)}s`} />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeader
            title={`Findings (${openIssues.length} open)`}
            action={
              report.issues.length > openIssues.length ? (
                <button
                  className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  onClick={() => setResolved(new Set())}
                >
                  show resolved
                </button>
              ) : undefined
            }
          />
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {openIssues.length === 0 && (
                <motion.div
                  key="clean"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-3 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-[13px] text-[var(--text-secondary)]"
                >
                  <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                  This flow is structurally clean — every node is reachable and terminates.
                </motion.div>
              )}
              {report.issues.map((issue, idx) => {
                const k = key(issue, idx);
                if (resolved.has(k)) return null;
                const Icon = ICONS[issue.kind];
                return (
                  <motion.div
                    key={k}
                    layout
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 12 }}
                    className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TONE[issue.severity] }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-medium">{issue.title}</span>
                          <span
                            className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase"
                            style={{ color: TONE[issue.severity], borderColor: TONE[issue.severity] }}
                          >
                            {issue.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{issue.detail}</p>
                        {issue.nodeIds.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {issue.nodeIds.map((id) => (
                              <span
                                key={id}
                                className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]"
                              >
                                {label(id)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => {
                          setResolved((prev) => new Set(prev).add(k));
                          toast.success("Finding acknowledged");
                        }}
                      >
                        Acknowledge
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        <section>
          <SectionHeader title="Critical path" />
          <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            {report.criticalPath.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">No executable path found.</p>
            ) : (
              <ol className="space-y-3">
                {report.criticalPath.map((id, i) => (
                  <li key={`${id}-${i}`} className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-[var(--text-muted)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]" />
                    <span className="flex-1 text-[13px]">{label(id)}</span>
                    <span className="font-mono text-[11px] text-[var(--text-muted)]">
                      {graph.nodes.find((n) => n.id === id)?.latencyMs ?? 200}ms
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-5 border-t border-[var(--border-default)] pt-4 text-[12px] text-[var(--text-secondary)]">
              <div className="mb-2 flex items-center gap-2 text-[var(--text-primary)]">
                <Wand2 className="h-3.5 w-3.5" /> Suggestions
              </div>
              <ul className="list-disc space-y-1 pl-4">
                {report.cycles.length > 0 && <li>Cap loop iterations with an evaluator pass-gate.</li>}
                {report.maxDepth > 5 && <li>Depth {report.maxDepth} — collapse sequential steps to cut latency.</li>}
                {report.criticalPathLatencyMs > 2000 && <li>Parallelise retrieval and memory reads to shave p95.</li>}
                {report.issues.length === 0 && <li>Structure is healthy — promote this flow to a template.</li>}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
