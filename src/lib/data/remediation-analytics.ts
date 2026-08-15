/**
 * Remediation ledger analytics.
 *
 * Pure summarisation over the persisted `remediation_attempts` rows so the
 * console can answer the questions an SRE lead actually asks: how often does
 * automation fire, how often does policy stop it, which rules are noisy, and
 * do the runs it triggers actually succeed.
 */

import type { RemediationOutcome } from "./remediation-policy";

export interface AttemptRow {
  id?: string;
  created_at: string;
  rule_id: string;
  rule_name: string;
  outcome: string;
  reason?: string | null;
  human_initiated?: boolean | null;
  run_status?: string | null;
  workflow_name?: string | null;
}

export interface OutcomeTotals {
  total: number;
  allow: number;
  needs_approval: number;
  blocked: number;
}

export interface RuleSummary {
  ruleId: string;
  ruleName: string;
  total: number;
  allowed: number;
  needsApproval: number;
  blocked: number;
  humanInitiated: number;
  runFailures: number;
  lastAt: number | null;
  /** Share of attempts that policy permitted, 0..1. */
  allowRate: number;
}

export interface HourBucket {
  /** Hours before `now`, 23 = oldest. */
  hoursAgo: number;
  label: string;
  allow: number;
  needs_approval: number;
  blocked: number;
}

export interface ReasonCount {
  reason: string;
  count: number;
}

export interface LedgerAnalytics {
  totals: OutcomeTotals;
  allowRate: number;
  automationShare: number;
  runSuccessRate: number;
  rules: RuleSummary[];
  hourly: HourBucket[];
  topBlockReasons: ReasonCount[];
  busiestRule: RuleSummary | null;
}

const HOUR_MS = 60 * 60 * 1000;

function isOutcome(value: string): value is RemediationOutcome {
  return value === "allow" || value === "needs_approval" || value === "blocked";
}

function ts(row: AttemptRow): number {
  const t = new Date(row.created_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

export function summarizeLedger(rows: AttemptRow[], now = Date.now()): LedgerAnalytics {
  const clean = rows.filter((r) => isOutcome(r.outcome));

  const totals: OutcomeTotals = { total: clean.length, allow: 0, needs_approval: 0, blocked: 0 };
  const byRule = new Map<string, RuleSummary>();
  const reasons = new Map<string, number>();
  let humanTotal = 0;
  let runsRecorded = 0;
  let runsSucceeded = 0;

  const hourly: HourBucket[] = Array.from({ length: 24 }, (_, i) => {
    const hoursAgo = 23 - i;
    return {
      hoursAgo,
      label: hoursAgo === 0 ? "now" : `-${hoursAgo}h`,
      allow: 0,
      needs_approval: 0,
      blocked: 0,
    };
  });

  for (const row of clean) {
    const outcome = row.outcome as RemediationOutcome;
    totals[outcome] += 1;

    const at = ts(row);
    const human = row.human_initiated === true;
    if (human) humanTotal += 1;

    if (row.run_status) {
      runsRecorded += 1;
      if (row.run_status === "succeeded") runsSucceeded += 1;
    }

    if (outcome === "blocked" && row.reason) {
      reasons.set(row.reason, (reasons.get(row.reason) ?? 0) + 1);
    }

    const bucketAge = Math.floor((now - at) / HOUR_MS);
    if (bucketAge >= 0 && bucketAge < 24) {
      const bucket = hourly.find((b) => b.hoursAgo === bucketAge);
      if (bucket) bucket[outcome] += 1;
    }

    const existing = byRule.get(row.rule_id) ?? {
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      total: 0,
      allowed: 0,
      needsApproval: 0,
      blocked: 0,
      humanInitiated: 0,
      runFailures: 0,
      lastAt: null,
      allowRate: 0,
    };
    existing.total += 1;
    if (outcome === "allow") existing.allowed += 1;
    if (outcome === "needs_approval") existing.needsApproval += 1;
    if (outcome === "blocked") existing.blocked += 1;
    if (human) existing.humanInitiated += 1;
    if (row.run_status === "failed") existing.runFailures += 1;
    existing.lastAt = existing.lastAt === null ? at : Math.max(existing.lastAt, at);
    existing.ruleName = row.rule_name || existing.ruleName;
    byRule.set(row.rule_id, existing);
  }

  const rules = Array.from(byRule.values())
    .map((r) => ({ ...r, allowRate: ratio(r.allowed, r.total) }))
    .sort((a, b) => b.total - a.total || a.ruleName.localeCompare(b.ruleName));

  const topBlockReasons = Array.from(reasons.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, 5);

  return {
    totals,
    allowRate: ratio(totals.allow, totals.total),
    automationShare: ratio(totals.total - humanTotal, totals.total),
    runSuccessRate: ratio(runsSucceeded, runsRecorded),
    rules,
    hourly,
    topBlockReasons,
    busiestRule: rules[0] ?? null,
  };
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}
