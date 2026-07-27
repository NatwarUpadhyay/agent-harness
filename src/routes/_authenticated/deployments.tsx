import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { deployments as SEED, agents, relativeTime } from "@/lib/data/synthetic";
import { Rocket, ArrowUpCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const envs = ["production", "staging", "dev"] as const;
const envLabel: Record<string, string> = { production: "Production", staging: "Staging", dev: "Development" };
const nextEnv: Record<string, "production" | "staging" | null> = {
  dev: "staging",
  staging: "production",
  production: null,
};

type Dep = (typeof SEED)[number];

export const Route = createFileRoute("/_authenticated/deployments")({
  head: () => ({ meta: [{ title: "Deployments — Harness" }] }),
  component: DeploymentsView,
});

function bumpVersion(v: string) {
  const m = v.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return v + "+1";
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

function DeploymentsView() {
  const [rows, setRows] = useState<Dep[]>(SEED);

  const promote = (id: string) => {
    setRows((prev) => {
      const target = prev.find((d) => d.id === id);
      if (!target) return prev;
      const dest = nextEnv[target.environment];
      if (!dest) { toast.error("Already in production"); return prev; }
      toast.success(`Promoted ${target.name} → ${envLabel[dest]}`, {
        description: `${target.version} → ${bumpVersion(target.version)}`,
      });
      return prev.map((d) => d.id === id ? {
        ...d,
        environment: dest,
        version: bumpVersion(d.version),
        lastDeployed: new Date().toISOString(),
        status: "active",
      } : d);
    });
  };

  const rollback = (id: string) => {
    setRows((prev) => prev.map((d) => {
      if (d.id !== id) return d;
      toast(`Rolled back ${d.name} to previous version`);
      return { ...d, status: "idle", lastDeployed: new Date().toISOString() };
    }));
  };

  return (
    <>
      <PageHeader title="Deployments" subtitle="Promote agent versions across environments with one click" />
      {envs.map((env) => {
        const deps = rows.filter((d) => d.environment === env);
        return (
          <section key={env} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold tracking-tight">{envLabel[env]}</h2>
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-mono-tabular">{deps.length} deployments</span>
            </div>
            {deps.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[var(--border-default)] p-6 text-center text-[12px] text-[var(--text-muted)]">
                Nothing here yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deps.map((d) => {
                  const sample = agents.slice(0, d.agentCount).map((a) => a.name);
                  const dest = nextEnv[d.environment];
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
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {sample.map((n) => (
                          <span key={n} className="text-[11px] font-mono-tabular px-1.5 py-0.5 rounded-sm bg-[var(--bg-elevated)] text-[var(--text-secondary)]">{n}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
                        <button
                          onClick={() => promote(d.id)}
                          disabled={!dest}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[12px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ArrowUpCircle className="h-3.5 w-3.5" />
                          {dest ? `Promote to ${envLabel[dest]}` : "In production"}
                        </button>
                        <button
                          onClick={() => rollback(d.id)}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Rollback
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
