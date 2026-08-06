import { describe, expect, it } from "vitest";
import { analyzeTopology, detectWorkflowCycles, longestPath } from "@/lib/context/topology";

const n = (id: string, latencyMs = 100) => ({ id, label: id.toUpperCase(), type: id, latencyMs });

describe("workflow topology analysis", () => {
  it("finds no cycle in a linear flow", () => {
    const nodes = [n("a"), n("b"), n("c")];
    const edges = [{ source: "a", target: "b" }, { source: "b", target: "c" }];
    expect(detectWorkflowCycles(nodes, edges)).toEqual([]);
  });

  it("detects a self-loop and a multi-node cycle", () => {
    const nodes = [n("a"), n("b"), n("c")];
    const self = detectWorkflowCycles(nodes, [{ source: "a", target: "a" }]);
    expect(self).toHaveLength(1);
    const ring = detectWorkflowCycles(nodes, [
      { source: "a", target: "b" }, { source: "b", target: "c" }, { source: "c", target: "a" },
    ]);
    expect(ring).toHaveLength(1);
    expect(ring[0]).toHaveLength(4);
  });

  it("computes the highest-latency path", () => {
    const nodes = [n("a", 100), n("b", 500), n("c", 50), n("d", 50)];
    const edges = [
      { source: "a", target: "b" }, { source: "b", target: "c" }, { source: "a", target: "d" },
    ];
    const best = longestPath(nodes, edges, ["a"]);
    expect(best.path).toEqual(["a", "b", "c"]);
    expect(best.latency).toBe(650);
  });

  it("flags orphans, dead ends and unreachable nodes", () => {
    const nodes = [n("planner"), n("tools"), n("orphan"), { ...n("output"), type: "output" }];
    const edges = [{ source: "planner", target: "tools" }, { source: "tools", target: "output" }];
    const report = analyzeTopology(nodes, edges);
    expect(report.issues.some((i) => i.kind === "orphan")).toBe(true);
    expect(report.issues.some((i) => i.kind === "dead-end")).toBe(false);
    expect(report.entryPoints).toContain("planner");
    expect(report.health).toBeLessThan(100);
  });

  it("scores a clean flow at full health and reports a no-entry flow", () => {
    const clean = analyzeTopology(
      [n("a"), { ...n("b"), type: "output" }],
      [{ source: "a", target: "b" }],
    );
    expect(clean.issues).toEqual([]);
    expect(clean.health).toBe(100);

    const cyclic = analyzeTopology([n("a"), n("b")], [
      { source: "a", target: "b" }, { source: "b", target: "a" },
    ]);
    expect(cyclic.issues.some((i) => i.kind === "no-entry")).toBe(true);
    expect(cyclic.cycles).toHaveLength(1);
  });
});
