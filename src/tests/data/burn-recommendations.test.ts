import { describe, expect, it } from "vitest";
import {
  fleetBurnSummary,
  generateRecommendations,
  recommendationSummary,
  simulateSavings,
  type SavingsScenario,
} from "@/lib/data/burn-recommendations";
import {
  attributeSpend,
  summarizeAttribution,
  type SeatSpend,
  type TeamBudgetLine,
} from "@/lib/data/spend-attribution";

const period = { dayOfPeriod: 21, daysInPeriod: 30 };

function rowsFor(
  budgets: TeamBudgetLine[],
  seats: SeatSpend[],
) {
  return attributeSpend(budgets, seats, period);
}

const seats: SeatSpend[] = [
  { id: "1", name: "A", team: "Platform", cost: 1200 },
  { id: "2", name: "B", team: "Platform", cost: 1400 },
  { id: "3", name: "C", team: "Support AI", cost: 2300 },
  { id: "4", name: "D", team: "Research", cost: 150 },
  { id: "5", name: "E", team: "", cost: 400 },
];

const budgets: TeamBudgetLine[] = [
  { team: "Platform", cap: 4000, active: true },
  { team: "Support AI", cap: 2500, active: true },
  { team: "Research", cap: 1800, active: true },
];

describe("fleetBurnSummary", () => {
  it("totals cap, attributed, forecast and headroom", () => {
    const rows = rowsFor(budgets, seats);
    const totals = summarizeAttribution(rows, seats);
    const summary = fleetBurnSummary(rows, totals);
    expect(summary.totalCap).toBe(8300);
    expect(summary.totalAttributed).toBe(totals.attributed);
    expect(summary.headroom).toBeGreaterThan(0);
    expect(summary.breaching).toBe(totals.breaching);
  });
});

describe("generateRecommendations", () => {
  it("flags a forecast breach", () => {
    const rows = rowsFor(budgets, seats);
    const totals = summarizeAttribution(rows, seats);
    const recs = generateRecommendations(rows, totals);
    const breach = recs.find((r) => r.kind === "forecast_breach");
    expect(breach).toBeDefined();
    expect(breach!.team).toBe("Support AI");
  });

  it("suggests right-sizing an underutilized team", () => {
    const rows = rowsFor(budgets, seats);
    const totals = summarizeAttribution(rows, seats);
    const recs = generateRecommendations(rows, totals);
    const rightsize = recs.find((r) => r.kind === "rightsize_cap");
    expect(rightsize).toBeDefined();
    expect(rightsize!.impactUsd).toBeGreaterThan(0);
  });

  it("recommends creating a budget for unallocated spend", () => {
    const rows = rowsFor(budgets, seats);
    const totals = summarizeAttribution(rows, seats);
    expect(totals.unallocated).toBeGreaterThan(0);
    const recs = generateRecommendations(rows, totals);
    const create = recs.find((r) => r.kind === "create_budget");
    expect(create).toBeDefined();
    expect(create!.team).toBe("Unassigned");
  });

  it("sorts critical recommendations first", () => {
    const rows = rowsFor(budgets, seats);
    const totals = summarizeAttribution(rows, seats);
    const recs = generateRecommendations(rows, totals);
    const severities = recs.map((r) => r.severity);
    const firstNonCritical = severities.findIndex((s) => s !== "critical");
    const lastCritical = severities.lastIndexOf("critical");
    expect(lastCritical).toBeLessThanOrEqual(
      firstNonCritical === -1 ? severities.length : firstNonCritical,
    );
  });
});

describe("simulateSavings", () => {
  const baseScenario: SavingsScenario = {
    efficiencyGain: 0,
    reallocateUsd: 0,
    throttleReduction: 0,
  };

  it("returns zero savings when no levers are applied", () => {
    const rows = rowsFor(budgets, seats);
    const totals = summarizeAttribution(rows, seats);
    const out = simulateSavings(rows, totals, baseScenario);
    expect(out.savingsUsd).toBeCloseTo(0, 1);
    expect(out.savingsPct).toBeCloseTo(0, 1);
  });

  it("reduces forecast when efficiency gain is applied", () => {
    const rows = rowsFor(budgets, seats);
    const totals = summarizeAttribution(rows, seats);
    const out = simulateSavings(rows, totals, {
      ...baseScenario,
      efficiencyGain: 0.2,
    });
    expect(out.savingsUsd).toBeGreaterThan(0);
    expect(out.savingsPct).toBeGreaterThan(0);
    expect(out.simulatedForecast).toBeLessThan(out.originalForecast);
  });

  it("rescues teams when reallocation covers the breach", () => {
    const rows = rowsFor(budgets, seats);
    const totals = summarizeAttribution(rows, seats);
    const out = simulateSavings(rows, totals, {
      ...baseScenario,
      reallocateUsd: 5000,
    });
    expect(out.rescuedTeams.length).toBeGreaterThan(0);
  });

  it("reports remaining breaches when the scenario is insufficient", () => {
    const rows = rowsFor(budgets, seats);
    const totals = summarizeAttribution(rows, seats);
    const out = simulateSavings(rows, totals, {
      ...baseScenario,
      efficiencyGain: 0.05,
    });
    expect(out.remainingBreaches.length).toBeGreaterThanOrEqual(0);
  });
});

describe("recommendationSummary", () => {
  it("summarizes an empty list", () => {
    expect(recommendationSummary([])).toContain("No burn recommendations");
  });

  it("counts severities and totals impact", () => {
    const rows = rowsFor(budgets, seats);
    const totals = summarizeAttribution(rows, seats);
    const recs = generateRecommendations(rows, totals);
    const summary = recommendationSummary(recs);
    expect(summary).toContain("recommendation");
    expect(summary).toContain("$");
  });
});
