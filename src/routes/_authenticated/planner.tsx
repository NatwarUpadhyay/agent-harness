import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, Clock, Play, Pause, RotateCcw, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

const STEP_NAMES = [
  "Decompose task", "Retrieve context", "Plan tool use", "Invoke tools",
  "Evaluate output", "Reflect", "Iterate", "Finalize",
];

const AGENTS = ["Atlas-7", "Vega", "Nexus-3", "Lyra", "Orion-2", "Capella"];

type TaskStatus = "pending" | "running" | "completed" | "stopped";

interface Task {
  id: string;
  title: string;
  agent: string;
  status: TaskStatus;
  steps: number;
  done: number;
  durations: number[];
}

const STORAGE_KEY = "harness.planner.tasks.v1";

const seed: Task[] = [
  { id: "t1", title: "Draft Q3 outbound sequence", agent: "Atlas-7", status: "running", steps: 4, done: 2, durations: [412, 388] },
  { id: "t2", title: "Reconcile billing anomalies", agent: "Vega", status: "pending", steps: 6, done: 0, durations: [] },
  { id: "t3", title: "Summarize support tickets", agent: "Nexus-3", status: "completed", steps: 3, done: 3, durations: [301, 540, 218] },
  { id: "t4", title: "Audit vendor SOC2 docs", agent: "Lyra", status: "pending", steps: 8, done: 0, durations: [] },
  { id: "t5", title: "Generate weekly KPI brief", agent: "Orion-2", status: "completed", steps: 5, done: 5, durations: [280, 431, 366, 512, 199] },
  { id: "t6", title: "Triage GitHub issues", agent: "Capella", status: "pending", steps: 2, done: 0, durations: [] },
];

function load(): Task[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Task[];
    return Array.isArray(parsed) && parsed.length ? parsed : seed;
  } catch {
    return seed;
  }
}

const etaOf = (t: Task) =>
  t.status === "completed" ? "—" : `${String(Math.floor((t.steps - t.done) * 0.9)).padStart(2, "0")}:${String(((t.steps - t.done) * 22) % 60).padStart(2, "0")}`;

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "Planner — Harness" },
      { name: "description", content: "Decompose, schedule, run, and trace every multi-step agent task in your fleet." },
      { property: "og:title", content: "Planner — Harness" },
      { property: "og:description", content: "Decompose, schedule, and trace multi-step agent tasks." },
    ],
  }),
  component: PlannerPage,
});

