import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CheckCheck, Filter, Inbox, Rocket, AlertTriangle,
  Activity, CheckCircle2, Info, ShieldAlert, Siren, PlayCircle,
  Trash2,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listActivityEvents,
  markActivityRead,
  markAllActivityRead,
  type ActivityEvent,
  type ActivityKind,
} from "@/lib/data/activity.functions";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity Feed — Harness" },
      { name: "description", content: "Company-wide activity feed for budget breaches, remediation actions, alerts, and workflow runs." },
      { property: "og:title", content: "Activity Feed — Harness" },
      { property: "og:description", content: "Track every cost governance action and system event in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivityView,
});

const KIND_META: Record<ActivityKind, { label: string; Icon: typeof Info; color: string; bg: string }> = {
  budget_breach: { label: "Budget breach", Icon: ShieldAlert, color: "var(--danger)", bg: "rgba(255,69,58,0.10)" },
  remediation_applied: { label: "Remediation applied", Icon: CheckCircle2, color: "var(--success)", bg: "rgba(48,209,88,0.10)" },
  alert_escalated: { label: "Alert escalated", Icon: Siren, color: "var(--warning)", bg: "rgba(255,159,10,0.10)" },
  slo_breach: { label: "SLO breach", Icon: Activity, color: "var(--danger)", bg: "rgba(255,69,58,0.10)" },
  run_completed: { label: "Run completed", Icon: PlayCircle, color: "var(--teal)", bg: "rgba(100,210,255,0.10)" },
  info: { label: "Info", Icon: Info, color: "var(--accent)", bg: "var(--bg-elevated)" },
  deploy: { label: "Deploy", Icon: Rocket, color: "var(--accent)", bg: "rgba(199,199,204,0.10)" },
  warning: { label: "Warning", Icon: AlertTriangle, color: "var(--warning)", bg: "rgba(255,159,10,0.10)" },
  success: { label: "Success", Icon: CheckCircle2, color: "var(--success)", bg: "rgba(48,209,88,0.10)" },
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ActivityView() {
  const queryClient = useQueryClient();
  const fetchActivity = useServerFn(listActivityEvents);
  const readOne = useServerFn(markActivityRead);
  const readAll = useServerFn(markAllActivityRead);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["activity_events"],
    queryFn: () => fetchActivity(),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => readOne({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activity_events"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => readAll(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activity_events"] }),
  });

  const [filterKind, setFilterKind] = useState<ActivityKind | "all">("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const kinds = useMemo(() => {
    const set = new Set(events.map((e) => e.kind));
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterKind !== "all" && e.kind !== filterKind) return false;
      if (showUnreadOnly && e.read) return false;
      return true;
    });
  }, [events, filterKind, showUnreadOnly]);

  const unread = useMemo(() => events.filter((e) => !e.read).length, [events]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Activity feed"
        subtitle="Every budget breach, remediation action, alert escalation, and system event in one place."
      />

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1.5">
            <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as ActivityKind | "all")}
              className="bg-transparent text-[12px] text-[var(--text-primary)] outline-none"
            >
              <option value="all">All kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>{KIND_META[k].label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowUnreadOnly((v) => !v)}
            className={`inline-flex items-center gap-2 h-8 px-2.5 rounded-md border text-[12px] transition-colors ${
              showUnreadOnly
                ? "border-[var(--accent)] text-[var(--text-primary)] bg-[var(--accent-muted)]"
                : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            Unread only
          </button>
        </div>
        <button
          onClick={() => readAllMutation.mutate()}
          disabled={unread === 0 || readAllMutation.isPending}
          className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all read
        </button>
      </div>

      <div className="mt-6 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <SectionHeader title="Recent events" />
          <span className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
            {filtered.length} shown · {unread} unread
          </span>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-[12px] text-[var(--text-muted)]">Loading activity…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-elevated)] mb-3">
              <Inbox className="h-5 w-5 text-[var(--text-muted)]" />
            </div>
            <div className="text-[13px] font-medium text-[var(--text-primary)]">No events yet</div>
            <p className="text-[12px] text-[var(--text-secondary)] mt-1 max-w-sm">
              {events.length === 0
                ? "Activity events appear here when budgets breach, remediation fires, or alerts escalate."
                : "No events match the current filter."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            <AnimatePresence initial={false}>
              {filtered.map((e) => {
                const meta = KIND_META[e.kind];
                const Icon = meta.Icon;
                return (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-elevated)] transition-colors ${
                      !e.read ? "bg-[var(--accent-muted)]/30" : ""
                    }`}
                  >
                    <div
                      className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px] font-medium text-[var(--text-primary)]">{e.title}</span>
                        {!e.read && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                        <span className="text-[10.5px] text-[var(--text-muted)] font-mono-tabular ml-auto">
                          {formatRelative(e.created_at)}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">{e.body}</p>
                      {Object.keys(e.metadata).length > 0 && (
                        <p className="text-[10.5px] text-[var(--text-muted)] font-mono-tabular mt-1 truncate">
                          {JSON.stringify(e.metadata)}
                        </p>
                      )}
                    </div>
                    {!e.read && (
                      <button
                        onClick={() => readMutation.mutate(e.id)}
                        disabled={readMutation.isPending && readMutation.variables === e.id}
                        className="mt-0.5 inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-40"
                      >
                        <CheckCheck className="h-3 w-3" /> Read
                      </button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total events", value: events.length },
          { label: "Unread", value: unread },
          { label: "Budget events", value: events.filter((e) => e.kind === "budget_breach" || e.kind === "remediation_applied").length },
        ].map((s) => (
          <div key={s.label} className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{s.label}</div>
            <div className="text-[22px] font-mono-tabular text-[var(--text-primary)] mt-1">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
