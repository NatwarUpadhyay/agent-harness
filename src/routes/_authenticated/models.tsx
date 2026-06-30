import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Sparkles } from "lucide-react";

const providers = [
  { id: "openai",    name: "OpenAI",    color: "#10A37F", models: ["gpt-4o", "gpt-4o-mini", "o1-preview"],     status: "active" },
  { id: "anthropic", name: "Anthropic", color: "#D97757", models: ["claude-3-5-sonnet", "claude-3-5-haiku"],   status: "active" },
  { id: "google",    name: "Google",    color: "#4285F4", models: ["gemini-1.5-pro", "gemini-1.5-flash"],      status: "active" },
  { id: "meta",      name: "Meta",      color: "#0866FF", models: ["llama-3.3-70b", "llama-3.1-8b"],            status: "idle" },
];

export const Route = createFileRoute("/_authenticated/models")({
  head: () => ({ meta: [{ title: "Models — Harness" }] }),
  component: () => (
    <>
      <PageHeader title="Models" subtitle="Connect and route across every frontier provider" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((p) => (
          <div key={p.id} className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md" style={{ background: `${p.color}22`, color: p.color }}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-[15px]">{p.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">{p.models.length} models available</div>
                </div>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <ul className="space-y-1.5 mb-4">
              {p.models.map((m) => (
                <li key={m} className="flex items-center justify-between text-[13px]">
                  <span className="font-mono-tabular text-[var(--text-secondary)]">{m}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">available</span>
                </li>
              ))}
            </ul>
            <button className="w-full h-9 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]">
              {p.status === "active" ? "Manage connection" : "Connect"}
            </button>
          </div>
        ))}
      </div>
    </>
  ),
});
