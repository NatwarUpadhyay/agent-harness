export type AgentStatus = "active" | "idle" | "error";
export type ExperimentStatus = "running" | "completed" | "stopped";
export type DeployEnv = "production" | "staging" | "dev";

export interface Agent {
  id: string;
  name: string;
  model: "gpt-4o" | "claude-3-5-sonnet" | "gemini-1.5-pro";
  status: AgentStatus;
  successRate: number;
  totalCalls: number;
  avgLatency: number;
  lastActive: string;
}

export interface Tool {
  id: string;
  name: string;
  category: "retrieval" | "execution" | "memory" | "io";
  callCount: number;
  successRate: number;
}

export interface TimePoint {
  date: string;
  agentCalls: number;
  tokenUsage: number;
  successRate: number;
  avgLatency: number;
  cost: number;
}

export interface Experiment {
  id: string;
  name: string;
  status: ExperimentStatus;
  successRate: number;
  avgLatency: number;
  costPerCall: number;
  startDate: string;
}

export interface Evaluation {
  id: string;
  name: string;
  score: number;
  passed: boolean;
  timestamp: string;
  agentId: string;
  category: string;
}

export interface Deployment {
  id: string;
  name: string;
  environment: DeployEnv;
  status: "healthy" | "degraded" | "down";
  version: string;
  lastDeployed: string;
  agentCount: number;
}

// Provider interface stubs (types only)
export interface ProviderClient {
  id: string;
  name: string;
  baseUrl?: string;
}
export interface OpenAIClient extends ProviderClient { kind: "openai" }
export interface AnthropicClient extends ProviderClient { kind: "anthropic" }
export interface LangGraphClient extends ProviderClient { kind: "langgraph" }
export interface MCPClient extends ProviderClient { kind: "mcp"; tools: string[] }
export interface MLflowClient extends ProviderClient { kind: "mlflow" }
export interface QdrantClient extends ProviderClient { kind: "qdrant"; collection: string }
