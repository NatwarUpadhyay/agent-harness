/**
 * Fleet-wide burn recommendations and savings simulator.
 *
 * Turns per-team attribution rows into actionable, finance-friendly guidance:
 * right-size over-provisioned caps, reallocate headroom to teams trending toward
 * breach, throttle statistical outliers, and create budgets for unallocated
 * spend. The simulator lets an owner model "what if" scenarios (reduce burn by
 * X%, shift Y dollars) before committing to policy changes.
 *
 * All pure functions: unit-testable, no side effects.
 */

import type { AttributionRow, AttributionTotals } from "./spend-attribution";

export type RecommendationKind =
  | "rightsize_cap"
  | "reallocate"
  | "throttle"
  | "create_budget"
  | "forecast_breach";

export interface BurnRecommendation {
  id: string;
  kind: RecommendationKind;
  team: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  /** Estimated USD impact if the recommendation is applied. */
  impactUsd: number;
  /** Human-readable impact, e.g. "~$1,200/mo". */
  impactCopy: string;
  /** Optional target value, e.g. new cap or throttle percentage. */
  targetValue?: number;
}

export interface FleetBurnSummary {
  totalCap: number;
  totalAttributed: number;
  totalForecast: number;
  unallocated: number;
  breaching: number;
  atRisk: number;
  healthy: number;
  /** Total headroom across all active budgets (cap - attributed, floored at 0). */
  headroom: number;
  /** Total projected overage across all active budgets (forecast - cap, floored at 0). */
  projectedOverage: number;
}

export interface SavingsScenario {
  /** 0..1 — global burn reduction from efficiency wins (e.g. caching, model swap). */
  efficiencyGain: number;
  /** Flat USD moved from low-utilization teams to high-utilization teams. */
  reallocateUsd: number;
  /** 0..1 — throttle intensity applied to teams with burn-rate spikes. */
  throttleReduction: number;
}