function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>(seed);
  const [sel, setSel] = useState<string | null>("t1");
  const [draftOpen, setDraftOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState(4);
  const [agent, setAgent] = useState(AGENTS[0]);
  const hydrated = useRef(false);

  useEffect(() => { setTasks(load()); hydrated.current = true; }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Step ticker: advance running tasks one step at a time.
  useEffect(() => {
    const id = window.setInterval(() => {
      setTasks((prev) => prev.map((t) => {
        if (t.status !== "running") return t;
        if (t.done >= t.steps) return { ...t, status: "completed" as TaskStatus };
        const next = t.done + 1;
        return {
          ...t,
          done: next,
          durations: [...t.durations, 180 + Math.round(Math.random() * 620)],
          status: next >= t.steps ? ("completed" as TaskStatus) : t.status,
        };
      }));
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  const task = useMemo(() => tasks.find((t) => t.id === sel) ?? null, [tasks, sel]);
  const runningCount = tasks.filter((t) => t.status === "running").length;

  const update = (id: string, patch: Partial<Task>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const run = (t: Task) => {
    update(t.id, { status: "running", done: t.status === "completed" ? 0 : t.done, durations: t.status === "completed" ? [] : t.durations });
    toast.success(`Running “${t.title}”`);
  };
  const pause = (t: Task) => { update(t.id, { status: "stopped" }); toast(`Paused “${t.title}”`); };
  const reset = (t: Task) => { update(t.id, { status: "pending", done: 0, durations: [] }); toast(`Reset “${t.title}”`); };
  const remove = (t: Task) => {
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    if (sel === t.id) setSel(null);
    toast.success(`Removed “${t.title}”`);
  };

  const createTask = () => {
    const trimmed = title.trim();
    if (!trimmed) { toast.error("Give the task a title"); return; }
    const t: Task = {
      id: `t${Date.now()}`, title: trimmed, agent,
      status: "pending", steps: Math.min(8, Math.max(1, steps)), done: 0, durations: [],
    };
    setTasks((prev) => [t, ...prev]);
    setSel(t.id); setTitle(""); setDraftOpen(false);
    toast.success("Task queued");
  };

  return (
    <>
      <PageHeader
        title="Planner"
        subtitle={`Decompose, schedule, and trace every multi-step agent task · ${runningCount} running`}
        actions={
          <button
            onClick={() => setDraftOpen((v) => !v)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            {draftOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {draftOpen ? "Cancel" : "New task"}
          </button>
        }
      />

      {draftOpen && (
        <div className="mb-4 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row gap-2">
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTask()}
            placeholder="Task title, e.g. Summarize churn risk accounts"
            className="flex-1 h-9 px-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px] outline-none focus:border-[var(--border-strong)]"
          />
          <select
            value={agent} onChange={(e) => setAgent(e.target.value)}
            className="h-9 px-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px]"
          >
            {AGENTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={steps} onChange={(e) => setSteps(Number(e.target.value))}
            className="h-9 px-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px]"
          >
            {[2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} steps</option>)}
          </select>
          <button
            onClick={createTask}
            className="h-9 px-4 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            Queue
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-4 h-11 border-b border-[var(--border-subtle)] flex items-center justify-between text-[12px] text-[var(--text-muted)] uppercase tracking-wider">
            <span>Task queue</span>
            <span className="font-mono-tabular normal-case">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <div className="p-6 text-[13px] text-[var(--text-muted)]">Queue is empty — create a task to get started.</div>
          ) : (
            <ul>
              {tasks.map((t) => (
                <li
                  key={t.id}
                  onClick={() => setSel(t.id)}
                  className={`group px-4 py-3 border-b border-[var(--border-subtle)] cursor-pointer transition-colors ${sel === t.id ? "bg-[var(--accent-muted)]" : "hover:bg-[var(--bg-elevated)]/60"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium truncate">{t.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <StatusBadge status={t.status} />
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(t); }}
                        aria-label="Remove task"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)] font-mono-tabular">
                    <span>{t.agent}</span>
                    <span>{t.done}/{t.steps} steps</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{etaOf(t)}</span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                      style={{ width: `${(t.done / t.steps) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3">
          {task ? (
            <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-[18px] font-semibold tracking-tight">{task.title}</h2>
                  <div className="text-[12px] text-[var(--text-muted)] mt-1 font-mono-tabular">{task.id} · {task.agent}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={task.status} />
                  {task.status === "running" ? (
                    <button
                      onClick={() => pause(task)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => run(task)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[12px] font-medium hover:bg-[var(--accent-hover)]"
                    >
                      <Play className="h-3.5 w-3.5" /> {task.status === "completed" ? "Re-run" : "Run"}
                    </button>
                  )}
                  <button
                    onClick={() => reset(task)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                </div>
              </div>

              <h3 className="text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-3">Plan trace</h3>
              <ol className="space-y-3">
                {Array.from({ length: task.steps }).map((_, i) => {
                  const done = i < task.done;
                  const active = i === task.done && task.status === "running";
                  return (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-6 w-6 rounded-full grid place-items-center text-[11px] font-mono-tabular ${done ? "bg-[var(--accent)] text-[var(--bg-base)]" : active ? "bg-[var(--accent-muted)] text-[var(--text-accent)] animate-pulse" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>{i + 1}</div>
                        {i < task.steps - 1 && <div className="flex-1 w-px bg-[var(--border-subtle)] my-1" />}
                      </div>
                      <div className="pb-3">
                        <div className="text-[13px] font-medium">{STEP_NAMES[i % STEP_NAMES.length]}</div>
                        <div className="text-[12px] text-[var(--text-secondary)] mt-0.5 font-mono-tabular">
                          {done ? `Completed in ${task.durations[i] ?? 400}ms` : active ? "Executing…" : "Queued"}
                        </div>
                      </div>
                    </li>
                  );
                })}
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
