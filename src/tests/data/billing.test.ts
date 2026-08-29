import { describe, expect, it } from "vitest";
import {
  toPlan,
  toMeter,
  parseLimits,
  parseFeatures,
  defaultMeters,
  checkEntitlement,
  formatMeterValue,
  planDisplayName,
  type BillingPlan,
  type UsageMeter,
} from "@/lib/data/billing";

const basePlan: BillingPlan = {
  id: "plan_1",
  user_id: "user_1",
  name: "Team",
  price_usd: 49,
  billing_interval: "monthly",
  limits: { seats: 10, runs_per_month: 5_000, tokens_per_month: 1_000_000, cost_usd_per_month: 1_000 },
  features: ["Canvas", "Simulate"],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function makeMeters(overrides: Partial<Record<UsageMeter["name"], number>> = {}): UsageMeter[] {
  const base = { id: "m", user_id: "user_1", plan_id: "plan_1", period_start: "2026-01-01T00:00:00Z", period_end: "2026-02-01T00:00:00Z", created_at: "", updated_at: "" };
  return [
    { ...base, name: "seats", current_value: overrides.seats ?? 1, limit_value: basePlan.limits.seats },
    { ...base, name: "runs", current_value: overrides.runs ?? 0, limit_value: basePlan.limits.runs_per_month },
    { ...base, name: "tokens", current_value: overrides.tokens ?? 0, limit_value: basePlan.limits.tokens_per_month },
    { ...base, name: "cost_usd", current_value: overrides.cost_usd ?? 0, limit_value: basePlan.limits.cost_usd_per_month },
  ];
}

describe("parseLimits", () => {
  it("returns defaults for null/undefined", () => {
    expect(parseLimits(null)).toEqual({ seats: 1, runs_per_month: 100, tokens_per_month: 100000, cost_usd_per_month: 100 });
  });

  it("reads provided values", () => {
    expect(parseLimits({ seats: 5, runs_per_month: 1_000, tokens_per_month: 10_000_000, cost_usd_per_month: 5_000 }))
      .toEqual({ seats: 5, runs_per_month: 1_000, tokens_per_month: 10_000_000, cost_usd_per_month: 5_000 });
  });
});

describe("parseFeatures", () => {
  it("returns an array of strings", () => {
    expect(parseFeatures(["a", "b", 1])).toEqual(["a", "b"]);
  });

  it("returns empty for non-array", () => {
    expect(parseFeatures("x")).toEqual([]);
  });
});

describe("toPlan", () => {
  it("normalizes a database row", () => {
    const plan = toPlan({
      id: "p",
      user_id: "u",
      name: "Enterprise",
      price_usd: "299",
      billing_interval: "annual",
      limits: { seats: 100 },
      features: ["SSO"],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(plan.name).toBe("Enterprise");
    expect(plan.price_usd).toBe(299);
    expect(plan.limits.seats).toBe(100);
  });
});

describe("toMeter", () => {
  it("normalizes a meter row", () => {
    const meter = toMeter({
      id: "m",
      user_id: "u",
      plan_id: "p",
      name: "tokens",
      current_value: "500",
      limit_value: "1000",
      period_start: "2026-01-01T00:00:00Z",
      period_end: "2026-02-01T00:00:00Z",
      created_at: "",
      updated_at: "",
    });
    expect(meter.name).toBe("tokens");
    expect(meter.current_value).toBe(500);
  });
});

describe("defaultMeters", () => {
  it("creates four meters from plan limits", () => {
    const meters = defaultMeters("plan_1", basePlan.limits);
    expect(meters).toHaveLength(4);
    expect(meters.map((m) => m.name).sort()).toEqual(["cost_usd", "runs", "seats", "tokens"]);
  });
});

describe("checkEntitlement", () => {
  it("allows usage within limits", () => {
    const result = checkEntitlement(basePlan, makeMeters());
    expect(result.allowed).toBe(true);
    expect(result.blocking).toHaveLength(0);
  });

  it("blocks when a run would exceed the monthly run cap", () => {
    const meters = makeMeters({ runs: 5_000 });
    const result = checkEntitlement(basePlan, meters, { runs: 1 });
    expect(result.allowed).toBe(false);
    expect(result.blocking[0]?.meter).toBe("runs");
    expect(result.upgradeRequired).toBe(true);
  });

  it("blocks when cost exceeds the monthly spend cap", () => {
    const meters = makeMeters({ cost_usd: 1_100 });
    const result = checkEntitlement(basePlan, meters);
    expect(result.allowed).toBe(false);
    expect(result.blocking[0]?.meter).toBe("cost_usd");
  });

  it("flags upgrade required only when a meter is at or over 100%", () => {
    const meters = makeMeters({ tokens: 999_999 });
    const result = checkEntitlement(basePlan, meters, { tokens: 2 });
    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
  });
});

describe("formatMeterValue", () => {
  it("formats cost with dollar sign", () => {
    expect(formatMeterValue("cost_usd", 1234.56)).toBe("$1,234.56");
  });

  it("formats large numbers with commas", () => {
    expect(formatMeterValue("tokens", 1_000_000)).toBe("1,000,000");
  });
});

describe("planDisplayName", () => {
  it("renders name, price and interval", () => {
    expect(planDisplayName(basePlan)).toBe("Team · $49/mo");
  });
});
