import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Check, X, AlertTriangle, Plug, Search, ShieldCheck, Zap } from "lucide-react";

type Capability =
  | "chat"
  | "streaming"
  | "tools"
  | "vision"
  | "embeddings"
  | "json_mode"
  | "fine_tune"
  | "audio";

const CAPS: { id: Capability; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "streaming", label: "Streaming" },
  { id: "tools", label: "Tool calls" },
  { id: "vision", label: "Vision" },
  { id: "embeddings", label: "Embeddings" },
  { id: "json_mode", label: "JSON mode" },
  { id: "fine_tune", label: "Fine-tune" },
  { id: "audio", label: "Audio" },
];

type Vendor = {
  id: string;
  name: string;
  category: "LLM" | "Vector DB" | "Observability" | "Orchestration" | "MCP";
  color: string;
  status: "active" | "idle" | "error";
  auth: "OAuth" | "API key" | "Service token";
  region: string;
  latencyMs: number;
  capabilities: Capability[];
  version: string;
};

const VENDORS: Vendor[] = [
  { id: "openai",     name: "OpenAI",         category: "LLM",           color: "#10A37F", status: "active", auth: "API key",       region: "us-east",   latencyMs: 340,  version: "v1",     capabilities: ["chat","streaming","tools","vision","embeddings","json_mode","fine_tune","audio"] },
  { id: "anthropic",  name: "Anthropic",      category: "LLM",           color: "#D97757", status: "active", auth: "API key",       region: "us-west",   latencyMs: 420,  version: "2024-06",capabilities: ["chat","streaming","tools","vision","json_mode"] },
  { id: "google",     name: "Google Gemini",  category: "LLM",           color: "#4285F4", status: "active", auth: "OAuth",         region: "global",    latencyMs: 380,  version: "v1beta", capabilities: ["chat","streaming","tools","vision","embeddings","json_mode","audio"] },
  { id: "meta",       name: "Meta Llama",     category: "LLM",           color: "#0866FF", status: "idle",   auth: "API key",       region: "us-east",   latencyMs: 510,  version: "3.3",    capabilities: ["chat","streaming","tools","json_mode"] },
  { id: "mistral",    name: "Mistral",        category: "LLM",           color: "#FA520F", status: "active", auth: "API key",       region: "eu-west",   latencyMs: 290,  version: "v1",     capabilities: ["chat","streaming","tools","embeddings","json_mode"] },
  { id: "qdrant",     name: "Qdrant",         category: "Vector DB",     color: "#DC244C", status: "active", auth: "Service token", region: "us-east",   latencyMs: 22,   version: "1.11",   capabilities: ["embeddings"] },
  { id: "pinecone",   name: "Pinecone",       category: "Vector DB",     color: "#0080FF", status: "idle",   auth: "API key",       region: "us-west",   latencyMs: 34,   version: "2024-10",capabilities: ["embeddings"] },
  { id: "langgraph",  name: "LangGraph",      category: "Orchestration", color: "#1C3C3C", status: "active", auth: "API key",       region: "self",      latencyMs: 12,   version: "0.2",    capabilities: ["chat","tools","streaming"] },
  { id: "mlflow",     name: "MLflow",         category: "Observability", color: "#0194E2", status: "active", auth: "Service token", region: "self",      latencyMs: 45,   version: "2.16",   capabilities: [] },
  { id: "mcp-github", name: "GitHub MCP",     category: "MCP",           color: "#F0F6FC", status: "active", auth: "OAuth",         region: "global",    latencyMs: 88,   version: "1.0",    capabilities: ["tools"] },
];

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Harness" }, { name: "description", content: "Connect vendors, run compatibility checks, and preview capability coverage across your agent stack." }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const [query, setQuery] = useState("");
  const [required, setRequired] = useState<Capability[]>(["chat", "tools", "streaming"]);
  const [category, setCategory] = useState<"All" | Vendor["category"]>("All");

  const filtered = useMemo(
    () =>
      VENDORS.filter(
        (v) =>
          (category === "All" || v.category === category) &&
          (query === "" || v.name.toLowerCase().includes(query.toLowerCase())),
      ),
    [query, category],
  );

  const compat = useMemo(
    () =>
      VENDORS.map((v) => {
        const missing = required.filter((c) => !v.capabilities.includes(c));
        return { v, missing, ok: missing.length === 0 };
      }).sort((a, b) => Number(b.ok) - Number(a.ok) || a.missing.length - b.missing.length),
    [required],
  );

  const toggleCap = (c: Capability) =>
    setRequired((r) => (r.includes(c) ? r.filter((x) => x !== c) : [...r, c]));

  const cats: Array<"All" | Vendor["category"]> = ["All", "LLM", "Vector DB", "Orchestration", "Observability", "MCP"];

  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Connect any vendor, check capability compatibility, and route with confidence"
      />

      {/* Compatibility checker */}
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-[13px] font-semibold">Compatibility checker</h2>
          <span className="text-[11px] text-[var(--text-muted)]">Pick required capabilities — vendors are ranked live</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          {CAPS.map((c) => {
            const on = required.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCap(c.id)}
                className={`h-7 px-2.5 rounded-md text-[12px] border transition-colors ${
                  on
                    ? "bg-[var(--accent-muted)] border-[var(--accent)]/40 text-[var(--text-accent)]"
                    : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {compat.slice(0, 6).map(({ v, missing, ok }) => (
            <div key={v.id} className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
              <div className="grid h-7 w-7 place-items-center rounded-md flex-shrink-0" style={{ background: `${v.color}22`, color: v.color }}>
                <Plug className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate">{v.name}</div>
                <div className="text-[11px] font-mono-tabular text-[var(--text-muted)] truncate">
                  {ok ? "All requirements met" : `Missing: ${missing.join(", ")}`}
                </div>
              </div>
              {ok ? (
                <Check className="h-4 w-4 text-[var(--success)] flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-[var(--warning)] flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors"
            className="w-full h-9 pl-8 pr-3 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[13px] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`h-9 px-3 rounded-md text-[12px] border ${
                category === c
                  ? "bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Vendor cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {filtered.map((v) => {
          const missing = required.filter((c) => !v.capabilities.includes(c));
          const ok = missing.length === 0;
          return (
            <div key={v.id} className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-md flex-shrink-0" style={{ background: `${v.color}22`, color: v.color }}>
                    <Plug className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] truncate">{v.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">{v.category} · {v.version}</div>
                  </div>
                </div>
                <StatusBadge status={v.status} />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-[11px] font-mono-tabular text-[var(--text-muted)]">
                <div><div className="text-[var(--text-secondary)]">{v.auth}</div>auth</div>
                <div><div className="text-[var(--text-secondary)]">{v.region}</div>region</div>
                <div className="flex flex-col"><span className="text-[var(--text-secondary)] inline-flex items-center gap-1"><Zap className="h-3 w-3" />{v.latencyMs}ms</span>p50 latency</div>
              </div>

              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {CAPS.map((c) => {
                  const has = v.capabilities.includes(c.id);
                  const isReq = required.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      title={c.label}
                      className={`flex items-center gap-1 rounded px-1.5 py-1 text-[10px] border ${
                        has
                          ? "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                          : isReq
                            ? "border-[var(--warning)]/30 text-[var(--warning)] bg-[color:rgb(245_158_11_/_0.06)]"
                            : "border-[var(--border-subtle)] text-[var(--text-muted)] opacity-50"
                      }`}
                    >
                      {has ? <Check className="h-3 w-3 text-[var(--success)]" /> : <X className="h-3 w-3" />}
                      <span className="truncate">{c.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <span className={`text-[11px] font-mono-tabular ${ok ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                  {ok ? "Compatible" : `${missing.length} gap${missing.length === 1 ? "" : "s"}`}
                </span>
                <button className="h-8 px-3 rounded-md text-[12px] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]">
                  {v.status === "active" ? "Manage" : "Connect"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Capability matrix */}
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-[13px] font-semibold">Capability matrix</h2>
          <p className="text-[11px] text-[var(--text-muted)]">Full coverage across every connected vendor</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <th className="px-5 py-2 font-normal">Vendor</th>
                {CAPS.map((c) => (
                  <th key={c.id} className="px-2 py-2 font-normal text-center">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VENDORS.map((v) => (
                <tr key={v.id} className="border-t border-[var(--border-subtle)]">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: v.color }} />
                      <span className="font-medium">{v.name}</span>
                    </div>
                  </td>
                  {CAPS.map((c) => (
                    <td key={c.id} className="px-2 py-2.5 text-center">
                      {v.capabilities.includes(c.id) ? (
                        <Check className="h-3.5 w-3.5 text-[var(--success)] inline" />
                      ) : (
                        <span className="text-[var(--text-muted)]">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
