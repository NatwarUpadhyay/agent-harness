// Harness usage analytics — persisted to localStorage.
// Records every simulation run with tokens, latency, and estimated cost,
// giving the harness page a lightweight "usage tied to cost" surface.

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "harness.usage.v1";
const MAX_RUNS = 200;

// Rough per-1k-token USD rate per node type. LLM-heavy nodes cost more.
const NODE_RATE: Record<string, { tokPerMs: number; per1k: number }> = {
  Planner:    { tokPerMs: 0.8, per1k: 0.005 },
  Reflection: { tokPerMs: 0.9, per1k: 0.015 },
  Evaluator:  { tokPerMs: 0.4, per1k: 0.002 },
  Retriever:  { tokPerMs: 0.2, per1k: 0.0005 },
  Memory:     { tokPerMs: 0.1, per1k: 0.0002 },
  Tools:      { tokPerMs: 0.3, per1k: 0.001 },
  Output:     { tokPerMs: 0.1, per1k: 0.0001 },
};

export interface RunNodeStat {
  typeName: string;
  latencyMs: number;
  tokens: number;
  cost: number;
}

export interface UsageRun {
  id: string;
  ts: number;
  workflowName: string;
  totalLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  nodeCount: number;
  edgeCount: number;
  perNode: RunNodeStat[];
}

export function estimateNodeCost(typeName: string, latencyMs: number): { tokens: number; cost: number } {
  const rate = NODE_RATE[typeName] ?? { tokPerMs: 0.2, per1k: 0.0005 };
  const tokens = Math.max(1, Math.round(latencyMs * rate.tokPerMs));
  const cost = (tokens / 1000) * rate.per1k;
  return { tokens, cost };
}

function read(): UsageRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function write(runs: UsageRun[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(-MAX_RUNS))); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent("harness-usage-changed")); } catch { /* ignore */ }
}

export function recordRun(run: Omit<UsageRun, "id" | "ts">): UsageRun {
  const full: UsageRun = { ...run, id: `run_${Date.now().toString(36)}`, ts: Date.now() };
  const runs = read();
  runs.push(full);
  write(runs);
  return full;
}

export function clearRuns() { write([]); }

export function useHarnessUsage(): {
  runs: UsageRun[];
  totalRuns: number;
  totalCost: number;
  totalTokens: number;
  avgLatencyMs: number;
  costByType: { type: string; cost: number; tokens: number }[];
  clear: () => void;
} {
  const [runs, setRuns] = useState<UsageRun[]>([]);
  useEffect(() => {
    setRuns(read());
    const onChange = () => setRuns(read());
    window.addEventListener("harness-usage-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("harness-usage-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const totalCost = runs.reduce((s, r) => s + r.totalCost, 0);
  const totalTokens = runs.reduce((s, r) => s + r.totalTokens, 0);
  const avgLatencyMs = runs.length ? Math.round(runs.reduce((s, r) => s + r.totalLatencyMs, 0) / runs.length) : 0;
  const typeMap = new Map<string, { cost: number; tokens: number }>();
  runs.forEach(r => r.perNode.forEach(n => {
    const cur = typeMap.get(n.typeName) ?? { cost: 0, tokens: 0 };
    cur.cost += n.cost; cur.tokens += n.tokens;
    typeMap.set(n.typeName, cur);
  }));
  const costByType = Array.from(typeMap.entries())
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.cost - a.cost);
  return {
    runs, totalRuns: runs.length, totalCost, totalTokens, avgLatencyMs, costByType,
    clear: useCallback(() => { clearRuns(); setRuns([]); }, []),
  };
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1)    return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
