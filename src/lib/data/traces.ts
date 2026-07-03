// Deterministic synthetic trace generator for the Observability view.
// Not persisted — traces are ephemeral runtime signals.

export type SpanStatus = "ok" | "error";

export interface Span {
  id: string;
  name: string;
  service: string;
  start: number; // ms from trace start
  duration: number; // ms
  status: SpanStatus;
  depth: number; // 0 = root
  parentId: string | null;
  errorMessage?: string;
}

export interface Trace {
  id: string;
  root: string; // root span name
  agent: string;
  model: string;
  startedAt: number; // epoch ms
  duration: number; // ms (root)
  status: SpanStatus;
  spans: Span[];
  tokens: number;
  cost: number;
  errorGroup?: string;
}

const SERVICES = [
  "planner.decompose",
  "planner.reflect",
  "retriever.dense",
  "retriever.rerank",
  "tools.sql",
  "tools.api",
  "tools.web",
  "memory.read",
  "memory.write",
  "evaluator.score",
  "evaluator.judge",
  "llm.completion",
];

const AGENTS = ["Atlas-7", "Nexus-3", "Vega", "Orion-2", "Sirius", "Helios", "Lyra", "Cygnus-4"];
const MODELS = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"];
const ERROR_GROUPS = [
  "ToolTimeout: tools.sql exceeded 5000ms",
  "SchemaValidation: expected 'answer' field",
  "RateLimit: 429 from upstream provider",
  "ContextOverflow: 128k tokens exceeded",
];

// Mulberry32 seeded RNG for determinism.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], r: () => number) {
  return arr[Math.floor(r() * arr.length)];
}

export function generateTrace(seed: number, startedAt: number): Trace {
  const r = rng(seed);
  const errorRoll = r();
  const isError = errorRoll < 0.06;
  const rootDur = 180 + Math.floor(r() * 1400);
  const agent = pick(AGENTS, r);
  const model = pick(MODELS, r);
  const spans: Span[] = [];

  const rootId = `sp_${seed}_0`;
  spans.push({
    id: rootId,
    name: "agent.invoke",
    service: "agent.runtime",
    start: 0,
    duration: rootDur,
    status: isError ? "error" : "ok",
    depth: 0,
    parentId: null,
  });

  // Sequential child spans across root duration
  const childCount = 4 + Math.floor(r() * 6);
  let cursor = 8;
  const budget = rootDur - 20;
  for (let i = 0; i < childCount; i++) {
    const remaining = childCount - i;
    const maxD = Math.max(20, Math.floor((budget - cursor) / remaining) * (0.6 + r() * 0.9));
    const dur = Math.max(12, Math.floor(maxD));
    const svc = pick(SERVICES, r);
    const spanErr = isError && i === childCount - 1;
    const parentDepth = i > 0 && r() < 0.35 ? 2 : 1;
    const parentId = parentDepth === 2 && spans.length > 1 ? spans[spans.length - 1].id : rootId;
    spans.push({
      id: `sp_${seed}_${i + 1}`,
      name: svc.split(".")[1] ?? svc,
      service: svc,
      start: cursor,
      duration: dur,
      status: spanErr ? "error" : "ok",
      depth: parentDepth,
      parentId,
      errorMessage: spanErr ? pick(ERROR_GROUPS, r) : undefined,
    });
    cursor += dur + Math.floor(r() * 12);
    if (cursor >= rootDur - 10) break;
  }

  return {
    id: `trc_${seed.toString(36).padStart(6, "0")}`,
    root: "agent.invoke",
    agent,
    model,
    startedAt,
    duration: rootDur,
    status: isError ? "error" : "ok",
    spans,
    tokens: 400 + Math.floor(r() * 8000),
    cost: Number((0.002 + r() * 0.05).toFixed(4)),
    errorGroup: isError ? pick(ERROR_GROUPS, r) : undefined,
  };
}

export function generateTraces(count: number, seedBase = 1): Trace[] {
  const now = Date.now();
  const out: Trace[] = [];
  for (let i = 0; i < count; i++) {
    // stagger startedAt across last ~30 min
    const started = now - i * (1000 + ((i * 137) % 3000));
    out.push(generateTrace(seedBase + i, started));
  }
  return out;
}

export function latencyHistogram(traces: Trace[], buckets = 24): { x: number; count: number }[] {
  if (traces.length === 0) return [];
  const max = Math.max(...traces.map((t) => t.duration));
  const size = Math.ceil(max / buckets);
  const bins = Array.from({ length: buckets }, (_, i) => ({ x: i * size, count: 0 }));
  for (const t of traces) {
    const idx = Math.min(buckets - 1, Math.floor(t.duration / size));
    bins[idx].count++;
  }
  return bins;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
