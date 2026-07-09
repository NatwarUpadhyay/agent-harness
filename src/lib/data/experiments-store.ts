// Local experiments store — A/B tests between two variants (prompts or models),
// persisted to localStorage. Running an experiment records simulated trials
// per variant into the harness usage analytics.

import { useCallback, useEffect, useState } from "react";
import { estimateNodeCost, recordRun } from "./harness-usage";

const STORAGE_KEY = "experiments.v1";

export type ExperimentStatus = "draft" | "running" | "completed" | "stopped";

export interface VariantResult {
  trials: number;
  successes: number;
  totalLatencyMs: number;
  totalTokens: number;
  totalCost: number;
}

export interface ExperimentVariant {
  key: "A" | "B";
  label: string;
  // Simulated behavior knobs — deterministic-ish per label.
  baseLatencyMs: number;
  baseSuccessRate: number;
  result: VariantResult;
}

export interface ExperimentRecord {
  id: string;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  trialsPlanned: number;
  createdAt: number;
  updatedAt: number;
  variants: [ExperimentVariant, ExperimentVariant];
}

const emptyResult = (): VariantResult => ({
  trials: 0, successes: 0, totalLatencyMs: 0, totalTokens: 0, totalCost: 0,
});

const SEED: ExperimentRecord[] = [
  {
    id: "e_seed_1",
    name: "Discovery call: v1.0 vs v1.1",
    hypothesis: "Tighter tone rules increase useful-question rate",
    status: "completed",
    trialsPlanned: 40,
    createdAt: Date.now() - 86400000 * 4,
    updatedAt: Date.now() - 86400000 * 1,
    variants: [
      { key: "A", label: "prompt v1.0", baseLatencyMs: 820, baseSuccessRate: 0.71,
        result: { trials: 40, successes: 28, totalLatencyMs: 33100, totalTokens: 21800, totalCost: 0.109 } },
      { key: "B", label: "prompt v1.1", baseLatencyMs: 760, baseSuccessRate: 0.83,
        result: { trials: 40, successes: 33, totalLatencyMs: 30500, totalTokens: 20100, totalCost: 0.100 } },
    ],
  },
];

function read(): ExperimentRecord[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : SEED;
  } catch { return SEED; }
}

function write(rows: ExperimentRecord[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent("experiments-changed")); } catch { /* ignore */ }
}

// Deterministic-ish PRNG so results feel real but reproducible per trial.
function rand(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function simulateTrial(v: ExperimentVariant, seed: number): { latencyMs: number; success: boolean; tokens: number; cost: number } {
  const r = rand(seed);
  const jitter = 0.7 + r() * 0.6; // 0.7x–1.3x
  const latencyMs = Math.round(v.baseLatencyMs * jitter);
  const success = r() < v.baseSuccessRate;
  const { tokens, cost } = estimateNodeCost("Planner", latencyMs);
  return { latencyMs, success, tokens, cost };
}

export function useExperiments() {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  useEffect(() => {
    setExperiments(read());
    const onChange = () => setExperiments(read());
    window.addEventListener("experiments-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("experiments-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const create = useCallback((input: {
    name: string; hypothesis: string; trialsPlanned: number;
    variantA: { label: string; baseLatencyMs: number; baseSuccessRate: number };
    variantB: { label: string; baseLatencyMs: number; baseSuccessRate: number };
  }) => {
    const rows = read();
    const rec: ExperimentRecord = {
      id: `e_${Date.now().toString(36)}`,
      name: input.name,
      hypothesis: input.hypothesis,
      status: "draft",
      trialsPlanned: input.trialsPlanned,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variants: [
        { key: "A", ...input.variantA, result: emptyResult() },
        { key: "B", ...input.variantB, result: emptyResult() },
      ],
    };
    write([rec, ...rows]);
    return rec;
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((r) => r.id !== id));
  }, []);

  const reset = useCallback((id: string) => {
    write(read().map((r) => r.id === id ? {
      ...r, status: "draft", updatedAt: Date.now(),
      variants: [
        { ...r.variants[0], result: emptyResult() },
        { ...r.variants[1], result: emptyResult() },
      ],
    } : r));
  }, []);

  // Run one batch of trials against both variants; append to results and record usage.
  const runBatch = useCallback((id: string, batchSize = 5) => {
    const rows = read();
    const rec = rows.find((r) => r.id === id);
    if (!rec) return;

    const newVariants = rec.variants.map((v, vi) => {
      const res = { ...v.result };
      const perNode: { typeName: string; latencyMs: number; tokens: number; cost: number }[] = [];
      for (let i = 0; i < batchSize && res.trials < rec.trialsPlanned; i++) {
        const t = simulateTrial(v, Date.now() + i * 31 + vi * 977);
        res.trials += 1;
        res.successes += t.success ? 1 : 0;
        res.totalLatencyMs += t.latencyMs;
        res.totalTokens += t.tokens;
        res.totalCost += t.cost;
        perNode.push({ typeName: "Planner", latencyMs: t.latencyMs, tokens: t.tokens, cost: t.cost });
      }
      if (perNode.length) {
        recordRun({
          workflowName: `Experiment · ${rec.name} · ${v.label}`,
          totalLatencyMs: perNode.reduce((s, n) => s + n.latencyMs, 0),
          totalTokens: perNode.reduce((s, n) => s + n.tokens, 0),
          totalCost: perNode.reduce((s, n) => s + n.cost, 0),
          nodeCount: perNode.length,
          edgeCount: 0,
          perNode,
        });
      }
      return { ...v, result: res };
    }) as [ExperimentVariant, ExperimentVariant];

    const done = newVariants.every((v) => v.result.trials >= rec.trialsPlanned);
    const nextStatus: ExperimentStatus = done ? "completed" : "running";

    write(rows.map((r) => r.id === id ? { ...r, variants: newVariants, status: nextStatus, updatedAt: Date.now() } : r));
  }, []);

  const stop = useCallback((id: string) => {
    write(read().map((r) => r.id === id ? { ...r, status: "stopped", updatedAt: Date.now() } : r));
  }, []);

  return { experiments, create, remove, reset, runBatch, stop };
}

export function successRate(v: ExperimentVariant): number {
  return v.result.trials ? (v.result.successes / v.result.trials) * 100 : 0;
}
export function avgLatency(v: ExperimentVariant): number {
  return v.result.trials ? Math.round(v.result.totalLatencyMs / v.result.trials) : 0;
}
