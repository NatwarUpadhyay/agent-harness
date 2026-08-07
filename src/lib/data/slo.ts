/**
 * SLO + error-budget math for the reliability console.
 *
 * Pure functions only — no React, no browser APIs — so they can be unit tested
 * and reused by any surface (route, export, future server function).
 */

export type SloKind = "availability" | "latency";
export type BurnSeverity = "ok" | "warning" | "critical";

export interface SloWindowSample {
  /** Minutes since the start of the window. */
  t: number;
  /** Requests observed in this bucket. */
  requests: number;
  /** Requests that violated the objective in this bucket. */
  bad: number;
}

export interface Slo {
  id: string;
  service: string;
  kind: SloKind;
  /** Objective as a percentage, e.g. 99.5 */
  target: number;
  /** Rolling window length in days. */
  windowDays: number;
  /** Latency threshold in ms — only meaningful for latency SLOs. */
  thresholdMs?: number;
  samples: SloWindowSample[];
}

export interface SloHealth {
  id: string;
  service: string;
  kind: SloKind;
  target: number;
  requests: number;
  bad: number;
  /** Achieved success rate over the window, as a percentage. */
  achieved: number;
  /** Allowed bad-event budget for the window. */
  budgetTotal: number;
  /** Bad events still available before the objective is breached. */
  budgetRemaining: number;
  /** Fraction of the error budget already consumed, 0–1 (can exceed 1). */
  consumed: number;
  /** Multiple of the sustainable burn rate over the last hour. */
  burnRate: number;
  severity: BurnSeverity;
  breached: boolean;
  /** Hours until the budget is exhausted at the current burn rate, null if safe. */
  hoursToExhaustion: number | null;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function errorBudget(target: number, requests: number): number {
  return requests * (1 - clamp(target, 0, 100) / 100);
}

/**
 * Burn rate = observed bad-event fraction over a slice divided by the fraction
 * the objective allows. 1x consumes the budget exactly over the window.
 */
export function burnRate(target: number, requests: number, bad: number): number {
  const allowed = 1 - clamp(target, 0, 100) / 100;
  if (requests <= 0 || allowed <= 0) return 0;
  return bad / requests / allowed;
}

export function severityFor(rate: number, consumed: number): BurnSeverity {
  if (rate >= 6 || consumed >= 1) return "critical";
  if (rate >= 2 || consumed >= 0.75) return "warning";
  return "ok";
}

/** Sum requests/bad over the trailing `minutes` of the sample series. */
export function trailing(samples: SloWindowSample[], minutes: number) {
  if (samples.length === 0) return { requests: 0, bad: 0 };
  const end = samples[samples.length - 1]!.t;
  return samples
    .filter((s) => s.t > end - minutes)
    .reduce(
      (acc, s) => ({ requests: acc.requests + s.requests, bad: acc.bad + s.bad }),
      { requests: 0, bad: 0 },
    );
}

export function evaluateSlo(slo: Slo): SloHealth {
  const requests = slo.samples.reduce((s, x) => s + x.requests, 0);
  const bad = slo.samples.reduce((s, x) => s + x.bad, 0);
  const budgetTotal = errorBudget(slo.target, requests);
  const budgetRemaining = budgetTotal - bad;
  const consumed = budgetTotal > 0 ? bad / budgetTotal : 0;
  const hour = trailing(slo.samples, 60);
  const rate = burnRate(slo.target, hour.requests, hour.bad);
  const achieved = requests > 0 ? ((requests - bad) / requests) * 100 : 100;

  let hoursToExhaustion: number | null = null;
  if (rate > 0 && budgetRemaining > 0) {
    const perHour = (budgetTotal * rate) / (slo.windowDays * 24);
    if (perHour > 0) hoursToExhaustion = budgetRemaining / perHour;
  } else if (budgetRemaining <= 0) {
    hoursToExhaustion = 0;
  }

  return {
    id: slo.id,
    service: slo.service,
    kind: slo.kind,
    target: slo.target,
    requests,
    bad,
    achieved,
    budgetTotal,
    budgetRemaining,
    consumed,
    burnRate: rate,
    severity: severityFor(rate, consumed),
    breached: budgetRemaining < 0,
    hoursToExhaustion,
  };
}

/** Cumulative budget consumption curve, as percentages, for the burn-down chart. */
export function burnDown(slo: Slo): Array<{ t: number; remaining: number; ideal: number }> {
  const requests = slo.samples.reduce((s, x) => s + x.requests, 0);
  const total = errorBudget(slo.target, requests) || 1;
  const span = slo.samples.length || 1;
  let used = 0;
  return slo.samples.map((s, i) => {
    used += s.bad;
    return {
      t: s.t,
      remaining: Math.max(0, 100 - (used / total) * 100),
      ideal: 100 - ((i + 1) / span) * 100,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Deterministic synthetic window so the console renders identically   */
/* on server and client (no hydration drift).                          */
/* ------------------------------------------------------------------ */

function pseudo(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeSamples(seed: number, badRate: number, spikeAt?: number): SloWindowSample[] {
  const rnd = pseudo(seed);
  return Array.from({ length: 96 }, (_, i) => {
    const requests = 400 + Math.floor(rnd() * 260);
    const spike = spikeAt !== undefined && i >= spikeAt ? 5.5 : 1;
    return {
      t: i * 15,
      requests,
      bad: Math.round(requests * badRate * spike * (0.6 + rnd() * 0.9)),
    };
  });
}

export const SEED_SLOS: Slo[] = [
  {
    id: "slo_gateway",
    service: "Inference gateway",
    kind: "availability",
    target: 99.9,
    windowDays: 28,
    samples: makeSamples(11, 0.0004),
  },
  {
    id: "slo_planner",
    service: "Planner service",
    kind: "latency",
    target: 99,
    windowDays: 28,
    thresholdMs: 1200,
    samples: makeSamples(23, 0.006, 78),
  },
  {
    id: "slo_retriever",
    service: "Retriever / vector search",
    kind: "latency",
    target: 99.5,
    windowDays: 28,
    thresholdMs: 400,
    samples: makeSamples(37, 0.0035),
  },
  {
    id: "slo_tools",
    service: "Tool execution",
    kind: "availability",
    target: 99.5,
    windowDays: 28,
    samples: makeSamples(53, 0.012, 60),
  },
  {
    id: "slo_memory",
    service: "Memory store",
    kind: "availability",
    target: 99.95,
    windowDays: 28,
    samples: makeSamples(71, 0.0002),
  },
];
