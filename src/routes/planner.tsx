import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Brain, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

const tasks = [
  { id: "t1", title: "Draft Q3 outbound sequence", agent: "Atlas-7",  status: "running",   steps: 4, eta: "00:42" },
  { id: "t2", title: "Reconcile billing anomalies",  agent: "Vega",     status: "pending",   steps: 6, eta: "01:10" },
  { id: "t3", title: "Summarize support tickets",    agent: "Nexus-3",  status: "completed", steps: 3, eta: "—"     },
  { id: "t4", title: "Audit vendor SOC2 docs",       agent: "Lyra",     status: "running",   steps: 8, eta: "02:18" },
  { id: "t5", title: "Generate weekly KPI brief",    agent: "Orion-2",  status: "completed", steps: 5, eta: "—"     },
  { id: "t6", title: "Triage GitHub issues",         agent: "Capella",  status: "pending",   steps: 2, eta: "00:08" },
];

export const Route = createFileRoute("/planner")({
  head: () => ({ meta: [{ title: "Planner — Harness" }] }),
  component: PlannerPage,
});

function PlannerPage() {
  const [sel, setSel] = useState<string | null>("t1");
  const task = tasks.find((t) => t.id === sel);

  return (
    <>
      <PageHeader title="Planner" subtitle="Decompose, schedule, and trace every multi-step agent task" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-4 h-11 border-b border-[var(--border-subtle)] flex items-center justify-between text-[12px] text-[var(--text-muted)] uppercase tracking-wider">
            <span>Task queue</span>
            <span className="font-mono-tabular normal-case">{tasks.length}</span>
          </div>
          <ul>
            {tasks.map((t) => (
              <li
                key={t.id}
                onClick={() => setSel(t.id)}
                className={`px-4 py-3 border-b border-[var(--border-subtle)] cursor-pointer transition-colors ${sel === t.id ? "bg-[var(--accent-muted)]" : "hover:bg-[var(--bg-elevated)]/60"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium truncate">{t.title}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)] font-mono-tabular">
                  <span>{t.agent}</span><span>{t.steps} steps</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{t.eta}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          {task ? (
            <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-[18px] font-semibold tracking-tight">{task.title}</h2>
                  <div className="text-[12px] text-[var(--text-muted)] mt-1 font-mono-tabular">{task.id} · {task.agent}</div>
                </div>
                <StatusBadge status={task.status} />
              </div>

              <h3 className="text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-3">Plan trace</h3>
              <ol className="space-y-3">
                {Array.from({ length: task.steps }).map((_, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-6 w-6 rounded-full grid place-items-center text-[11px] font-mono-tabular ${i < 2 ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>{i + 1}</div>
                      {i < task.steps - 1 && <div className="flex-1 w-px bg-[var(--border-subtle)] my-1" />}
                    </div>
                    <div className="pb-3">
                      <div className="text-[13px] font-medium">{["Decompose task", "Retrieve context", "Plan tool use", "Invoke tools", "Evaluate output", "Reflect", "Iterate", "Finalize"][i % 8]}</div>
                      <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">{i < 2 ? "Completed in 412ms" : "Queued"}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <EmptyState icon={<Brain className="h-5 w-5" />} title="No task selected" body="Pick a task from the queue to inspect its plan." />
          )}
        </div>
      </div>
    </>
  );
}
