import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Sparkles, Check } from "lucide-react";
import { toast } from "sonner";

interface Provider {
  id: string; name: string; color: string; models: string[]; status: "active" | "idle";
}

const INITIAL: Provider[] = [
  { id: "openai",    name: "OpenAI",    color: "#10A37F", models: ["gpt-4o", "gpt-4o-mini", "o1-preview"],     status: "active" },
  { id: "anthropic", name: "Anthropic", color: "#D97757", models: ["claude-3-5-sonnet", "claude-3-5-haiku"],   status: "active" },
  { id: "google",    name: "Google",    color: "#4285F4", models: ["gemini-1.5-pro", "gemini-1.5-flash"],      status: "active" },
  { id: "meta",      name: "Meta",      color: "#0866FF", models: ["llama-3.3-70b", "llama-3.1-8b"],           status: "idle" },
];

const STORAGE_KEY = "harness.models.state";

export const Route = createFileRoute("/_authenticated/models")({
  head: () => ({ meta: [{ title: "Models — Harness" }] }),
  component: ModelsView,
});

function ModelsView() {
  const [providers, setProviders] = useState<Provider[]>(() => {
    if (typeof window === "undefined") return INITIAL;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return INITIAL;
      const saved = JSON.parse(raw) as { id: string; status: Provider["status"] }[];
      return INITIAL.map((p) => ({ ...p, status: saved.find((s) => s.id === p.id)?.status ?? p.status }));
    } catch { return INITIAL; }
  });
  const [defaultModel, setDefaultModel] = useState<string>(() => {
    if (typeof window === "undefined") return "gpt-4o";
    return localStorage.getItem("harness.models.default") || "gpt-4o";
  });

  const persist = (next: Provider[]) => {
    setProviders(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map((p) => ({ id: p.id, status: p.status }))));
    } catch { /* */ }
  };

  const toggle = (id: string) => {
    persist(providers.map((p) => {
      if (p.id !== id) return p;
      const next = p.status === "active" ? "idle" as const : "active" as const;
      toast.success(`${p.name} ${next === "active" ? "connected" : "disconnected"}`);
      return { ...p, status: next };
    }));
  };

  const setDefault = (model: string) => {
    setDefaultModel(model);
    try { localStorage.setItem("harness.models.default", model); } catch { /* */ }
    toast.success(`Default model set to ${model}`);
  };

  return (
    <>
      <PageHeader
        title="Models"
        subtitle="Connect and route across every frontier provider"
      />
      <div className="mb-4 text-[12px] text-[var(--text-muted)] font-mono-tabular">
        Default model: <span className="text-[var(--text-accent)]">{defaultModel}</span>
      </div>
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
              {p.models.map((m) => {
                const isDefault = defaultModel === m;
                return (
                  <li key={m} className="flex items-center justify-between text-[13px]">
                    <span className="font-mono-tabular text-[var(--text-secondary)]">{m}</span>
                    {isDefault ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-accent)]">
                        <Check className="h-3 w-3" /> default
                      </span>
                    ) : (
                      <button
                        onClick={() => setDefault(m)}
                        disabled={p.status !== "active"}
                        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        set default
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => toggle(p.id)}
              className="w-full h-9 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            >
              {p.status === "active" ? "Disconnect" : "Connect"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
