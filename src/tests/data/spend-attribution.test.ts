import { describe, expect, it } from "vitest";
import {
  attributeSeats,
  attributeSpend,
  chargebackCsv,
  projectBreachDay,
  statusFor,
  summarizeAttribution,
  type SeatSpend,
  type TeamBudgetLine,
} from "@/lib/data/spend-attribution";
import { seatRoster } from "@/lib/data/spend-roster";

const period = { dayOfPeriod: 10, daysInPeriod: 30 };

const seats: SeatSpend[] = [
  { id: "1", name: "A", team: "Platform", cost: 100 },
  { id: "2", name: "B", team: "Platform", cost: 200 },
  { id: "3", name: "C", team: "Research", cost: 50 },
  { id: "4", name: "D", team: "", cost: 25 },
];

const budgets: TeamBudgetLine[] = [
  { team: "Platform", cap: 1000, active: true },
  { team: "Research", cap: 100, active: true },
  { team: "Growth", cap: 500, active: false },
];

describe("attributeSeats", () => {
  it("rolls seats up per team and buckets blank teams as Unassigned", () => {
    const map = attributeSeats(seats);
    expect(map.get("Platform")).toEqual({ cost: 300, seats: 2 });
    expect(map.get("Unassigned")).toEqual({ cost: 25, seats: 1 });
  });

  it("ignores negative costs", () => {
    const map = attributeSeats([{ id: "x", name: "X", team: "T", cost: -5 }]);
    expect(map.get("T")!.cost).toBe(0);
  });
});

describe("statusFor", () => {
  it("classifies utilization thresholds", () => {
    expect(statusFor(0.2)).toBe("healthy");
    expect(statusFor(0.85)).toBe("at-risk");
    expect(statusFor(1.2)).toBe("breached");
  });
});

describe("projectBreachDay", () => {
  it("returns the projected day the cap breaks", () => {
    // 300 over 10 days = 30/day, cap 900 -> day 30
    expect(projectBreachDay(300, 900, period)).toBe(30);
  });

  it("returns null when the pace holds under the cap", () => {
    expect(projectBreachDay(100, 900, period)).toBeNull();
  });

  it("reports today when already breached or capless", () => {
    expect(projectBreachDay(900, 900, period)).toBe(10);
    expect(projectBreachDay(1, 0, period)).toBe(10);
  });

  it("returns null with no spend", () => {
    expect(projectBreachDay(0, 500, period)).toBeNull();
  });
});

describe("attributeSpend", () => {
  const rows = attributeSpend(budgets, seats, period);

  it("skips inactive budget lines", () => {
    expect(rows.map((r) => r.team)).toEqual(["Platform", "Research"]);
  });

  it("attributes seat spend, burn rate and forecast", () => {
    const platform = rows[0]!;
    expect(platform.attributed).toBe(300);
    expect(platform.seats).toBe(2);
    expect(platform.burnPerDay).toBe(30);
    expect(platform.forecast).toBe(900);
    expect(platform.status).toBe("healthy");
  });

  it("flags a team already over its cap", () => {
    const research = rows[1]!;
    expect(research.utilization).toBeCloseTo(0.5);
    expect(research.breachDay).toBe(20);
  });

  it("shares sum to 1", () => {
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1);
  });

  it("falls back to the budget's own spent when no seats match", () => {
    const [row] = attributeSpend([{ team: "Ops", cap: 200, spent: 80 }], [], period);
    expect(row!.attributed).toBe(80);
    expect(row!.seats).toBe(0);
  });
});

describe("summarizeAttribution", () => {
  it("totals caps, spend and unallocated spend", () => {
    const rows = attributeSpend(budgets, seats, period);
    const totals = summarizeAttribution(rows, seats);
    expect(totals.cap).toBe(1100);
    expect(totals.attributed).toBe(350);
    expect(totals.unallocated).toBe(25);
    expect(totals.breaching).toBe(0);
  });
});

describe("chargebackCsv", () => {
  it("emits a header and one row per team", () => {
    const csv = chargebackCsv(attributeSpend(budgets, seats, period));
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("attributed_usd");
    expect(lines).toHaveLength(3);
  });
});

describe("seatRoster", () => {
  it("is deterministic and spreads seats across the given teams", () => {
    const a = seatRoster(["Platform", "Research"], 6);
    const b = seatRoster(["Platform", "Research"], 6);
    expect(a).toEqual(b);
    expect(new Set(a.map((s) => s.team))).toEqual(new Set(["Platform", "Research"]));
    expect(a.every((s) => s.cost > 0)).toBe(true);
  });
});
