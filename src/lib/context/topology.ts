/**
 * Workflow topology analysis — browser-safe, dependency-free.
 *
 * Mirrors the loop-detection logic used by the repo context graph
 * (`src/lib/context/graph.ts`) but operates on harness workflow graphs
 * so the product can audit customer flows for cycles, orphans and depth.
 */

export interface TopoNode {
  id: string;
  label: string;
  type?: string;
  latencyMs?: number;
}

export interface TopoEdge {
  source: string;
  target: string;
}

export interface TopologyIssue {
  kind: "cycle" | "orphan" | "unreachable" | "dead-end" | "fan-out" | "no-entry";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  nodeIds: string[];
}

export interface TopologyReport {
  nodeCount: number;
  edgeCount: number;
  entryPoints: string[];
  cycles: string[][];
  maxDepth: number;
  criticalPath: string[];
  criticalPathLatencyMs: number;
  issues: TopologyIssue[];
  health: number;
}

const adjacency = (nodes: TopoNode[], edges: TopoEdge[]) => {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.source)?.push(e.target);
  return adj;
};

/** Iterative-safe DFS cycle detection; self-loops included, duplicates collapsed. */
export function detectWorkflowCycles(nodes: TopoNode[], edges: TopoEdge[]): string[][] {
  const adj = adjacency(nodes, edges);
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  const signatures = new Set<string>();

  const record = (cycle: string[]) => {
    const body = cycle.slice(0, -1);
    const min = body.indexOf([...body].sort()[0]!);
    const rotated = [...body.slice(min), ...body.slice(0, min)];
    const signature = rotated.join(">");
    if (signatures.has(signature)) return;
    signatures.add(signature);
    cycles.push([...rotated, rotated[0]!]);
  };

  const walk = (id: string, path: string[]) => {
    visited.add(id);
    onStack.add(id);
    path.push(id);
    for (const next of adj.get(id) ?? []) {
      if (onStack.has(next)) record([...path.slice(path.indexOf(next)), next]);
      else if (!visited.has(next)) walk(next, path);
    }
    path.pop();
    onStack.delete(id);
  };

  for (const n of nodes) if (!visited.has(n.id)) walk(n.id, []);
  return cycles;
}

/** Longest path by accumulated latency, cycle-safe (each node visited once per path). */
export function longestPath(
  nodes: TopoNode[],
  edges: TopoEdge[],
  from: string[],
): { path: string[]; latency: number } {
  const adj = adjacency(nodes, edges);
  const latency = new Map(nodes.map((n) => [n.id, n.latencyMs ?? 100]));
  let best: { path: string[]; latency: number } = { path: [], latency: 0 };

  const walk = (id: string, path: string[], cost: number, seen: Set<string>) => {
    const next = (adj.get(id) ?? []).filter((n) => !seen.has(n));
    if (next.length === 0) {
      if (cost > best.latency) best = { path: [...path], latency: cost };
      return;
    }
    for (const n of next) {
      seen.add(n);
      path.push(n);
      walk(n, path, cost + (latency.get(n) ?? 100), seen);
      path.pop();
      seen.delete(n);
    }
  };

  for (const start of from) {
    walk(start, [start], latency.get(start) ?? 100, new Set([start]));
  }
  return best;
}

export function analyzeTopology(nodes: TopoNode[], edges: TopoEdge[]): TopologyReport {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const name = (id: string) => byId.get(id)?.label ?? id;

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const n of nodes) {
    incoming.set(n.id, 0);
    outgoing.set(n.id, 0);
  }
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    outgoing.set(e.source, (outgoing.get(e.source) ?? 0) + 1);
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }

  const entryPoints = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  const cycles = detectWorkflowCycles(nodes, edges);

  // Reachability from entry points.
  const adj = adjacency(nodes, edges);
  const reached = new Set<string>();
  const queue = [...entryPoints];
  while (queue.length) {
    const id = queue.shift()!;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const next of adj.get(id) ?? []) if (!reached.has(next)) queue.push(next);
  }

  const issues: TopologyIssue[] = [];

  for (const cycle of cycles) {
    const isSelf = cycle.length === 2 && cycle[0] === cycle[1];
    issues.push({
      kind: "cycle",
      severity: "high",
      title: isSelf ? `Self-loop on ${name(cycle[0]!)}` : "Circular dependency",
      detail: isSelf
        ? "A node feeding itself will re-enter forever unless a max-iteration guard is set."
        : `${cycle.slice(0, -1).map(name).join(" → ")} → ${name(cycle[0]!)} forms a loop. Add an evaluator gate or iteration cap.`,
      nodeIds: Array.from(new Set(cycle)),
    });
  }

  for (const n of nodes) {
    const inn = incoming.get(n.id) ?? 0;
    const out = outgoing.get(n.id) ?? 0;
    if (inn === 0 && out === 0) {
      issues.push({
        kind: "orphan",
        severity: "medium",
        title: `${n.label} is disconnected`,
        detail: "No inbound or outbound edges — this node never executes.",
        nodeIds: [n.id],
      });
      continue;
    }
    if (!reached.has(n.id)) {
      issues.push({
        kind: "unreachable",
        severity: "high",
        title: `${n.label} is unreachable`,
        detail: "No path from any entry point reaches this node.",
        nodeIds: [n.id],
      });
    }
    if (out === 0 && inn > 0 && (n.type ?? "").toLowerCase() !== "output") {
      issues.push({
        kind: "dead-end",
        severity: "low",
        title: `${n.label} is a dead end`,
        detail: "Results are produced but never forwarded to an output.",
        nodeIds: [n.id],
      });
    }
    if (out >= 4) {
      issues.push({
        kind: "fan-out",
        severity: "low",
        title: `${n.label} fans out to ${out} nodes`,
        detail: "High fan-out multiplies token cost per run. Consider a router node.",
        nodeIds: [n.id],
      });
    }
  }

  if (nodes.length > 0 && entryPoints.length === 0) {
    issues.push({
      kind: "no-entry",
      severity: "high",
      title: "No entry point",
      detail: "Every node has an inbound edge, so the flow can never start.",
      nodeIds: [],
    });
  }

  const critical = longestPath(nodes, edges, entryPoints.length ? entryPoints : nodes.slice(0, 1).map((n) => n.id));

  const weights = { high: 22, medium: 10, low: 4 } as const;
  const penalty = issues.reduce((sum, i) => sum + weights[i.severity], 0);
  const health = nodes.length === 0 ? 0 : Math.max(0, Math.min(100, 100 - penalty));

  return {
    nodeCount: nodes.length,
    edgeCount: edges.filter((e) => byId.has(e.source) && byId.has(e.target)).length,
    entryPoints,
    cycles,
    maxDepth: critical.path.length,
    criticalPath: critical.path,
    criticalPathLatencyMs: critical.latency,
    issues,
    health,
  };
}
