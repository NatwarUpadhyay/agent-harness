import { createFileRoute } from "@tanstack/react-router";
import { Plus, Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AgentCard } from "@/components/ui/agent-card";
import { agents } from "@/lib/data/synthetic";

export const Route = createFileRoute("/_authenticated/agents")({
  head: () => ({ meta: [{ title: "Agents — Harness" }] }),
  component: () => (
    <>
      <PageHeader
        title="Agents"
        subtitle="Every running agent across your fleet, live"
        actions={
          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)]">
            <Plus className="h-3.5 w-3.5" /> Deploy agent
          </button>
        }
      />
      <div className="flex items-center gap-2 mb-5">
        {["All", "Active", "Idle", "Error", "gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"].map((f, i) => (
          <button key={f} className={`h-7 px-2.5 rounded-md text-[12px] border ${i === 0 ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text-accent)]" : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
            {f}
          </button>
        ))}
        <button className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <Filter className="h-3 w-3" /> Filter
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((a, i) => <AgentCard key={a.id} agent={a} index={i} />)}
      </div>
    </>
  ),
});
