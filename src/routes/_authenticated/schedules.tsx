import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarClock, Loader2, Play, Trash2, Webhook, Power, Copy, Timer, Activity, Zap,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { useWorkflows } from "@/lib/hooks/use-entities";
import {
  listSchedules, createSchedule, toggleSchedule, deleteSchedule, triggerScheduleNow,
} from "@/lib/data/schedules.functions";
import {
  RECURRENCE_OPTIONS, cronFor, recurrenceLabel, formatRelative, type Recurrence,
} from "@/lib/data/schedules";

export const Route = createFileRoute("/_authenticated/schedules")({
  head: () => ({
    meta: [
      { title: "Schedules — Automated & webhook runs | Harness" },
      {
        name: "description",
        content:
          "Fire harness workflows without a human in the loop: recurring cron schedules, signed webhook triggers, next-run forecasts and one-click manual runs.",
      },
      { property: "og:title", content: "Schedules — Automated & webhook runs | Harness" },
      {
        property: "og:description",
        content: "Cron schedules and webhook triggers on top of the Harness production execution engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SchedulesView,
});

function SchedulesView() {
  const qc = useQueryClient();
  const { data: workflows = [] } = useWorkflows();
  const fetchSchedules = useServerFn(listSchedules);
  const create = useServerFn(createSchedule);
  const toggle = useServerFn(toggleSchedule);
  const remove = useServerFn(deleteSchedule);
  const fire = useServerFn(triggerScheduleNow);

  const [name, setName] = useState("Nightly ticket digest");
  const [workflowId, setWorkflowId] = useState("");
  const [triggerKind, setTriggerKind] = useState<"recurring" | "webhook">("recurring");
  const [recurrence, setRecurrence] = useState<Recurrence>("daily");
  const [input, setInput] = useState("Summarise yesterday's activity and flag anything unusual.");
  const [firing, setFiring] = useState<string | null>(null);

  const query = useQuery({ queryKey: ["workflow-schedules"], queryFn: () => fetchSchedules() });
  const schedules = query.data ?? [];
  const selected = workflowId || workflows[0]?.id || "";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["workflow-schedules"] });
    qc.invalidateQueries({ queryKey: ["workflow-runs"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: { workflowId: selected, name: name.trim(), triggerKind, recurrence, input },
      }),
    onSuccess: () => {
      toast.success("Trigger created");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create trigger"),
  });

  const toggleMutation = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggle({ data: v }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update trigger"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast("Trigger deleted"); invalidate(); },
  });

  const fireNow = async (id: string) => {
    setFiring(id);
    try {
      const outcome = await fire({ data: { id } });
      toast[outcome.status === "succeeded" ? "success" : "error"](
        outcome.status === "succeeded" ? "Triggered run finished" : "Triggered run failed",
        { description: outcome.error ?? "Full trace saved under Runs" },
      );
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trigger failed");
    } finally {
      setFiring(null);
    }
  };

  const stats = useMemo(() => {
    const active = schedules.filter((s) => s.enabled);
    return {
      total: schedules.length,
      active: active.length,
      webhooks: schedules.filter((s) => s.trigger_kind === "webhook").length,
      fired: schedules.reduce((sum, s) => sum + (s.run_count ?? 0), 0),
    };
  }, [schedules]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <PageHeader
        title="Schedules & triggers"
        subtitle="Run harness workflows automatically — recurring cron windows or inbound webhooks"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Triggers", value: String(stats.total), Icon: CalendarClock },
          { label: "Active", value: String(stats.active), Icon: Power },
          { label: "Webhooks", value: String(stats.webhooks), Icon: Webhook },
          { label: "Runs fired", value: String(stats.fired), Icon: Activity },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
              <s.Icon className="h-3 w-3" /> {s.label}
            </div>
            <div className="mt-2 text-[22px] font-semibold tracking-tight">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 mb-8">
        <SectionHeader title="New trigger" />
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Trigger name"
            className="h-10 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] px-3 text-[13px]"
          />
          <select
            value={selected}
            onChange={(e) => setWorkflowId(e.target.value)}
            className="h-10 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] px-3 text-[13px]"
          >
            {workflows.length === 0 && <option value="">No saved workflows</option>}
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select
            value={triggerKind}
            onChange={(e) => setTriggerKind(e.target.value as "recurring" | "webhook")}
            className="h-10 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] px-3 text-[13px]"
          >
            <option value="recurring">Recurring (cron)</option>
            <option value="webhook">Webhook (inbound)</option>
          </select>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            disabled={triggerKind === "webhook"}
            className="h-10 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] px-3 text-[13px] disabled:opacity-50"
          >
            {RECURRENCE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="Default input passed to the workflow"
          className="mt-3 w-full rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] px-3 py-2 text-[13px] resize-y"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => {
              if (!selected) { toast.error("Save a workflow on the Harness canvas first"); return; }
              if (!name.trim()) { toast.error("Name this trigger"); return; }
              createMutation.mutate();
            }}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium disabled:opacity-60"
          >
            {createMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
              : <><Zap className="h-3.5 w-3.5" /> Create trigger</>}
          </button>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            {triggerKind === "recurring" ? cronFor(recurrence) : "POST /api/public/triggers/:token"}
          </span>
        </div>
      </div>

      <SectionHeader title="Configured triggers" />
      <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
        {query.isLoading && (
          <div className="p-6 text-[13px] text-[var(--text-secondary)]">Loading triggers…</div>
        )}
        {!query.isLoading && schedules.length === 0 && (
          <div className="p-6 text-[13px] text-[var(--text-secondary)]">
            No triggers yet — create one above to run a workflow without a human in the loop.
          </div>
        )}
        {schedules.map((s) => {
          const webhookUrl = `${origin}/api/public/triggers/${s.webhook_token}`;
          return (
            <div
              key={s.id}
              className="border-b border-[var(--border-default)] last:border-b-0 bg-[var(--bg-surface)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-medium">{s.name}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{s.workflow_name}</span>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-secondary)]">
                  {s.trigger_kind === "webhook"
                    ? <><Webhook className="h-3 w-3" /> webhook</>
                    : <><Timer className="h-3 w-3" /> {recurrenceLabel(s.recurrence as Recurrence)}</>}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    s.enabled ? "text-[#22C55E] bg-[#22C55E]/10" : "text-[var(--text-muted)] bg-[var(--bg-base)]"
                  }`}
                >
                  {s.enabled ? "active" : "paused"}
                </span>
                <span className="ml-auto flex items-center gap-4 text-[11px] text-[var(--text-secondary)]">
                  <span>last {formatRelative(s.last_run_at)}</span>
                  {s.trigger_kind === "recurring" && <span>next {formatRelative(s.next_run_at)}</span>}
                  <span>{s.run_count} runs</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fireNow(s.id)}
                    disabled={firing === s.id}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label={`Run ${s.name} now`}
                  >
                    {firing === s.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => toggleMutation.mutate({ id: s.id, enabled: !s.enabled })}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label={`${s.enabled ? "Pause" : "Resume"} ${s.name}`}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(s.id)}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[#EF4444]"
                    aria-label={`Delete ${s.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {s.trigger_kind === "webhook" && (
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-base)] rounded px-2 py-1">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(webhookUrl);
                      toast("Webhook URL copied");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-[var(--text-muted)]">
        Recurring triggers are fired by a signed scheduler tick endpoint; webhook triggers accept an inbound
        POST with an optional <code className="font-mono">{"{ input }"}</code> body. Every fired run lands in
        Runs with its full per-node trace, tokens, latency and cost.
      </p>
    </div>
  );
}
