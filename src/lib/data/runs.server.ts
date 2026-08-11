/**
 * Production execution engine.
 * Executes a harness workflow graph node-by-node against the Lovable AI gateway
 * and returns a full execution trace (per-step output, latency, tokens, cost).
 */

export interface FlowNode {
  id: string;
  data?: {
    label?: string;
    typeName?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    subtitle?: string;
  };
}

export interface FlowEdge {
  id?: string;
  source: string;
  target: string;
}

export interface RunStep {
  nodeId: string;
  label: string;
  typeName: string;
  status: "ok" | "error" | "skipped";
  output: string;
  tokens: number;
  latencyMs: number;
  costUsd: number;
  attempts?: number;
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
// Blended gateway price used for the run cost estimate (USD per 1k tokens).
const COST_PER_1K = 0.00035;

const SYSTEM_PROMPTS: Record<string, string> = {
  Planner:
    "You are the Planner stage of an AI agent harness. Break the request into a numbered plan of 3-5 concrete steps. Be terse.",
  Memory:
    "You are the Memory stage. Summarise the durable facts worth persisting from the context in at most 4 bullets.",
  Retriever:
    "You are the Retriever stage. List the 3-5 most useful search queries or documents needed to answer the request, one per line.",
  Tools:
    "You are the Tools stage. Decide which tools/APIs should be called and with what arguments. Return a compact JSON-like list.",
  Evaluator:
    "You are the Evaluator stage. Score the incoming content 0-100 on correctness, completeness and safety, then state PASS or FAIL with one line of reasoning.",
  Reflection:
    "You are the Reflection stage. Critique the incoming content and rewrite it so it is stronger. Return only the improved version.",
  Output:
    "You are the Output stage. Produce the final, user-facing answer. Clear prose, no meta commentary.",
};

/** Kahn topological order; falls back to declaration order when the graph cycles. */
import { withRetries, MAX_ATTEMPTS } from "./retry";

export function topologicalOrder(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indegree = new Map(nodes.map((n) => [n.id, 0]));
  const outgoing = new Map<string, string[]>();

  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e.target]);
  }

  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const ordered: FlowNode[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (node) ordered.push(node);
    for (const next of outgoing.get(id) ?? []) {
      const left = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, left);
      if (left === 0) queue.push(next);
    }
  }

  if (ordered.length !== nodes.length) {
    const seen = new Set(ordered.map((n) => n.id));
    for (const n of nodes) if (!seen.has(n.id)) ordered.push(n);
  }
  return ordered;
}

async function callGateway(system: string, user: string, temperature: number) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI gateway is not configured for this project.");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (res.status === 429) throw new Error("Rate limit reached — try this run again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
  if (!res.ok) throw new Error(`AI gateway error (${res.status}): ${await res.text()}`);

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  return {
    content: json.choices?.[0]?.message?.content?.trim() ?? "",
    tokens: json.usage?.total_tokens ?? 0,
  };
}

export interface ExecutionResult {
  steps: RunStep[];
  output: string;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  status: "succeeded" | "failed";
  error?: string;
}

export async function executeGraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
  input: string,
): Promise<ExecutionResult> {
  const ordered = topologicalOrder(nodes, edges);
  const steps: RunStep[] = [];
  const startedAt = Date.now();
  let carry = input;
  let totalTokens = 0;
  let failure: string | undefined;

  for (const node of ordered) {
    const typeName = node.data?.typeName ?? "Output";
    const label = node.data?.label ?? typeName;
    const system = SYSTEM_PROMPTS[typeName] ?? SYSTEM_PROMPTS.Output;
    const temperature = typeof node.data?.temperature === "number" ? node.data.temperature : 0.3;
    const stepStart = Date.now();

    if (failure) {
      steps.push({
        nodeId: node.id,
        label,
        typeName,
        status: "skipped",
        output: "Skipped — an upstream node failed.",
        tokens: 0,
        latencyMs: 0,
        costUsd: 0,
      });
      continue;
    }

    try {
      const user = `Original request:\n${input}\n\nContext from the previous stage:\n${carry}`;
      const { value, attempts } = await withRetries(() => callGateway(system, user, temperature));
      const { content, tokens } = value;
      totalTokens += tokens;
      carry = content || carry;
      steps.push({
        nodeId: node.id,
        label,
        typeName,
        status: "ok",
        output: content,
        tokens,
        latencyMs: Date.now() - stepStart,
        costUsd: (tokens / 1000) * COST_PER_1K,
        attempts,
      });
    } catch (err) {
      failure = err instanceof Error ? err.message : "Unknown execution error";
      steps.push({
        nodeId: node.id,
        label,
        typeName,
        status: "error",
        output: failure,
        tokens: 0,
        latencyMs: Date.now() - stepStart,
        costUsd: 0,
        attempts: MAX_ATTEMPTS,
      });
    }
  }

  return {
    steps,
    output: failure ? "" : carry,
    totalTokens,
    costUsd: (totalTokens / 1000) * COST_PER_1K,
    latencyMs: Date.now() - startedAt,
    status: failure ? "failed" : "succeeded",
    error: failure,
  };
}
