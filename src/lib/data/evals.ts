// Synthetic Evaluations engine data — rubrics, datasets, and comparable runs.
import { agents } from "./synthetic";

export interface Rubric {
  id: string;
  name: string;
  description: string;
  weight: number; // 0..1
  threshold: number; // pass score
  kind: "safety" | "quality" | "format" | "performance";
}

export interface Dataset {
  id: string;
  name: string;
  rowCount: number;
  description: string;
}

export interface EvalRun {
  id: string;
  name: string;
  agentId: string;
  datasetId: string;
  rubricIds: string[];
  score: number;      // 0..100
  passRate: number;   // 0..100
  cases: number;
  passed: number;
  failed: number;
  avgLatencyMs: number;
  costUsd: number;
  startedAt: string;
  durationSec: number;
  status: "completed" | "running" | "failed";
  perRubric: Record<string, number>;
}

export const rubrics: Rubric[] = [
  { id: "rb_tox",   name: "Toxicity guard",           kind: "safety",      weight: 0.20, threshold: 90, description: "Reject harmful, biased, or unsafe output" },
  { id: "rb_pii",   name: "PII redaction",            kind: "safety",      weight: 0.15, threshold: 95, description: "Strip emails, phones, and identifiers" },
  { id: "rb_cite",  name: "Citation accuracy",        kind: "quality",     weight: 0.15, threshold: 80, description: "Sources must match cited claims" },
  { id: "rb_json",  name: "JSON schema adherence",    kind: "format",      weight: 0.15, threshold: 98, description: "Output must validate against schema" },
  { id: "rb_hall",  name: "Hallucination check",      kind: "quality",     weight: 0.15, threshold: 85, description: "Detect fabricated entities and facts" },
  { id: "rb_lat",   name: "Latency budget",           kind: "performance", weight: 0.10, threshold: 90, description: "p95 latency under 1200 ms" },
  { id: "rb_cost",  name: "Cost ceiling",             kind: "performance", weight: 0.10, threshold: 88, description: "Cost per call under $0.02" },
];

export const datasets: Dataset[] = [
  { id: "ds_gold",  name: "Golden set v3",         rowCount: 512, description: "Curated regression suite maintained by the QA team" },
  { id: "ds_prod",  name: "Production sample",     rowCount: 1024, description: "24h rolling sample of live traffic (PII scrubbed)" },
  { id: "ds_adv",   name: "Adversarial prompts",   rowCount: 187, description: "Red-team jailbreaks and injection payloads" },
  { id: "ds_multi", name: "Multi-turn dialogues",  rowCount: 340, description: "10+ turn conversations with tool calls" },
];

// Deterministic pseudo-random for stable synthetic data.
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

function buildRun(i: number, opts?: Partial<EvalRun>): EvalRun {
  const r = seeded(i * 37 + 11);
  const rubricIds = rubrics.map((rb) => rb.id);
  const perRubric: Record<string, number> = {};
  rubricIds.forEach((id, idx) => {
    perRubric[id] = Math.round(72 + r() * 26 - (idx === i % rubricIds.length ? 12 : 0));
  });
  const score = Math.round(
    rubrics.reduce((acc, rb) => acc + perRubric[rb.id] * rb.weight, 0),
  );
  const cases = 120 + Math.floor(r() * 400);
  const passRate = Math.min(99, Math.max(52, Math.round(score - 4 + r() * 8)));
  const passed = Math.round((cases * passRate) / 100);
  const startedAt = new Date(Date.now() - i * 1000 * 60 * 60 * 5).toISOString();
  return {
    id: `run_${(i + 1).toString().padStart(4, "0")}`,
    name: `Nightly · ${new Date(startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    agentId: agents[i % agents.length].id,
    datasetId: datasets[i % datasets.length].id,
    rubricIds,
    score,
    passRate,
    cases,
    passed,
    failed: cases - passed,
    avgLatencyMs: 220 + Math.floor(r() * 600),
    costUsd: Number((0.004 + r() * 0.02).toFixed(4)),
    startedAt,
    durationSec: 40 + Math.floor(r() * 220),
    status: "completed",
    perRubric,
    ...opts,
  };
}

export const evalRuns: EvalRun[] = Array.from({ length: 12 }, (_, i) => buildRun(i));

export function scoreTone(score: number, threshold = 80) {
  if (score >= threshold) return "text-[var(--success)] bg-[color:rgb(34_197_94_/_0.10)]";
  if (score >= threshold - 10) return "text-[var(--warning)] bg-[color:rgb(245_158_11_/_0.10)]";
  return "text-[var(--danger)] bg-[color:rgb(239_68_68_/_0.10)]";
}

export function delta(a: number, b: number) {
  const d = a - b;
  return { value: d, label: `${d >= 0 ? "+" : ""}${d.toFixed(1)}` };
}
