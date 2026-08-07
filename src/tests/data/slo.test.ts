import { describe, expect, it } from "vitest";
import {
  SEED_SLOS,
  burnDown,
  burnRate,
  errorBudget,
  evaluateSlo,
  severityFor,
  trailing,
  type Slo,
} from "@/lib/data/slo";

const slo = (target: number, samples: Slo["samples"]): Slo => ({
  id: "s",
  service: "svc",
  kind: "availability",
  target,
  windowDays: 28,
  samples,
});

describe("error budget", () => {
  it("scales with the allowed failure fraction", () => {
    expect(errorBudget(99, 1000)).toBeCloseTo(10);
    expect(errorBudget(99.9, 1000)).toBeCloseTo(1);
    expect(errorBudget(100, 1000)).toBe(0);
  });
});

describe("burn rate", () => {
  it("is 1x when consuming exactly the allowance", () => {
    expect(burnRate(99, 1000, 10)).toBeCloseTo(1);
  });

  it("scales linearly with bad events", () => {
    expect(burnRate(99, 1000, 40)).toBeCloseTo(4);
  });

  it("is zero with no traffic", () => {
    expect(burnRate(99, 0, 0)).toBe(0);
  });
});

describe("severity", () => {
  it("escalates on burn rate or consumption", () => {
    expect(severityFor(0.5, 0.1)).toBe("ok");
    expect(severityFor(3, 0.1)).toBe("warning");
    expect(severityFor(0.5, 0.8)).toBe("warning");
    expect(severityFor(9, 0.2)).toBe("critical");
    expect(severityFor(0.1, 1.2)).toBe("critical");
  });
});

describe("trailing window", () => {
  it("only sums the most recent minutes", () => {
    const samples = [
      { t: 0, requests: 100, bad: 10 },
      { t: 30, requests: 100, bad: 5 },
      { t: 60, requests: 100, bad: 1 },
    ];
    expect(trailing(samples, 60)).toEqual({ requests: 200, bad: 6 });
    expect(trailing([], 60)).toEqual({ requests: 0, bad: 0 });
  });
});

describe("evaluateSlo", () => {
  it("marks a breach once bad events exceed the budget", () => {
    const h = evaluateSlo(slo(99, [{ t: 0, requests: 1000, bad: 50 }]));
    expect(h.breached).toBe(true);
    expect(h.budgetRemaining).toBeLessThan(0);
    expect(h.hoursToExhaustion).toBe(0);
    expect(h.severity).toBe("critical");
  });

  it("reports a healthy objective with budget left", () => {
    const h = evaluateSlo(slo(99, [{ t: 0, requests: 10000, bad: 20 }]));
    expect(h.breached).toBe(false);
    expect(h.consumed).toBeLessThan(0.5);
    expect(h.achieved).toBeCloseTo(99.8);
    expect(h.severity).toBe("ok");
  });
});

describe("burnDown", () => {
  it("produces a monotonically non-increasing remaining curve", () => {
    const curve = burnDown(SEED_SLOS[1]!);
    expect(curve).toHaveLength(SEED_SLOS[1]!.samples.length);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.remaining).toBeLessThanOrEqual(curve[i - 1]!.remaining);
    }
    expect(curve[curve.length - 1]!.ideal).toBeCloseTo(0);
  });
});

describe("seed data", () => {
  it("contains at least one objective under pressure", () => {
    const health = SEED_SLOS.map(evaluateSlo);
    expect(health).toHaveLength(5);
    expect(health.some((h) => h.severity !== "ok")).toBe(true);
  });
});
