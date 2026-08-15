import { describe, expect, it } from "vitest";
import { summarizeLedger, formatPercent, type AttemptRow } from "@/lib/data/remediation-analytics";

const NOW = new Date("2026-05-01T12:00:00.000Z").getTime();
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * 3600_000).toISOString();

const rows: AttemptRow[] = [
  { created_at: at(0.2), rule_id: "r1", rule_name: "Latency spike", outcome: "allow", run_status: "succeeded", human_initiated: false },
  { created_at: at(1.2), rule_id: "r1", rule_name: "Latency spike", outcome: "blocked", reason: "Cooldown active — 10m between attempts" },
  { created_at: at(2.5), rule_id: "r1", rule_name: "Latency spike", outcome: "blocked", reason: "Cooldown active — 10m between attempts" },
  { created_at: at(3.0), rule_id: "r2", rule_name: "Error budget", outcome: "needs_approval", reason: "Approval gate — waiting for an operator" },
  { created_at: at(4.0), rule_id: "r2", rule_name: "Error budget", outcome: "allow", run_status: "failed", human_initiated: true },
  { created_at: at(40), rule_id: "r2", rule_name: "Error budget", outcome: "allow", run_status: "succeeded" },
  { created_at: at(1), rule_id: "r3", rule_name: "Bogus", outcome: "weird" },
];

describe("summarizeLedger", () => {
  const a = summarizeLedger(rows, NOW);

  it("ignores unknown outcomes", () => {
    expect(a.totals.total).toBe(6);
    expect(a.rules.some((r) => r.ruleId === "r3")).toBe(false);
  });

  it("counts outcomes and derives allow rate", () => {
    expect(a.totals).toEqual({ total: 6, allow: 3, needs_approval: 1, blocked: 2 });
    expect(a.allowRate).toBeCloseTo(0.5);
  });

  it("computes automation share and run success rate", () => {
    // 1 of 6 attempts was human initiated
    expect(a.automationShare).toBeCloseTo(5 / 6);
    // 3 attempts recorded a run status, 2 succeeded
    expect(a.runSuccessRate).toBeCloseTo(2 / 3);
  });

  it("summarizes per rule sorted by volume", () => {
    expect(a.rules[0].ruleId).toBe("r1");
    expect(a.rules[0]).toMatchObject({ total: 3, allowed: 1, blocked: 2, runFailures: 0 });
    expect(a.rules[0].allowRate).toBeCloseTo(1 / 3);
    const r2 = a.rules.find((r) => r.ruleId === "r2")!;
    expect(r2).toMatchObject({ total: 3, allowed: 2, needsApproval: 1, humanInitiated: 1, runFailures: 1 });
    expect(a.busiestRule?.ruleId).toBe("r1");
  });

  it("buckets only the last 24 hours", () => {
    expect(a.hourly).toHaveLength(24);
    const total = a.hourly.reduce((s, b) => s + b.allow + b.blocked + b.needs_approval, 0);
    expect(total).toBe(5); // the 40h-old row is out of window
    expect(a.hourly[23]).toMatchObject({ hoursAgo: 0, allow: 1 });
  });

  it("ranks block reasons", () => {
    expect(a.topBlockReasons[0]).toEqual({
      reason: "Cooldown active — 10m between attempts",
      count: 2,
    });
  });

  it("handles an empty ledger without dividing by zero", () => {
    const empty = summarizeLedger([], NOW);
    expect(empty.allowRate).toBe(0);
    expect(empty.runSuccessRate).toBe(0);
    expect(empty.busiestRule).toBeNull();
    expect(empty.hourly).toHaveLength(24);
  });
});

describe("formatPercent", () => {
  it("formats fractions", () => {
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(0.1234, 1)).toBe("12.3%");
  });
});
