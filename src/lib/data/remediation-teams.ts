/**
 * Per-team remediation budgets and guardrail inheritance.
 *
 * Enterprises don't run one global automation budget — platform, payments and
 * support teams each own their blast radius. A team carries a daily budget of
 * allowed remediations plus optional guardrail overrides; the effective policy
 * for a rule is the STRICTEST of org defaults, team overrides and the rule's
 * own settings, so a team budget can never be loosened further down the chain.
 *
 * All pure functions: unit-testable and shared by the console and the server.
 */

import {
  normalizePolicy,
  type RemediationMode,
  type RemediationPolicy,
} from "./remediation-policy";

export interface TeamBudget {
  id: string;
  name: string;
  /** Maximum allowed remediations for this team in a rolling 24 hours. */
  dailyBudget: number;
  /** Optional tightenings of the org defaults. */
  mode?: RemediationMode;
  maxPerHour?: number;
  cooldownMinutes?: number;
}

const MODE_STRICTNESS: Record<RemediationMode, number> = {
  manual: 2,
  approval: 1,
  auto: 0,
};

export function normalizeTeam(team: Partial<TeamBudget> | null | undefined): TeamBudget {
  return {
    id: team?.id || `team_${Math.random().toString(36).slice(2, 9)}`,
    name: (team?.name ?? "").trim() || "Untitled team",
    dailyBudget: Math.max(0, Math.floor(team?.dailyBudget ?? 10)),
    ...(team?.mode ? { mode: team.mode } : {}),
    ...(team?.maxPerHour !== undefined
      ? { maxPerHour: Math.max(1, Math.floor(team.maxPerHour)) }
      : {}),
    ...(team?.cooldownMinutes !== undefined
      ? { cooldownMinutes: Math.max(0, team.cooldownMinutes) }
      : {}),
  };
}

/** The tighter of two policies, field by field. */
export function strictestPolicy(a: RemediationPolicy, b: RemediationPolicy): RemediationPolicy {
  const left = normalizePolicy(a);
  const right = normalizePolicy(b);
  return {
    mode: MODE_STRICTNESS[left.mode] >= MODE_STRICTNESS[right.mode] ? left.mode : right.mode,
    maxPerHour: Math.min(left.maxPerHour, right.maxPerHour),
    cooldownMinutes: Math.max(left.cooldownMinutes, right.cooldownMinutes),
  };
}

/** Org defaults with the team's overrides applied (overrides can only tighten). */
export function resolveTeamPolicy(
  orgDefaults: Partial<RemediationPolicy> | null | undefined,
  team?: TeamBudget | null,
): RemediationPolicy {
  const base = normalizePolicy(orgDefaults);
  if (!team) return base;
  const override = normalizePolicy({
    mode: team.mode ?? base.mode,
    maxPerHour: team.maxPerHour ?? base.maxPerHour,
    cooldownMinutes: team.cooldownMinutes ?? base.cooldownMinutes,
  });
  return strictestPolicy(base, override);
}

/**
 * Full inheritance chain: org defaults -> team overrides -> rule overrides.
 * Every step may only tighten what the step above it allowed.
 */
export function resolveEffectivePolicy(input: {
  orgDefaults?: Partial<RemediationPolicy> | null;
  team?: TeamBudget | null;
  rulePolicy?: Partial<RemediationPolicy> | null;
}): RemediationPolicy {
  const teamPolicy = resolveTeamPolicy(input.orgDefaults, input.team);
  if (!input.rulePolicy) return teamPolicy;
  return strictestPolicy(teamPolicy, normalizePolicy(input.rulePolicy));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BudgetAttempt {
  team_id?: string | null;
  outcome: string;
  created_at: string;
}

/** Allowed remediations charged to a team inside the rolling day ending at `now`. */
export function teamUsage(attempts: BudgetAttempt[], teamId: string, now = Date.now()): number {
  return attempts.filter((a) => {
    if (a.team_id !== teamId || a.outcome !== "allow") return false;
    const t = new Date(a.created_at).getTime();
    return Number.isFinite(t) && now - t < DAY_MS && now - t >= 0;
  }).length;
}

export interface BudgetVerdict {
  exceeded: boolean;
  used: number;
  budget: number;
  /** 0..1, clamped. */
  share: number;
  reason?: string;
}

export function evaluateTeamBudget(team: TeamBudget, used: number): BudgetVerdict {
  const budget = Math.max(0, Math.floor(team.dailyBudget));
  const share = budget === 0 ? 1 : Math.min(1, used / budget);
  if (used >= budget) {
    return {
      exceeded: true,
      used,
      budget,
      share: 1,
      reason:
        budget === 0
          ? `Team "${team.name}" has no remediation budget — automation is off`
          : `Team daily budget exhausted — ${used}/${budget} for "${team.name}"`,
    };
  }
  return { exceeded: false, used, budget, share };
}

export interface TeamSummary extends BudgetVerdict {
  team: TeamBudget;
  policy: RemediationPolicy;
  /** Attempts of any outcome charged to this team in the window. */
  attempts: number;
  blocked: number;
}

export function summarizeTeams(
  teams: TeamBudget[],
  attempts: BudgetAttempt[],
  orgDefaults?: Partial<RemediationPolicy> | null,
  now = Date.now(),
): TeamSummary[] {
  return teams.map((raw) => {
    const team = normalizeTeam(raw);
    const inWindow = attempts.filter((a) => {
      if (a.team_id !== team.id) return false;
      const t = new Date(a.created_at).getTime();
      return Number.isFinite(t) && now - t < DAY_MS && now - t >= 0;
    });
    const used = inWindow.filter((a) => a.outcome === "allow").length;
    return {
      team,
      policy: resolveTeamPolicy(orgDefaults, team),
      attempts: inWindow.length,
      blocked: inWindow.filter((a) => a.outcome === "blocked").length,
      ...evaluateTeamBudget(team, used),
    };
  });
}

export function defaultTeam(): TeamBudget {
  return normalizeTeam({ name: "", dailyBudget: 10 });
}
