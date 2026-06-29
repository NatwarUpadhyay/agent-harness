import type {
  Agent,
  Tool,
  TimePoint,
  Experiment,
  Evaluation,
  Deployment,
} from "@/types";

const names = [
  "Atlas-7", "Nexus-3", "Vega", "Orion-2", "Sirius", "Helios",
  "Lyra", "Cygnus-4", "Polaris", "Rigel", "Antares", "Capella",
];
const models = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"] as const;
const statuses = ["active", "active", "active", "idle", "idle", "error"] as const;

export const agents: Agent[] = names.map((name, i) => ({
  id: `agt_${(i + 1).toString().padStart(4, "0")}`,
  name,
  model: models[i % models.length],
  status: statuses[i % statuses.length],
  successRate: 78 + ((i * 13) % 21),
  totalCalls: 1200 + i * 873 + (i % 4) * 311,
  avgLatency: 180 + (i * 47) % 320,
  lastActive: new Date(Date.now() - i * 1000 * 60 * 7).toISOString(),
}));

const toolDefs: Array<{ name: string; category: Tool["category"] }> = [
  { name: "WebSearch", category: "retrieval" },
  { name: "CodeExecutor", category: "execution" },
  { name: "MemoryWriter", category: "memory" },
  { name: "MemoryReader", category: "memory" },
  { name: "FileParser", category: "io" },
  { name: "SQLQuery", category: "retrieval" },
  { name: "ApiCaller", category: "io" },
  { name: "VectorSearch", category: "retrieval" },
  { name: "Summarizer", category: "execution" },
  { name: "EmailSender", category: "io" },
];

export const tools: Tool[] = toolDefs.map((t, i) => ({
  id: `tool_${(i + 1).toString().padStart(3, "0")}`,
  name: t.name,
  category: t.category,
  callCount: 400 + i * 217 + (i % 3) * 91,
  successRate: 86 + (i * 7) % 13,
}));

const day = 86400000;
const today = new Date();
today.setHours(0, 0, 0, 0);
export const timeseries: TimePoint[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(today.getTime() - (6 - i) * day);
  const base = 1200 + i * 180;
  return {
    date: d.toISOString().slice(0, 10),
    agentCalls: base + ((i * 271) % 400),
    tokenUsage: base * 1100 + (i * 8000),
    successRate: 90 + (i * 1.1),
    avgLatency: 320 - i * 12,
    cost: 280 + i * 41,
  };
});

export const experiments: Experiment[] = [
  { id: "exp_001", name: "Multi-hop reasoning v2", status: "running", successRate: 93.4, avgLatency: 312, costPerCall: 0.018, startDate: "2025-06-12" },
  { id: "exp_002", name: "Reflection-loop ablation", status: "running", successRate: 88.1, avgLatency: 444, costPerCall: 0.022, startDate: "2025-06-18" },
  { id: "exp_003", name: "Retriever top-k sweep", status: "completed", successRate: 91.7, avgLatency: 268, costPerCall: 0.011, startDate: "2025-05-30" },
  { id: "exp_004", name: "Tool-use planner prompt", status: "completed", successRate: 95.2, avgLatency: 251, costPerCall: 0.014, startDate: "2025-05-22" },
  { id: "exp_005", name: "Long-context memory", status: "stopped", successRate: 71.4, avgLatency: 612, costPerCall: 0.031, startDate: "2025-05-04" },
];

const evalNames = [
  "Toxicity guard", "Citation accuracy", "Tool-call correctness", "JSON schema adherence",
  "PII redaction", "Reasoning depth", "Refusal calibration", "Hallucination check",
  "Latency budget", "Cost ceiling", "Prompt-injection resistance", "Function-arg validation",
  "Retrieval relevance", "Multi-turn coherence", "Output format",
];

export const evaluations: Evaluation[] = evalNames.map((name, i) => {
  const score = 60 + ((i * 17) % 41);
  return {
    id: `eval_${(i + 1).toString().padStart(4, "0")}`,
    name,
    score,
    passed: score >= 75,
    timestamp: new Date(Date.now() - i * 1000 * 60 * 47).toISOString(),
    agentId: agents[i % agents.length].id,
    category: ["safety", "quality", "performance", "format"][i % 4],
  };
});

export const deployments: Deployment[] = [
  { id: "dep_001", name: "Atlas fleet — primary", environment: "production", status: "healthy", version: "v2.14.3", lastDeployed: "2025-06-26T09:14:00Z", agentCount: 18 },
  { id: "dep_002", name: "Nexus rollout", environment: "production", status: "healthy", version: "v2.14.3", lastDeployed: "2025-06-25T17:02:00Z", agentCount: 9 },
  { id: "dep_003", name: "Reflection candidate", environment: "staging", status: "degraded", version: "v2.15.0-rc1", lastDeployed: "2025-06-28T11:40:00Z", agentCount: 6 },
  { id: "dep_004", name: "Planner experiment", environment: "staging", status: "healthy", version: "v2.15.0-rc2", lastDeployed: "2025-06-29T08:21:00Z", agentCount: 4 },
  { id: "dep_005", name: "Local dev — Vega", environment: "dev", status: "healthy", version: "v2.15.0-dev", lastDeployed: "2025-06-29T13:10:00Z", agentCount: 2 },
  { id: "dep_006", name: "Local dev — Lyra", environment: "dev", status: "down", version: "v2.15.0-dev", lastDeployed: "2025-06-28T22:05:00Z", agentCount: 1 },
];

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
