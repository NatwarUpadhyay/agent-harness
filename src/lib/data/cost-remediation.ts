/**
 * Cost anomaly auto-remediation.
 *
 * Turns detected spend anomalies into concrete, guarded remediation actions:
 * tighten enforcement on a breaching team, throttle a burn-rate spike, raise a
 * cap that is structurally too low, or assign an owner to unallocated spend.
 *
 * Guardrails are enforced here (not in the UI): hourly action caps, per-team
 * cooldowns, dry-run mode, and an approval requirement for destructive actions
 * such as hard-blocking a team's runs.
 *
 * All pure functions: unit-testable, no side effects.
 */

import type { Anomaly } from "./anomaly";

export type CostActionKind = "notify" | "throttle" | "block" | "raise_cap" | "assign_owner";

export interface CostAction {
  id: string;
  anomalyId: string;
  team: string;
  kind: CostActionKind;
  /** Why this action was chosen — shown verbatim in the console. */
  rationale: string;
  /** True when the action changes enforcement or caps in a way users feel. */
  destructive: boolean;
  /** New cap in USD for raise_cap actions. */
  capUsd?: number;
  severity: Anomaly["severity"];
}

export type SkipReason = "cooldown" | "hourly_cap" | "needs_approval" | "dry_run";

export interface PlannedAction extends CostAction {
  status: "ready" | "skipped";
  skipReason?: SkipReason;
}

export interface CostGuardrails {
  /** Maximum actions applied per rolling hour across all teams. */
  maxActionsPerHour: number;
  /** Minutes a team is exempt after a previous action. */
  cooldownMinutes: number;
  /** Plan only — never apply. */
  dryRun: boolean;
  /** Hold destructive actions (block, raise_cap) for a human. */
  requireApprovalForDestructive: boolean;
}

export const defaultCostGuardrails: CostGuardrails = {
  maxActionsPerHour: 4,
  cooldownMinutes: 60,
  dryRun: true,
  requireApprovalForDestructive: true,
};

export interface AppliedAction {
  actionId: string;
  team: string;
  kind: CostActionKind;
  /** Epoch ms. */
  at: number;
  capUsd?: number;
  message: string;
}

function round50(n: number): number {
  return Math.ceil(n / 50) * 50;
}

/** Map a single anomaly onto the action that best contains it. */
export function actionForAnomaly(a: Anomaly): CostAction | null {
  const base = { id: `act-${a.id}`, anomalyId: a.id, team: a.team, severity: a.severity };

  switch (a.type) {
    case "breach":
      return {
        ...base,
        kind: "block",
        destructive: true,
        rationale: `${a.team} is over cap — hard-block new runs until the cap is reviewed.`,
      };
    case "projected_breach": {
      if (a.severity === "critical" && a.expected && a.expected > 0) {
        return {
          ...base,
          kind: "raise_cap",
          destructive: true,
          capUsd: round50(a.observed * 1.1),
          rationale: `Forecast is far past cap — raise ${a.team}'s cap to $${round50(a.observed * 1.1).toLocaleString()} or the team stalls mid-month.`,
        };
      }
      return {
        ...base,
        kind: "throttle",
        destructive: false,
        rationale: `${a.team} trends past cap — throttle runs at 100% to land inside budget.`,
      };
    }
    case "spike":
      return {
        ...base,
        kind: "throttle",
        destructive: false,
        rationale: `Burn rate is a statistical outlier — throttle ${a.team} while the spike is investigated.`,
      };
    case "unallocated":
      return {
        ...base,
        kind: "assign_owner",
        destructive: false,
        rationale: `Spend has no owning team budget — assign an owner so it appears in chargeback.`,
      };
    default:
      return null;
  }
}

export interface PlanOptions {
  guardrails: CostGuardrails;
  history: AppliedAction[];
  /** Epoch ms; injected for deterministic tests. */
  now: number;
  /** Teams whose destructive actions the user already approved. */
  approvedTeams?: string[];
}

/**
 * Build the remediation plan, marking each action ready or skipped with the
 * guardrail that stopped it. Ordering is severity-first so the hourly cap is
 * spent on the worst offenders.
 */
export function planRemediation(anomalies: Anomaly[], options: PlanOptions): PlannedAction[] {
  const { guardrails, history, now } = options;
  const approved = new Set(options.approvedTeams ?? []);
  const rank = { critical: 3, warning: 2, info: 1 } as const;

  const candidates = anomalies
    .slice()
    .sort((x, y) => rank[y.severity] - rank[x.severity])
    .map(actionForAnomaly)
    .filter((a): a is CostAction => a !== null);

  const hourAgo = now - 60 * 60 * 1000;
  let appliedThisHour = history.filter((h) => h.at >= hourAgo).length;

  return candidates.map((action) => {
    const lastForTeam = history
      .filter((h) => h.team === action.team)
      .reduce((max, h) => Math.max(max, h.at), 0);
    const cooldownUntil = lastForTeam + guardrails.cooldownMinutes * 60 * 1000;

    if (lastForTeam > 0 && now < cooldownUntil) {
      return { ...action, status: "skipped", skipReason: "cooldown" };
    }
    if (guardrails.requireApprovalForDestructive && action.destructive && !approved.has(action.team)) {
      return { ...action, status: "skipped", skipReason: "needs_approval" };
    }
    if (guardrails.dryRun) {
      return { ...action, status: "skipped", skipReason: "dry_run" };
    }
    if (appliedThisHour >= guardrails.maxActionsPerHour) {
      return { ...action, status: "skipped", skipReason: "hourly_cap" };
    }
    appliedThisHour += 1;
    return { ...action, status: "ready" };
  });
}

export const skipCopy: Record<SkipReason, string> = {
  cooldown: "Team is in cooldown",
  hourly_cap: "Hourly action cap reached",
  needs_approval: "Awaiting approval",
  dry_run: "Dry run — plan only",
};

export const actionCopy: Record<CostActionKind, string> = {
  notify: "Notify owners",
  throttle: "Throttle runs",
  block: "Block new runs",
  raise_cap: "Raise cap",
  assign_owner: "Assign owner",
};

/** Turn a ready action into a ledger entry. */
export function toAppliedAction(action: PlannedAction, now: number): AppliedAction {
  return {
    actionId: action.id,
    team: action.team,
    kind: action.kind,
    at: now,
    ...(action.capUsd !== undefined ? { capUsd: action.capUsd } : {}),
    message: `${actionCopy[action.kind]} — ${action.team}`,
  };
}

export function planSummary(plan: PlannedAction[]): string {
  const ready = plan.filter((p) => p.status === "ready").length;
  const skipped = plan.length - ready;
  if (plan.length === 0) return "No remediation needed.";
  return `${ready} action${ready === 1 ? "" : "s"} ready, ${skipped} held by guardrails.`;
}

export function planCounts(plan: PlannedAction[]) {
  return {
    total: plan.length,
    ready: plan.filter((p) => p.status === "ready").length,
    skipped: plan.filter((p) => p.status === "skipped").length,
    destructive: plan.filter((p) => p.destructive).length,
  };
}
