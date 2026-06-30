import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { deployments, agents, relativeTime } from "@/lib/data/synthetic";
import { Rocket } from "lucide-react";

const envs = ["production", "staging", "dev"] as const;
const envLabel: Record<string, string> = { production: "Production", staging: "Staging", dev: "Development" };

export const Route = createFileRoute("/_authenticated/deployments")({
  head: () => ({ meta: [{ title: "Deployments — Harness" }] }),
  component: () => (
    <>
      <PageHeader title="Deployments" subtitle="Promote agent versions across environments with one click" />
      {envs.map((env) => {
        const deps = deployments.filter((d) => d.environment === env);
        return (
          <section key={env} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold tracking-tight">{envLabel[env]}</h2>
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-mono-tabular">{deps.length} deployments</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deps.map((d) => {
                const sample = agents.slice(0, d.agentCount).map((a) => a.name);
                return (
                  <div key={d.id} className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-md bg-[var(--accent-muted)] text-[var(--text-accent)]">
                          <Rocket className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-[14px]">{d.name}</div>
                          <div className="text-[11px] font-mono-tabular text-[var(--text-muted)]">{d.version} · {relativeTime(d.lastDeployed)}</div>
                        </div>
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Deployed agents ({d.agentCount})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {sample.map((n) => (
                        <span key={n} className="text-[11px] font-mono-tabular px-1.5 py-0.5 rounded-sm bg-[var(--bg-elevated)] text-[var(--text-secondary)]">{n}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  ),
});
