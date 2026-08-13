import { describe, expect, it } from "vitest";
import {
  attemptsInWindow,
  defaultRemediationPolicy,
  evaluateRemediation,
  formatRetryAfter,
  normalizePolicy,
} from "@/lib/data/remediation-policy";

const now = 1_700_000_000_000;
const minutes = (n: number) => n * 60 * 1000;

describe("remediation policy guardrails", () => {
  it("allows an automatic run when the policy is auto and history is clean", () => {
    const d = evaluateRemediation({
      policy: { mode: "auto", maxPerHour: 3, cooldownMinutes: 10 },
      history: [],
      now,
    });
    expect(d.outcome).toBe("allow");
  });

  it("requires approval in approval mode for automatic triggers", () => {
    const d = evaluateRemediation({ policy: defaultRemediationPolicy, history: [], now });
    expect(d.outcome).toBe("needs_approval");
  });

  it("lets a human bypass the approval gate", () => {
    const d = evaluateRemediation({
      policy: defaultRemediationPolicy,
      history: [],
      now,
      humanInitiated: true,
    });
    expect(d.outcome).toBe("allow");
  });

  it("blocks manual-only policies from firing automatically", () => {
    const d = evaluateRemediation({
      policy: { mode: "manual", maxPerHour: 5, cooldownMinutes: 0 },
      history: [],
      now,
    });
    expect(d.outcome).toBe("blocked");
    expect(d.reason).toMatch(/manual/i);
  });

  it("enforces the cooldown even for human-initiated runs", () => {
    const d = evaluateRemediation({
      policy: { mode: "auto", maxPerHour: 10, cooldownMinutes: 10 },
      history: [now - minutes(4)],
      now,
      humanInitiated: true,
    });
    expect(d.outcome).toBe("blocked");
    expect(d.retryAfterMs).toBe(minutes(6));
  });

  it("enforces the hourly rate limit", () => {
    const history = [now - minutes(50), now - minutes(35), now - minutes(20)];
    const d = evaluateRemediation({
      policy: { mode: "auto", maxPerHour: 3, cooldownMinutes: 0 },
      history,
      now,
    });
    expect(d.outcome).toBe("blocked");
    expect(d.reason).toMatch(/Rate limit/);
    expect(d.retryAfterMs).toBe(minutes(10));
  });

  it("frees the budget once attempts age out of the window", () => {
    const history = [now - minutes(70), now - minutes(65), now - minutes(61)];
    expect(attemptsInWindow(history, now)).toBe(0);
    expect(
      evaluateRemediation({ policy: { mode: "auto", maxPerHour: 3, cooldownMinutes: 0 }, history, now }).outcome,
    ).toBe("allow");
  });

  it("normalizes malformed policies", () => {
    expect(normalizePolicy({ maxPerHour: 0, cooldownMinutes: -5 })).toEqual({
      mode: "approval",
      maxPerHour: 1,
      cooldownMinutes: 0,
    });
    expect(normalizePolicy(null)).toEqual(defaultRemediationPolicy);
  });

  it("formats retry windows", () => {
    expect(formatRetryAfter(0)).toBe("now");
    expect(formatRetryAfter(minutes(9))).toBe("9m");
    expect(formatRetryAfter(minutes(95))).toBe("1h 35m");
  });
});
