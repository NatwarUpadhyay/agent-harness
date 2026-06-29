import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

const policies = [
  { id: "po1", name: "Block PII in outputs",       category: "safety",  enabled: true,  desc: "Redact emails, SSNs, and phone numbers before any model response leaves the harness." },
  { id: "po2", name: "Max cost per call: $0.05",   category: "cost",    enabled: true,  desc: "Reject completions whose projected token spend exceeds 5 cents." },
  { id: "po3", name: "Latency budget 2s",          category: "latency", enabled: false, desc: "Fail-open after 2000ms; serve a cached or degraded response." },
  { id: "po4", name: "Refusal on prompt injection",category: "safety",  enabled: true,  desc: "Heuristic + classifier detection of jailbreak attempts in user input." },
  { id: "po5", name: "Tool allowlist per agent",   category: "safety",  enabled: true,  desc: "Each agent may only call tools listed in its policy contract." },
  { id: "po6", name: "Daily token cap",            category: "cost",    enabled: true,  desc: "Hard cap of 50M input + 10M output tokens per organization per day." },
];

const catColor: Record<string, string> = {
  safety: "var(--danger)", cost: "var(--warning)", latency: "var(--accent)",
};

export const Route = createFileRoute("/policies")({
  head: () => ({ meta: [{ title: "Policies — Harness" }] }),
  component: PoliciesPage,
});

function PoliciesPage() {
  const [open, setOpen] = useState<string | null>("po1");
  return (
    <>
      <PageHeader title="Policies" subtitle="Hard constraints applied to every agent invocation" />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
        {policies.map((p) => {
          const isOpen = open === p.id;
          return (
            <div key={p.id}>
              <button
                onClick={() => setOpen(isOpen ? null : p.id)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-[var(--bg-elevated)]/50"
              >
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm w-16 text-center font-medium" style={{ background: `color-mix(in oklab, ${catColor[p.category]} 14%, transparent)`, color: catColor[p.category] }}>
                  {p.category}
                </span>
                <span className="flex-1 text-[14px] font-medium">{p.name}</span>
                <span className={`relative h-5 w-9 rounded-full transition-colors ${p.enabled ? "bg-[var(--accent)]" : "bg-[var(--bg-elevated)]"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${p.enabled ? "left-4" : "left-0.5"}`} />
                </span>
                <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-5 pb-4 text-[13px] text-[var(--text-secondary)] leading-relaxed">{p.desc}</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
