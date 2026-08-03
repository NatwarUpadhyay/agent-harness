import { describe, expect, it } from "vitest";
import { clearRuns, estimateNodeCost, formatCost, recordRun } from "./harness-usage";

describe("harness usage math", () => {
  it("estimates node latency cost with type-specific rates", () => {
    expect(estimateNodeCost("Planner", 800)).toEqual({ tokens: 640, cost: 0.0032 });
    expect(estimateNodeCost("Output", 60)).toMatchObject({ tokens: 6 });
    expect(estimateNodeCost("Output", 60).cost).toBeCloseTo(0.0000006, 12);
  });

  it("formats usage costs consistently", () => {
    expect(formatCost(0.0006)).toBe("$0.0006");
    expect(formatCost(0.12)).toBe("$0.120");
    expect(formatCost(2.5)).toBe("$2.50");
  });

  it("records a run with latency and token totals", () => {
    clearRuns();
    const run = recordRun({
      workflowName: "Latency check",
      totalLatencyMs: 1200,
      totalTokens: 700,
      totalCost: 0.014,
      nodeCount: 3,
      edgeCount: 2,
      perNode: [{ typeName: "Planner", latencyMs: 800, tokens: 640, cost: 0.0032 }],
    });

    expect(run.workflowName).toBe("Latency check");
    expect(run.totalLatencyMs).toBe(1200);
    expect(run.totalTokens).toBe(700);
    expect(run.perNode).toHaveLength(1);
    expect(window.localStorage.getItem("harness.usage.v1")).toContain("Latency check");
  });
});