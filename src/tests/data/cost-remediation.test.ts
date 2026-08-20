import { describe, expect, it } from "vitest";
import {
  actionForAnomaly,
  planRemediation,
  planCounts,
  planSummary,
  toAppliedAction,
  defaultCostGuardrails,
  type AppliedAction,
  type CostGuardrails,
} from "@/lib/data/cost-remediation";
import type { Anomaly } from "@/lib/data/anomaly";

function anomaly(partial: Partial<Anomaly>): Anomaly {
  return {
    id: "a1",
    team: "Platform",
    type: "spike",
    severity: "warning",
    message: "",
    observed: 100,
    expected: 50,
    threshold: 1.5,
    dayOfPeriod: 10,
    ...partial,
  };
}

const NOW = 1_700_000_000_000;
const live: CostGuardrails = { ...defaultCostGuardrails, dryRun: false, requireApprovalForDestructive: false };

describe("actionForAnomaly", () => {
  it("blocks a team that is already over cap", () => {
    const action = actionForAnomaly(anomaly({ type: "breach", severity: "critical" }))!;
    expect(action.kind).toBe("block");
    expect(action.destructive).toBe(true);
  });

  it("throttles a warning-level projected breach", () => {
    const action = actionForAnomaly(anomaly({ type: "projected_breach", severity: "warning" }))!;
    expect(action.kind).toBe("throttle");
    expect(action.destructive).toBe(false);
  });

  it("raises the cap for a critical projected breach", () => {
    const action = actionForAnomaly(anomaly({ type: "projected_breach", severity: "critical", observed: 1800, expected: 1000 }))!;
    expect(action.kind).toBe("raise_cap");
    expect(action.capUsd).toBe(2000);
  });

  it("throttles a burn-rate spike", () => {
    expect(actionForAnomaly(anomaly({ type: "spike" }))!.kind).toBe("throttle");
  });

  it("assigns an owner for unallocated spend", () => {
    const action = actionForAnomaly(anomaly({ type: "unallocated", team: "Unassigned", severity: "info" }))!;
    expect(action.kind).toBe("assign_owner");
  });
});

describe("planRemediation", () => {
  it("marks actions ready when guardrails allow", () => {
    const plan = planRemediation([anomaly({ type: "spike" })], { guardrails: live, history: [], now: NOW });
    expect(plan).toHaveLength(1);
    expect(plan[0]!.status).toBe("ready");
  });

  it("holds every action in dry-run mode", () => {
    const plan = planRemediation([anomaly({ type: "spike" })], {
      guardrails: { ...live, dryRun: true }, history: [], now: NOW,
    });
    expect(plan[0]!.status).toBe("skipped");
    expect(plan[0]!.skipReason).toBe("dry_run");
  });

  it("holds destructive actions for approval", () => {
    const plan = planRemediation([anomaly({ type: "breach", severity: "critical" })], {
      guardrails: { ...live, requireApprovalForDestructive: true }, history: [], now: NOW,
    });
    expect(plan[0]!.skipReason).toBe("needs_approval");
  });

  it("applies destructive actions for approved teams", () => {
    const plan = planRemediation([anomaly({ type: "breach", severity: "critical", team: "Finance" })], {
      guardrails: { ...live, requireApprovalForDestructive: true },
      history: [],
      now: NOW,
      approvedTeams: ["Finance"],
    });
    expect(plan[0]!.status).toBe("ready");
  });

  it("skips a team inside its cooldown window", () => {
    const history: AppliedAction[] = [
      { actionId: "x", team: "Platform", kind: "throttle", at: NOW - 10 * 60 * 1000, message: "" },
    ];
    const plan = planRemediation([anomaly({ type: "spike" })], { guardrails: live, history, now: NOW });
    expect(plan[0]!.skipReason).toBe("cooldown");
  });

  it("allows a team again once cooldown expires", () => {
    const history: AppliedAction[] = [
      { actionId: "x", team: "Platform", kind: "throttle", at: NOW - 3 * 60 * 60 * 1000, message: "" },
    ];
    const plan = planRemediation([anomaly({ type: "spike" })], { guardrails: live, history, now: NOW });
    expect(plan[0]!.status).toBe("ready");
  });

  it("enforces the hourly action cap", () => {
    const anomalies = ["A", "B", "C"].map((t, i) =>
      anomaly({ id: `a${i}`, team: t, type: "spike" }),
    );
    const plan = planRemediation(anomalies, {
      guardrails: { ...live, maxActionsPerHour: 2 }, history: [], now: NOW,
    });
    expect(plan.filter((p) => p.status === "ready")).toHaveLength(2);
    expect(plan.find((p) => p.skipReason === "hourly_cap")).toBeDefined();
  });

  it("counts prior history against the hourly cap", () => {
    const history: AppliedAction[] = [
      { actionId: "h1", team: "Other", kind: "throttle", at: NOW - 5 * 60 * 1000, message: "" },
      { actionId: "h2", team: "Else", kind: "throttle", at: NOW - 6 * 60 * 1000, message: "" },
    ];
    const plan = planRemediation([anomaly({ type: "spike" })], {
      guardrails: { ...live, maxActionsPerHour: 2 }, history, now: NOW,
    });
    expect(plan[0]!.skipReason).toBe("hourly_cap");
  });

  it("orders critical anomalies first so the cap is spent on the worst", () => {
    const anomalies = [
      anomaly({ id: "low", team: "Low", type: "spike", severity: "info" }),
      anomaly({ id: "high", team: "High", type: "spike", severity: "critical" }),
    ];
    const plan = planRemediation(anomalies, {
      guardrails: { ...live, maxActionsPerHour: 1 }, history: [], now: NOW,
    });
    expect(plan[0]!.team).toBe("High");
    expect(plan[0]!.status).toBe("ready");
    expect(plan[1]!.skipReason).toBe("hourly_cap");
  });
});

describe("plan reporting", () => {
  it("summarizes an empty plan", () => {
    expect(planSummary([])).toBe("No remediation needed.");
  });

  it("summarizes ready vs held actions", () => {
    const plan = planRemediation([anomaly({ type: "spike" })], { guardrails: live, history: [], now: NOW });
    expect(planSummary(plan)).toBe("1 action ready, 0 held by guardrails.");
    expect(planCounts(plan)).toEqual({ total: 1, ready: 1, skipped: 0, destructive: 0 });
  });

  it("builds a ledger entry from a ready action", () => {
    const plan = planRemediation([anomaly({ type: "spike" })], { guardrails: live, history: [], now: NOW });
    const entry = toAppliedAction(plan[0]!, NOW);
    expect(entry.team).toBe("Platform");
    expect(entry.kind).toBe("throttle");
    expect(entry.at).toBe(NOW);
    expect(entry.message).toContain("Throttle runs");
  });
});