export interface SimulatedOutcome {
  originalForecast: number;
  simulatedForecast: number;
  savingsUsd: number;
  savingsPct: number;
  /** Teams that still breach after the scenario is applied. */
  remainingBreaches: string[];
  /** Teams that move from breach/at-risk to healthy. */
  rescuedTeams: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function makeId(team: string, kind: RecommendationKind): string {
  return `rec-${kind}-${team.replace(/\s+/g, "-").toLowerCase()}`;
}

export function fleetBurnSummary(
  rows: AttributionRow[],
  totals: AttributionTotals,
): FleetBurnSummary {
  const totalCap = rows.reduce((s, r) => s + r.cap, 0);
  const totalAttributed = totals.attributed;
  const totalForecast = totals.forecast;
  const headroom = rows.reduce((s, r) => s + Math.max(0, r.cap - r.attributed), 0);
  const projectedOverage = rows.reduce(
    (s, r) => s + Math.max(0, r.forecast - r.cap),
    0,
  );
  return {
    totalCap: round2(totalCap),
    totalAttributed: round2(totalAttributed),
    totalForecast: round2(totalForecast),
    unallocated: round2(totals.unallocated),
    breaching: totals.breaching,
    atRisk: totals.atRisk,
    healthy: rows.length - totals.breaching - totals.atRisk,
    headroom: round2(headroom),
    projectedOverage: round2(projectedOverage),
  };
}

/**
 * Generate fleet-wide burn recommendations from attribution rows.
 *
 * Logic:
 * - Teams under 40% utilization with >$500 headroom → rightsize cap.
 * - Teams forecast to breach with healthy teammates → reallocate headroom.
 * - Teams with >2σ burn rate → throttle.
 * - Unallocated spend >$100 → create a budget.
 */
export function generateRecommendations(
  rows: AttributionRow[],
  totals: AttributionTotals,
): BurnRecommendation[] {
  const recs: BurnRecommendation[] = [];
  const day: number = 21; // consistent with budgets page

  const meanBurn = rows.length
    ? rows.reduce((s, r) => s + r.burnPerDay, 0) / rows.length
    : 0;
  const stdBurn = Math.sqrt(
    rows.reduce((s, r) => s + Math.pow(r.burnPerDay - meanBurn, 2), 0) /
      Math.max(1, rows.length),
  );

  for (const r of rows) {
    const utilization = r.cap > 0 ? r.attributed / r.cap : 0;
    const headroom = Math.max(0, r.cap - r.attributed);
    const overage = Math.max(0, r.forecast - r.cap);
    const z = stdBurn > 0 ? (r.burnPerDay - meanBurn) / stdBurn : 0;

    if (r.forecast > r.cap && r.cap > 0) {
      recs.push({
        id: makeId(r.team, "forecast_breach"),
        kind: "forecast_breach",
        team: r.team,
        severity: r.forecast > r.cap * 1.2 ? "critical" : "warning",
        title: `${r.team} is projected to breach`,
        description: `Forecast $${r.forecast.toLocaleString()} exceeds the $${r.cap.toLocaleString()} cap by day ${day === 0 ? 1 : day}.`,
        impactUsd: round2(overage),
        impactCopy: `~$${Math.round(overage).toLocaleString()} projected overage`,
      });
    }

    if (utilization < 0.4 && headroom > 500) {
      const proposed = Math.max(r.attributed * 1.2, r.cap * 0.6);
      const savings = r.cap - proposed;
      recs.push({
        id: makeId(r.team, "rightsize_cap"),
        kind: "rightsize_cap",
        team: r.team,
        severity: "info",
        title: `Right-size ${r.team}'s cap`,
        description: `Only ${(utilization * 100).toFixed(0)}% utilized — reduce cap from $${r.cap.toLocaleString()} to ~$${Math.round(proposed).toLocaleString()} and free budget for growing teams.`,
        impactUsd: round2(Math.max(0, savings)),
        impactCopy: `~$${Math.round(Math.max(0, savings)).toLocaleString()} recoverable`,
        targetValue: round2(proposed),
      });
    }

    if (z > 1.5 && r.burnPerDay > meanBurn) {
      const throttlePct = Math.min(0.35, 0.15 + (z - 1.5) * 0.1);
      const savings = r.burnPerDay * throttlePct * day;
      recs.push({
        id: makeId(r.team, "throttle"),
        kind: "throttle",
        team: r.team,
        severity: z > 2.5 ? "critical" : "warning",
        title: `Throttle ${r.team}'s burn rate`,
        description: `Burn is ${z.toFixed(1)}σ above fleet average — a ${(throttlePct * 100).toFixed(0)}% reduction keeps spend inside the trend.`,
        impactUsd: round2(savings),
        impactCopy: `~$${Math.round(savings).toLocaleString()}/mo saved`,
        targetValue: round2(throttlePct * 100),
      });
    }
  }

  // Reallocate: find forecast-breach rows and pool headroom from healthy rows.
  const breachers = rows.filter((r) => r.forecast > r.cap && r.cap > 0);
  const healthy = rows.filter(
    (r) => r.status === "healthy" && r.forecast < r.cap * 0.8,
  );
  const poolable = healthy.reduce(
    (s, r) => s + Math.max(0, r.cap * 0.8 - r.forecast),
    0,
  );
  if (breachers.length > 0 && poolable > 0) {
    const totalNeed = breachers.reduce(
      (s, r) => s + Math.max(0, r.forecast - r.cap),
      0,
    );
    const moved = Math.min(poolable, totalNeed);
    recs.push({
      id: makeId("fleet", "reallocate"),
      kind: "reallocate",
      team: "Fleet",
      severity: "warning",
      title: "Reallocate headroom across teams",
      description: `${breachers.length} team${breachers.length === 1 ? "" : "s"} need extra budget; ${healthy.length} healthy team${healthy.length === 1 ? "" : "s"} have $${Math.round(poolable).toLocaleString()} of poolable headroom.`,
      impactUsd: round2(moved),
      impactCopy: `~$${Math.round(moved).toLocaleString()} can be reallocated`,
      targetValue: round2(moved),
    });
  }

  if (totals.unallocated > 100) {
    recs.push({
      id: makeId("unassigned", "create_budget"),
      kind: "create_budget",
      team: "Unassigned",
      severity: totals.unallocated > 500 ? "warning" : "info",
      title: "Create a budget for unallocated spend",
      description: `$${totals.unallocated.toLocaleString()} of metered spend has no owning team budget. Assigning it makes the cost accountable in chargeback.`,
      impactUsd: round2(totals.unallocated),
      impactCopy: `$${Math.round(totals.unallocated).toLocaleString()} to allocate`,
    });
  }

  const rank = { critical: 3, warning: 2, info: 1 } as const;
  return recs.sort(
    (a, b) =>
      rank[b.severity] - rank[a.severity] || b.impactUsd - a.impactUsd,
  );
}

/**
 * Simulate the effect of efficiency, reallocation, and throttle levers on the
 * fleet forecast. Returns the new forecast, estimated savings, and which teams
 * are rescued or still breaching.
 */
export function simulateSavings(
  rows: AttributionRow[],
  totals: AttributionTotals,
  scenario: SavingsScenario,
): SimulatedOutcome {
  const originalForecast = totals.forecast;
  const days = 30;

  let simulatedForecast = 0;
  const remainingBreaches: string[] = [];
  const rescuedTeams: string[] = [];

  const totalNeed = rows
    .filter((r) => r.forecast > r.cap && r.cap > 0)
    .reduce((s, r) => s + Math.max(0, r.forecast - r.cap), 0);
  const healthyHeadroom = rows
    .filter((r) => r.status === "healthy" && r.forecast < r.cap * 0.8)
    .reduce((s, r) => s + Math.max(0, r.cap * 0.8 - r.forecast), 0);
  const actualReallocate = Math.min(
    scenario.reallocateUsd,
    healthyHeadroom,
    totalNeed,
  );

  for (const r of rows) {
    // Derive new forecast from the original forecast so a neutral scenario
    // reproduces the baseline exactly (avoids rounding drift from burnPerDay).
    let newForecast = r.forecast * (1 - scenario.efficiencyGain);

    if (r.burnPerDay > 0) {
      const meanBurn =
        rows.reduce((s, x) => s + x.burnPerDay, 0) / Math.max(1, rows.length);
      const stdBurn = Math.sqrt(
        rows.reduce((s, x) => s + Math.pow(x.burnPerDay - meanBurn, 2), 0) /
          Math.max(1, rows.length),
      );
      const z = stdBurn > 0 ? (r.burnPerDay - meanBurn) / stdBurn : 0;
      if (z > 1.5) {
        newForecast = newForecast * (1 - scenario.throttleReduction);
      }
    }

    let newCap = r.cap;
    if (r.forecast > r.cap && r.cap > 0 && actualReallocate > 0 && totalNeed > 0) {
      const need = Math.max(0, r.forecast - r.cap);
      const share = need / totalNeed;
      newCap = r.cap + actualReallocate * share;
    }

    newForecast = round2(newForecast);
    simulatedForecast += newForecast;

    const wasTroubled = r.status === "breached" || r.status === "at-risk";
    const nowBreached = newCap > 0 && newForecast > newCap;
    if (nowBreached) {
      remainingBreaches.push(r.team);
    } else if (wasTroubled) {
      rescuedTeams.push(r.team);
    }
  }

  simulatedForecast = round2(simulatedForecast);
  const savingsUsd = Math.max(0, originalForecast - simulatedForecast);
  const savingsPct =
    originalForecast > 0 ? (savingsUsd / originalForecast) * 100 : 0;

  return {
    originalForecast: round2(originalForecast),
    simulatedForecast: round2(simulatedForecast),
    savingsUsd: round2(savingsUsd),
    savingsPct: round2(savingsPct),
    remainingBreaches,
    rescuedTeams,
  };
}

export function recommendationSummary(recs: BurnRecommendation[]): string {
  if (recs.length === 0) return "No burn recommendations — fleet looks healthy.";
  const critical = recs.filter((r) => r.severity === "critical").length;
  const warning = recs.filter((r) => r.severity === "warning").length;
  const info = recs.filter((r) => r.severity === "info").length;
  const totalImpact = recs.reduce((s, r) => s + r.impactUsd, 0);
  return `${recs.length} recommendation${recs.length === 1 ? "" : "s"} (${critical} critical, ${warning} warning, ${info} info) with ~$${Math.round(totalImpact).toLocaleString()} of impact.`;
}
