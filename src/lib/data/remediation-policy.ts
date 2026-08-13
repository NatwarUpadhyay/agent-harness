/**
 * Remediation policy guardrails.
 *
 * Auto-remediation is only trustworthy when it is rate-limited, cooled down and
 * (optionally) gated behind a human approval. These are pure functions so the
 * decision logic is unit-testable and shared by the incident console and any
 * future server-side trigger path.
 */

export type RemediationMode = "manual" | "approval" | "auto";

export interface RemediationPolicy {
  /** manual = never fires itself, approval = needs a human OK, auto = fires immediately. */
  mode: RemediationMode;
  /** Maximum automatic remediation attempts allowed in any rolling hour. */
  maxPerHour: number;
  /** Minimum gap between two attempts for the same rule, in minutes. */
  cooldownMinutes: number;
}

export const defaultRemediationPolicy: RemediationPolicy = {
  mode: "approval",
  maxPerHour: 3,
  cooldownMinutes: 10,
};

export type RemediationOutcome = "allow" | "needs_approval" | "blocked";

export interface RemediationDecision {
  outcome: RemediationOutcome;
  reason: string;
  /** Milliseconds until the next attempt is permitted (cooldown / rate limit). */
  retryAfterMs?: number;
}

export interface RemediationDecisionInput {
  policy: RemediationPolicy;
  /** Epoch-ms timestamps of previous remediation attempts for this rule. */
  history: number[];
  now: number;
  /** True when a human clicked "Remediate" or approved a pending request. */
  humanInitiated?: boolean;
}

const HOUR_MS = 60 * 60 * 1000;

export function normalizePolicy(policy?: Partial<RemediationPolicy> | null): RemediationPolicy {
  return {
    mode: policy?.mode ?? defaultRemediationPolicy.mode,
    maxPerHour: Math.max(1, Math.floor(policy?.maxPerHour ?? defaultRemediationPolicy.maxPerHour)),
    cooldownMinutes: Math.max(0, policy?.cooldownMinutes ?? defaultRemediationPolicy.cooldownMinutes),
  };
}

/** Attempts inside the rolling hour ending at `now`. */
export function attemptsInWindow(history: number[], now: number, windowMs = HOUR_MS): number {
  return history.filter((t) => now - t < windowMs && now - t >= 0).length;
}

export function evaluateRemediation(input: RemediationDecisionInput): RemediationDecision {
  const policy = normalizePolicy(input.policy);
  const { now, history, humanInitiated = false } = input;

  const last = history.length ? Math.max(...history) : null;
  const cooldownMs = policy.cooldownMinutes * 60 * 1000;
  if (last !== null && cooldownMs > 0 && now - last < cooldownMs) {
    return {
      outcome: "blocked",
      reason: `Cooldown active — ${policy.cooldownMinutes}m between attempts`,
      retryAfterMs: cooldownMs - (now - last),
    };
  }

  const used = attemptsInWindow(history, now);
  if (used >= policy.maxPerHour) {
    const oldest = Math.min(...history.filter((t) => now - t < HOUR_MS));
    return {
      outcome: "blocked",
      reason: `Rate limit reached — ${used}/${policy.maxPerHour} attempts this hour`,
      retryAfterMs: HOUR_MS - (now - oldest),
    };
  }

  if (humanInitiated) {
    return { outcome: "allow", reason: "Human-initiated remediation" };
  }

  if (policy.mode === "manual") {
    return { outcome: "blocked", reason: "Policy is manual-only — remediate by hand" };
  }
  if (policy.mode === "approval") {
    return { outcome: "needs_approval", reason: "Approval gate — waiting for an operator" };
  }
  return { outcome: "allow", reason: `Auto-remediation allowed (${used + 1}/${policy.maxPerHour} this hour)` };
}

export function formatRetryAfter(ms?: number): string {
  if (!ms || ms <= 0) return "now";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
