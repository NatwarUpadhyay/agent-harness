/**
 * Anomaly detection for per-team AI spend.
 *
 * Scans attribution rows for statistical burn-rate spikes (z-score), active
 * cap breaches, projected month-end breaches, and unallocated spend that has no
 * owning team budget. The output is designed to be surfaced in the budget console
 * and escalated to the alert incident console with one click.
 *
 * All pure functions: unit-testable, no side effects, no client/server coupling.
 */

import type { AttributionRow, AttributionTotals } from "./spend-attribution";

export type AnomalyType = "spike" | "breach" | "projected_breach" | "unallocated";

export interface Anomaly {
  id: string;
  team: string;
  type: AnomalyType;
  severity: "critical" | "warning" | "info";
  message: string;
  /** Current observed value (USD/day for spikes, USD for spend, or USD for unallocated). */
  observed: number;
  /** Expected/baseline value, or null when no baseline exists. */
  expected: number | null;
  /** Threshold that triggered the anomaly (z-score, cap, or minimum USD). */
  threshold: number;
  dayOfPeriod: number;
}

export interface AnomalyOptions {
  dayOfPeriod: number;
  /** Z-score threshold for burn-rate spikes. */
  zThreshold?: number;
  /** Minimum unallocated USD to surface. */
  unallocatedMinUsd?: number;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => Math.pow(v - m, 2)));
  return Math.sqrt(variance);
}

function zScore(value: number, m: number, sd: number): number {
  if (sd === 0) return 0;
  return (value - m) / sd;
}

function makeId(team: string, type: AnomalyType, day: number): string {
  return `anomaly-${type}-${team.replace(/\s+/g, "-").toLowerCase()}-d${day}-${Date.now()}`;
}

export function detectAnomalies(
  rows: AttributionRow[],
  totals: AttributionTotals,
  options: AnomalyOptions,
): Anomaly[] {
  const day = Math.max(1, Math.floor(options.dayOfPeriod));
  const zThreshold = options.zThreshold ?? 2.0;
  const unallocatedMinUsd = options.unallocatedMinUsd ?? 0;
  const anomalies: Anomaly[] = [];

  const burns = rows.map((r) => r.burnPerDay);
  const m = mean(burns);
  const sd = stdDev(burns);

  for (const r of rows) {
    const z = zScore(r.burnPerDay, m, sd);

    if (r.attributed >= r.cap && r.cap > 0) {
      anomalies.push({
        id: makeId(r.team, "breach", day),
        team: r.team,
        type: "breach",
        severity: "critical",
        message: `${r.team} budget is breached — $${r.attributed.toLocaleString()} spent against $${r.cap.toLocaleString()} cap.`,
        observed: r.attributed,
        expected: r.cap,
        threshold: r.cap,
        dayOfPeriod: day,
      });
    } else if (r.forecast > r.cap && r.cap > 0) {
      anomalies.push({
        id: makeId(r.team, "projected_breach", day),
        team: r.team,
        type: "projected_breach",
        severity: r.forecast > r.cap * 1.2 ? "critical" : "warning",
        message: `${r.team} is projected to breach its $${r.cap.toLocaleString()} cap by month end ($${r.forecast.toLocaleString()} forecast).`,
        observed: r.forecast,
        expected: r.cap,
        threshold: r.cap,
        dayOfPeriod: day,
      });
    } else if (z > zThreshold && r.burnPerDay > 0) {
      anomalies.push({
        id: makeId(r.team, "spike", day),
        team: r.team,
        type: "spike",
        severity: z > 3 ? "critical" : "warning",
        message: `${r.team} burn rate ($${r.burnPerDay.toLocaleString()}/day) is ${z.toFixed(1)}σ above the fleet average.`,
        observed: r.burnPerDay,
        expected: round2(m),
        threshold: zThreshold,
        dayOfPeriod: day,
      });
    }
  }

  if (totals.unallocated > unallocatedMinUsd) {
    anomalies.push({
      id: makeId("Unassigned", "unallocated", day),
      team: "Unassigned",
      type: "unallocated",
      severity: totals.unallocated > 500 ? "warning" : "info",
      message: `$${totals.unallocated.toLocaleString()} of metered spend has no owning team budget.`,
      observed: totals.unallocated,
      expected: null,
      threshold: unallocatedMinUsd,
      dayOfPeriod: day,
    });
  }

  return anomalies.sort((a, b) =>
    severityRank(b.severity) - severityRank(a.severity) ||
    b.observed - a.observed,
  );
}

function severityRank(s: Anomaly["severity"]): number {
  return { critical: 3, warning: 2, info: 1 }[s];
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Count anomalies by severity. */
export function anomalyCounts(anomalies: Anomaly[]) {
  return {
    total: anomalies.length,
    critical: anomalies.filter((a) => a.severity === "critical").length,
    warning: anomalies.filter((a) => a.severity === "warning").length,
    info: anomalies.filter((a) => a.severity === "info").length,
  };
}

/** Human-readable summary of the most urgent anomalies. */
export function anomalySummary(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) return "No spend anomalies detected.";
  const counts = anomalyCounts(anomalies);
  return `${counts.total} anomaly${counts.total === 1 ? "" : "s"} detected (${counts.critical} critical, ${counts.warning} warning, ${counts.info} info).`;

}
