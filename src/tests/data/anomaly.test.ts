import { describe, expect, it } from "vitest";
import { detectAnomalies, anomalyCounts, anomalySummary, type Anomaly } from "@/lib/data/anomaly";
import type { AttributionRow, AttributionTotals } from "@/lib/data/spend-attribution";

function makeRow(partial: Partial<AttributionRow>): AttributionRow {
  return {
    team: "Team",
    cap: 1000,
    attributed: 100,
    seats: 1,
    utilization: 0.1,
    share: 0.25,
    burnPerDay: 10,
    forecast: 300,
    breachDay: null,
    status: "healthy",
    ...partial,
  };
}

const emptyTotals: AttributionTotals = {
  cap: 0, attributed: 0, forecast: 0, unallocated: 0, breaching: 0, atRisk: 0,
};

describe("detectAnomalies", () => {
  it("returns an empty array when nothing is wrong", () => {
    const rows = [makeRow({ team: "A", attributed: 100, cap: 1000, burnPerDay: 10, forecast: 300 })];
    const anomalies = detectAnomalies(rows, emptyTotals, { dayOfPeriod: 10 });
    expect(anomalies).toHaveLength(0);
  });

  it("detects an active cap breach", () => {
    const rows = [makeRow({ team: "Platform", attributed: 1200, cap: 1000, utilization: 1.2, status: "breached" })];
    const anomalies = detectAnomalies(rows, emptyTotals, { dayOfPeriod: 15 });
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]!.type).toBe("breach");
    expect(anomalies[0]!.severity).toBe("critical");
    expect(anomalies[0]!.team).toBe("Platform");
  });

  it("detects a projected breach when forecast exceeds cap", () => {
    const rows = [makeRow({ team: "Research", attributed: 300, cap: 1000, burnPerDay: 40, forecast: 1200, utilization: 0.3 })];
    const anomalies = detectAnomalies(rows, emptyTotals, { dayOfPeriod: 10, daysInPeriod: 30 } as any);
    const breach = anomalies.find((a) => a.type === "projected_breach");
    expect(breach).toBeDefined();
    expect(breach!.severity).toBe("warning");
    expect(breach!.observed).toBe(1200);
    expect(breach!.expected).toBe(1000);
  });

  it("marks a severe projected breach as critical when >120% of cap", () => {
    const rows = [makeRow({ team: "Growth", attributed: 300, cap: 1000, burnPerDay: 60, forecast: 1800, utilization: 0.3 })];
    const anomalies = detectAnomalies(rows, emptyTotals, { dayOfPeriod: 10 });
    const breach = anomalies.find((a) => a.type === "projected_breach");
    expect(breach).toBeDefined();
    expect(breach!.severity).toBe("critical");
  });

  it("detects burn-rate spikes with z-score above threshold", () => {
    const rows = [
      makeRow({ team: "A", burnPerDay: 10, forecast: 300 }),
      makeRow({ team: "B", burnPerDay: 12, forecast: 360 }),
      makeRow({ team: "C", burnPerDay: 60, forecast: 1800 }),
    ];
    const anomalies = detectAnomalies(rows, emptyTotals, { dayOfPeriod: 10, zThreshold: 1.5 });
    const spike = anomalies.find((a) => a.type === "spike");
    expect(spike).toBeDefined();
    expect(spike!.team).toBe("C");
    expect(spike!.observed).toBe(60);
    expect(spike!.expected).toBeGreaterThan(0);
  });

  it("does not flag low z-score teams as spikes", () => {
    const rows = [
      makeRow({ team: "A", burnPerDay: 10, forecast: 300 }),
      makeRow({ team: "B", burnPerDay: 11, forecast: 330 }),
      makeRow({ team: "C", burnPerDay: 12, forecast: 360 }),
    ];
    const anomalies = detectAnomalies(rows, emptyTotals, { dayOfPeriod: 10, zThreshold: 2.0 });
    expect(anomalies).toHaveLength(0);
  });

  it("detects unallocated spend above the minimum", () => {
    const rows = [makeRow({ team: "Platform", attributed: 100, cap: 1000, burnPerDay: 10, forecast: 300 })];
    const totals: AttributionTotals = { ...emptyTotals, unallocated: 650 };
    const anomalies = detectAnomalies(rows, totals, { dayOfPeriod: 10, unallocatedMinUsd: 1 });
    const unallocated = anomalies.find((a) => a.type === "unallocated");
    expect(unallocated).toBeDefined();
    expect(unallocated!.severity).toBe("warning");
    expect(unallocated!.observed).toBe(650);
  });

  it("ignores unallocated spend below the minimum", () => {
    const rows = [makeRow({ team: "Platform", attributed: 100, cap: 1000, burnPerDay: 10, forecast: 300 })];
    const totals: AttributionTotals = { ...emptyTotals, unallocated: 0.5 };
    const anomalies = detectAnomalies(rows, totals, { dayOfPeriod: 10, unallocatedMinUsd: 1 });
    expect(anomalies).toHaveLength(0);
  });

  it("sorts critical anomalies before warnings and info", () => {
    const rows = [
      makeRow({ team: "Healthy", attributed: 100, cap: 1000, burnPerDay: 10, forecast: 300 }),
      makeRow({ team: "Warning", attributed: 250, cap: 1000, burnPerDay: 25, forecast: 750 }),
      makeRow({ team: "Critical", attributed: 1200, cap: 1000, burnPerDay: 80, forecast: 2400, utilization: 1.2, status: "breached" }),
    ];
    const anomalies = detectAnomalies(rows, emptyTotals, { dayOfPeriod: 10, zThreshold: 1.5 });
    const severities = anomalies.map((a) => a.severity);
    expect(severities[0]).toBe("critical");
    expect(severities[severities.length - 1]).toBe("warning");
  });
});

describe("anomalyCounts", () => {
  it("counts by severity", () => {
    const anomalies: Anomaly[] = [
      { id: "1", team: "A", type: "breach", severity: "critical", message: "", observed: 0, expected: null, threshold: 0, dayOfPeriod: 1 },
      { id: "2", team: "B", type: "spike", severity: "warning", message: "", observed: 0, expected: null, threshold: 0, dayOfPeriod: 1 },
      { id: "3", team: "C", type: "unallocated", severity: "info", message: "", observed: 0, expected: null, threshold: 0, dayOfPeriod: 1 },
    ];
    expect(anomalyCounts(anomalies)).toEqual({ total: 3, critical: 1, warning: 1, info: 1 });
  });
});

describe("anomalySummary", () => {
  it("reports no anomalies when empty", () => {
    expect(anomalySummary([])).toBe("No spend anomalies detected.");
  });

  it("summarizes detected anomalies", () => {
    const anomalies: Anomaly[] = [
      { id: "1", team: "A", type: "breach", severity: "critical", message: "", observed: 0, expected: null, threshold: 0, dayOfPeriod: 1 },
      { id: "2", team: "B", type: "spike", severity: "warning", message: "", observed: 0, expected: null, threshold: 0, dayOfPeriod: 1 },
    ];
    expect(anomalySummary(anomalies)).toBe("2 anomalies detected (1 critical, 1 warning, 0 info).");
  });
});
