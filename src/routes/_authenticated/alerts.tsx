import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell, Plus, Trash2, Zap, Check, X, Filter, Flame, ShieldAlert, Activity,
  DollarSign, Clock, ShieldCheck, Mail, Slack, Webhook, Wand2, Loader2, Ban, Timer, Gauge,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatusDot } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useWorkflows } from "@/lib/hooks/use-entities";
import { listRemediationAttempts, requestRemediation } from "@/lib/data/remediation.functions";
import {
  type RemediationPolicy, type RemediationMode,
  defaultRemediationPolicy, normalizePolicy, attemptsInWindow, formatRetryAfter,
} from "@/lib/data/remediation-policy";


type Metric = "cost" | "latency" | "error_rate" | "audit_anomaly";
type Operator = ">" | ">=" | "<" | "<=";
type Severity = "critical" | "warning" | "info";
type Channel = "slack" | "email" | "pagerduty" | "webhook";
type IncidentStatus = "firing" | "acknowledged" | "resolved";
type RemediationStatus = "running" | "succeeded" | "failed" | "awaiting_approval" | "blocked";

interface AlertRule {
  id: string;
  name: string;
  metric: Metric;
  operator: Operator;
  threshold: number;
  window: string;
  severity: Severity;
  channel: Channel;
  enabled: boolean;
  created: string;
  /** Workflow fired automatically when this rule breaches. */
  remediationWorkflowId?: string;
  /** Guardrails: approval gate, hourly cap and cooldown for that workflow. */
  remediationPolicy?: RemediationPolicy;
}

interface Incident {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: Severity;
  metric: Metric;
  observed: number;
  threshold: number;
  status: IncidentStatus;
  fired: string;
  resolved?: string;
  message: string;
  remediation?: RemediationStatus;
  remediationWorkflowName?: string;
  remediationError?: string;
  /** Why remediation is pending or was refused by the policy. */
  remediationNote?: string;
}

const METRICS: { value: Metric; label: string; unit: string; icon: typeof DollarSign }[] = [
  { value: "cost", label: "Daily spend", unit: "$", icon: DollarSign },
  { value: "latency", label: "p95 latency", unit: "ms", icon: Clock },
  { value: "error_rate", label: "Error rate", unit: "%", icon: ShieldAlert },
  { value: "audit_anomaly", label: "Audit anomaly score", unit: "", icon: ShieldCheck },
];

const OPERATORS: Operator[] = [">", ">=", "<", "<="];
const SEVERITIES: { value: Severity; label: string; color: string }[] = [
  { value: "critical", label: "Critical", color: "var(--danger)" },
  { value: "warning", label: "Warning", color: "var(--warning)" },
  { value: "info", label: "Info", color: "var(--teal)" },
];
const CHANNELS: { value: Channel; label: string; icon: typeof Slack }[] = [
  { value: "slack", label: "Slack", icon: Slack },
  { value: "email", label: "Email", icon: Mail },
  { value: "pagerduty", label: "PagerDuty", icon: Bell },
  { value: "webhook", label: "Webhook", icon: Webhook },
];

const RULE_KEY = "harness.alerts.rules";
const INCIDENT_KEY = "harness.alerts.incidents";

const MODES: { value: RemediationMode; label: string; hint: string }[] = [
  { value: "manual", label: "Manual only", hint: "Never fires itself" },
  { value: "approval", label: "Approval gate", hint: "Waits for an operator" },
  { value: "auto", label: "Fully automatic", hint: "Fires on breach" },
];

const seedRules: AlertRule[] = [
  { id: "ar1", name: "Daily cost breach", metric: "cost", operator: ">", threshold: 150, window: "24h", severity: "critical", channel: "slack", enabled: true, created: "2025-07-02" },
  { id: "ar2", name: "Planner p95 latency", metric: "latency", operator: ">", threshold: 800, window: "5m", severity: "warning", channel: "pagerduty", enabled: true, created: "2025-07-05" },
  { id: "ar3", name: "Agent error rate", metric: "error_rate", operator: ">=", threshold: 5, window: "15m", severity: "critical", channel: "pagerduty", enabled: true, created: "2025-07-10" },
  { id: "ar4", name: "Audit anomaly score", metric: "audit_anomaly", operator: ">=", threshold: 70, window: "1h", severity: "info", channel: "email", enabled: false, created: "2025-07-18" },
];

const seedIncidents: Incident[] = [
  { id: "inc1", ruleId: "ar2", ruleName: "Planner p95 latency", severity: "warning", metric: "latency", observed: 942, threshold: 800, status: "firing", fired: "2m ago", message: "planner p95 crossed 800ms in us-east-1 (942ms)." },
  { id: "inc2", ruleId: "ar3", ruleName: "Agent error rate", severity: "critical", metric: "error_rate", observed: 7.3, threshold: 5, status: "acknowledged", fired: "18m ago", message: "retriever-agent error rate reached 7.3% over 15m." },
  { id: "inc3", ruleId: "ar1", ruleName: "Daily cost breach", severity: "critical", metric: "cost", observed: 184, threshold: 150, status: "resolved", fired: "3h ago", resolved: "2h ago", message: "Daily spend hit $184 — traced to runaway eval sweep." },
];

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function metricMeta(m: Metric) {
  return METRICS.find((x) => x.value === m)!;
}

const sevColor: Record<Severity, string> = {
  critical: "var(--danger)", warning: "var(--warning)", info: "var(--teal)",
};
const sevBg: Record<Severity, string> = {
  critical: "color:rgb(255_69_58_/_0.10)", warning: "color:rgb(255_159_10_/_0.10)", info: "color:rgb(100_210_255_/_0.10)",
};

const statusStyle: Record<IncidentStatus, { dot: string; text: string; bg: string }> = {
  firing: { dot: "bg-[var(--danger)]", text: "text-[var(--danger)]", bg: "bg-[color:rgb(255_69_58_/_0.10)]" },
  acknowledged: { dot: "bg-[var(--warning)]", text: "text-[var(--warning)]", bg: "bg-[color:rgb(255_159_10_/_0.10)]" },
  resolved: { dot: "bg-[var(--success)]", text: "text-[var(--success)]", bg: "bg-[color:rgb(48_209_88_/_0.10)]" },
};

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alerts — Harness" }] }),
  component: AlertsView,
});

function AlertsView() {
  const [rules, setRules] = useState<AlertRule[]>(() => load(RULE_KEY, seedRules));
  const [incidents, setIncidents] = useState<Incident[]>(() => load(INCIDENT_KEY, seedIncidents));
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Partial<AlertRule>>({
    name: "", metric: "cost", operator: ">", threshold: 100, window: "15m", severity: "warning", channel: "slack",
  });
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "all">("all");
  const { data: workflows = [] } = useWorkflows();
  const requestRemediationFn = useServerFn(requestRemediation);
  const listAttemptsFn = useServerFn(listRemediationAttempts);
  const attemptsQuery = useQuery({
    queryKey: ["remediation-attempts"],
    queryFn: () => listAttemptsFn({}),
    staleTime: 30_000,
  });

  // New rules inherit the org-wide guardrail defaults set on /remediation.
  const loadOrgFn = useServerFn(getEnterpriseAuth);
  const orgQuery = useQuery({
    queryKey: ["enterprise-auth"],
    queryFn: () => loadOrgFn({}),
    staleTime: 60_000,
  });
  const orgDefaults = useMemo(
    () => normalizePolicy(orgQuery.data?.remediationDefaults),
    [orgQuery.data],
  );


  /** Allowed attempts per rule, timestamps in epoch-ms — server ledger is the source of truth. */
  const attempts = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const a of attemptsQuery.data ?? []) {
      if (a.outcome !== "allow") continue;
      (map[a.rule_id] ??= []).push(new Date(a.created_at).getTime());
    }
    return map;
  }, [attemptsQuery.data]);

  useEffect(() => { localStorage.setItem(RULE_KEY, JSON.stringify(rules)); }, [rules]);
  useEffect(() => { localStorage.setItem(INCIDENT_KEY, JSON.stringify(incidents)); }, [incidents]);


  const activeRules = rules.filter((r) => r.enabled).length;
  const firing = incidents.filter((i) => i.status === "firing").length;
  const acked = incidents.filter((i) => i.status === "acknowledged").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;

  const filteredIncidents = useMemo(
    () => incidents.filter(
      (i) => (sevFilter === "all" || i.severity === sevFilter) && (statusFilter === "all" || i.status === statusFilter),
    ),
    [incidents, sevFilter, statusFilter],
  );

  const toggleRule = (id: string) =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));

  const deleteRule = (id: string) => {
    const r = rules.find((x) => x.id === id);
    setRules((rs) => rs.filter((x) => x.id !== id));
    toast.success(`${r?.name ?? "Rule"} deleted`, {
      action: { label: "Undo", onClick: () => setRules((rs) => (rs.some((x) => x.id === id) ? rs : [...rs, r!])) },
    });
  };

  const createRule = () => {
    if (!draft.name?.trim()) { toast.error("Give the rule a name"); return; }
    const rule: AlertRule = {
      id: `ar${Date.now()}`,
      name: draft.name!.trim(),
      metric: (draft.metric as Metric) ?? "cost",
      operator: (draft.operator as Operator) ?? ">",
      threshold: Number(draft.threshold) || 0,
      window: draft.window ?? "15m",
      severity: (draft.severity as Severity) ?? "warning",
      channel: (draft.channel as Channel) ?? "slack",
      enabled: true,
      created: new Date().toISOString().slice(0, 10),
      remediationWorkflowId: draft.remediationWorkflowId || undefined,
      remediationPolicy: normalizePolicy(draft.remediationPolicy),
    };
    setRules((rs) => [rule, ...rs]);
    setCreating(false);
    setDraft({ name: "", metric: "cost", operator: ">", threshold: 100, window: "15m", severity: "warning", channel: "slack" });
    toast.success(`Rule "${rule.name}" created`);
  };

  const setRemediation = (ruleId: string, workflowId: string) =>
    setRules((rs) => rs.map((r) => (r.id === ruleId ? { ...r, remediationWorkflowId: workflowId || undefined } : r)));

  const setPolicy = (ruleId: string, patch: Partial<RemediationPolicy>) =>
    setRules((rs) => rs.map((r) => (
      r.id === ruleId ? { ...r, remediationPolicy: normalizePolicy({ ...normalizePolicy(r.remediationPolicy), ...patch }) } : r
    )));

  const patchIncident = (id: string, patch: Partial<Incident>) =>
    setIncidents((is) => is.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  /**
   * Asks the server to remediate. Guardrails (mode, hourly cap, cooldown) are
   * enforced server-side against the persisted attempt ledger — the client only
   * renders the decision it gets back.
   */
  const remediate = async (incident: Incident, workflowId: string, humanInitiated = false) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) { toast.error("Remediation workflow no longer exists"); return; }

    const rule = rules.find((r) => r.id === incident.ruleId);
    const policy = normalizePolicy(rule?.remediationPolicy);

    patchIncident(incident.id, { remediation: "running", remediationWorkflowName: workflow.name, remediationError: undefined, remediationNote: undefined });
    try {
      const res = await requestRemediationFn({
        data: {
          ruleId: incident.ruleId,
          ruleName: incident.ruleName,
          workflowId,
          policy,
          humanInitiated,
          input: `Incident remediation request.\nRule: ${incident.ruleName}\nSeverity: ${incident.severity}\nMetric: ${incident.metric}\nObserved: ${incident.observed} (threshold ${incident.threshold})\nDetail: ${incident.message}\n\nDiagnose the likely cause and produce a concrete remediation plan.`,
        },
      });
      void attemptsQuery.refetch();

      if (res.outcome === "blocked") {
        patchIncident(incident.id, {
          remediation: "blocked",
          remediationWorkflowName: res.workflowName,
          remediationNote: res.retryAfterMs ? `${res.reason} · retry in ${formatRetryAfter(res.retryAfterMs)}` : res.reason,
        });
        toast.error("Remediation blocked by policy", { description: res.reason });
        return;
      }
      if (res.outcome === "needs_approval") {
        patchIncident(incident.id, {
          remediation: "awaiting_approval",
          remediationWorkflowName: res.workflowName,
          remediationNote: res.reason,
        });
        toast.warning("Remediation awaiting approval", { description: `${res.workflowName} — approve it in the incident console` });
        return;
      }

      const ok = (res.run as { status?: string } | null)?.status === "succeeded";
      patchIncident(incident.id, { remediation: ok ? "succeeded" : "failed" });
      if (ok) toast.success(`Remediation ran: ${res.workflowName}`, { description: "Full trace available in Runs" });
      else toast.error("Remediation run failed", { description: "See the trace in Runs" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Remediation failed";
      patchIncident(incident.id, { remediation: "failed", remediationError: message });
      toast.error("Remediation failed", { description: message });
    }
  };


  // Simulate a rule firing: pick a plausible observed value just past the threshold.
  const fireRule = (rule: AlertRule) => {
    const meta = metricMeta(rule.metric);
    const drift = rule.operator === ">" || rule.operator === ">="
      ? rule.threshold * 0.15 + (rule.metric === "audit_anomaly" ? 12 : 1)
      : -rule.threshold * 0.15;
    const observed = Math.max(0, Number((rule.threshold + drift).toFixed(rule.metric === "cost" ? 2 : 1)));
    const inc: Incident = {
      id: `inc${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      metric: rule.metric,
      observed,
      threshold: rule.threshold,
      status: "firing",
      fired: "just now",
      message: `${rule.name} fired — ${meta.label} ${rule.operator} ${meta.unit}${rule.threshold} (observed ${meta.unit}${observed}).`,
    };
    setIncidents((is) => [inc, ...is]);
    toast.error(`Alert firing: ${rule.name}`, { description: `Routed to ${rule.channel}` });
    if (rule.remediationWorkflowId) void remediate(inc, rule.remediationWorkflowId);
  };


  const setIncidentStatus = (id: string, status: IncidentStatus) => {
    setIncidents((is) => is.map((i) => (i.id === id ? { ...i, status, resolved: status === "resolved" ? "just now" : i.resolved } : i)));
    toast.success(`Incident ${status}`);
  };

  return (
    <>
      <PageHeader
        title="Alerts & incidents"
        subtitle="Rule-driven monitoring across cost, latency, errors, and audit anomalies"
        actions={
          <button
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> New rule
          </button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active rules", value: activeRules, icon: ShieldCheck, tone: "var(--accent)", sub: `${rules.length} total` },
          { label: "Firing", value: firing, icon: Flame, tone: "var(--danger)", sub: firing ? "needs triage" : "all clear" },
          { label: "Acknowledged", value: acked, icon: Activity, tone: "var(--warning)", sub: acked ? "in progress" : "—" },
          { label: "Resolved", value: resolved, icon: Check, tone: "var(--success)", sub: "this period" },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{k.label}</span>
              <k.icon className="h-4 w-4" style={{ color: k.tone }} />
            </div>
            <div className="mt-2 text-[26px] font-semibold font-mono-tabular">{k.value}</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-8"
          >
            <div className="rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5">
              <SectionHeader title="New alert rule" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Rule name" full>
                  <input
                    value={draft.name ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Daily cost breach"
                    className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 text-[13px] focus:outline-none focus:border-[var(--accent)]"
                  />
                </Field>
                <Field label="Metric">
                  <select value={draft.metric} onChange={(e) => setDraft((d) => ({ ...d, metric: e.target.value as Metric }))} className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[13px] focus:outline-none focus:border-[var(--accent)]">
                    {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </Field>
                <Field label="Operator">
                  <select value={draft.operator} onChange={(e) => setDraft((d) => ({ ...d, operator: e.target.value as Operator }))} className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[13px] focus:outline-none focus:border-[var(--accent)]">
                    {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Threshold">
                  <input type="number" value={draft.threshold ?? 0} onChange={(e) => setDraft((d) => ({ ...d, threshold: Number(e.target.value) }))} className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 text-[13px] font-mono-tabular focus:outline-none focus:border-[var(--accent)]" />
                </Field>
                <Field label="Window">
                  <select value={draft.window} onChange={(e) => setDraft((d) => ({ ...d, window: e.target.value }))} className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[13px] focus:outline-none focus:border-[var(--accent)]">
                    {["1m", "5m", "15m", "1h", "6h", "24h"].map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </Field>
                <Field label="Severity">
                  <select value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as Severity }))} className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[13px] focus:outline-none focus:border-[var(--accent)]">
                    {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Channel">
                  <select value={draft.channel} onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value as Channel }))} className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[13px] focus:outline-none focus:border-[var(--accent)]">
                    {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Auto-remediation workflow" full>
                  <select
                    value={draft.remediationWorkflowId ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, remediationWorkflowId: e.target.value }))}
                    className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[13px] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">None — notify only</option>
                    {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </Field>
                <Field label="Remediation guardrail">
                  <select
                    value={(draft.remediationPolicy ?? orgDefaults).mode}
                    onChange={(e) => setDraft((d) => ({
                      ...d,
                      remediationPolicy: normalizePolicy({ ...(d.remediationPolicy ?? orgDefaults), mode: e.target.value as RemediationMode }),
                    }))}
                    className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[13px] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {MODES.map((m) => <option key={m.value} value={m.value}>{m.label} — {m.hint}</option>)}
                  </select>
                </Field>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button onClick={() => setCreating(false)} className="h-9 px-3 rounded-md text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
                <button onClick={createRule} className="h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]">Create rule</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules table */}
      <div className="mt-8 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Alert rules</h2>
          <span className="text-[11px] text-[var(--text-muted)] font-mono-tabular">{rules.length} rules</span>
        </div>
        {rules.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-[var(--text-secondary)]">
            No alert rules yet. Click <span className="text-[var(--text-accent)]">New rule</span> to create one.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {rules.map((r) => {
              const meta = metricMeta(r.metric);
              const ChannelIcon = CHANNELS.find((c) => c.value === r.channel)!.icon;
              return (
                <div key={r.id} className="px-5 py-3">
                  <div className="flex items-center gap-4">
                  <StatusDot status={r.enabled ? "active" : "idle"} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{r.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <meta.icon className="h-3 w-3" />
                      <span>{meta.label} {r.operator} {meta.unit}{r.threshold}</span>
                      <span className="text-[var(--text-muted)]">·</span>
                      <span>win {r.window}</span>
                      <span className="text-[var(--text-muted)]">·</span>
                      <ChannelIcon className="h-3 w-3" />
                      <span className="capitalize">{r.channel}</span>
                    </div>
                  </div>
                  <span
                    className="hidden sm:inline-block text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-sm"
                    style={{ color: sevColor[r.severity], background: sevBg[r.severity] }}
                  >
                    {r.severity}
                  </span>
                  <select
                    value={r.remediationWorkflowId ?? ""}
                    onChange={(e) => setRemediation(r.id, e.target.value)}
                    title="Workflow fired automatically when this rule breaches"
                    className="hidden md:block h-7 max-w-[170px] rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[11px] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">No auto-remediation</option>
                    {workflows.map((w) => <option key={w.id} value={w.id}>↺ {w.name}</option>)}
                  </select>
                  <button
                    onClick={() => fireRule(r)}
                    disabled={!r.enabled}
                    className="h-7 px-2.5 rounded-md text-[12px] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-accent)] hover:border-[var(--accent-border)] disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                    title="Simulate this rule firing"
                  >
                    <Zap className="h-3 w-3" /> Fire
                  </button>
                  <button
                    onClick={() => toggleRule(r.id)}
                    className="relative h-5 w-9 rounded-full transition-colors"
                    style={{ background: r.enabled ? "var(--accent)" : "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
                    aria-label={r.enabled ? "Disable rule" : "Enable rule"}
                  >
                    <span
                      className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-[var(--bg-base)] transition-all"
                      style={{ left: r.enabled ? "18px" : "2px" }}
                    />
                  </button>
                  <button
                    onClick={() => deleteRule(r.id)}
                    className="h-7 w-7 grid place-items-center rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]/40"
                    aria-label="Delete rule"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  </div>
                  {r.remediationWorkflowId && (() => {
                    const policy = normalizePolicy(r.remediationPolicy);
                    const used = attemptsInWindow(attempts[r.id] ?? [], Date.now());
                    return (
                      <div className="mt-2 flex items-center gap-2 flex-wrap pl-5 text-[11px] text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Guardrails</span>
                        <select
                          value={policy.mode}
                          onChange={(e) => setPolicy(r.id, { mode: e.target.value as RemediationMode })}
                          aria-label={`Remediation mode for ${r.name}`}
                          className="h-7 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[11px] focus:outline-none focus:border-[var(--accent)]"
                        >
                          {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <label className="inline-flex items-center gap-1">
                          <Gauge className="h-3 w-3" />
                          <input
                            type="number" min={1} max={60} value={policy.maxPerHour}
                            onChange={(e) => setPolicy(r.id, { maxPerHour: Number(e.target.value) })}
                            aria-label={`Max remediations per hour for ${r.name}`}
                            className="w-12 h-7 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-1.5 text-[11px] font-mono-tabular focus:outline-none focus:border-[var(--accent)]"
                          />
                          /hr
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          <input
                            type="number" min={0} max={720} value={policy.cooldownMinutes}
                            onChange={(e) => setPolicy(r.id, { cooldownMinutes: Number(e.target.value) })}
                            aria-label={`Cooldown minutes for ${r.name}`}
                            className="w-12 h-7 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-1.5 text-[11px] font-mono-tabular focus:outline-none focus:border-[var(--accent)]"
                          />
                          m cooldown
                        </label>
                        <span className="font-mono-tabular">used {used}/{policy.maxPerHour} this hour</span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Incidents */}
      <div className="mt-8 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Incident console</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value as Severity | "all")} className="h-7 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[11px] focus:outline-none focus:border-[var(--accent)]">
              <option value="all">All severity</option>
              {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | "all")} className="h-7 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[11px] focus:outline-none focus:border-[var(--accent)]">
              <option value="all">All status</option>
              <option value="firing">Firing</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
        {filteredIncidents.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-[var(--text-secondary)]">
            No incidents match the current filters.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {filteredIncidents.map((inc) => {
              const st = statusStyle[inc.status];
              const meta = metricMeta(inc.metric);
              return (
                <motion.div key={inc.id} layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: sevColor[inc.severity] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-medium">{inc.ruleName}</span>
                        <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded-sm ${st.bg} ${st.text}`}>{inc.status}</span>
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)] mt-1">{inc.message}</div>
                      <div className="text-[10.5px] text-[var(--text-muted)] font-mono-tabular mt-1 flex items-center gap-2 flex-wrap">
                        <span>observed {meta.unit}{inc.observed} / threshold {meta.unit}{inc.threshold}</span>
                        <span>·</span>
                        <span>fired {inc.fired}</span>
                        {inc.resolved && <><span>·</span><span>resolved {inc.resolved}</span></>}
                      </div>
                      {inc.remediation && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10.5px] px-1.5 py-0.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                          {inc.remediation === "running"
                            ? <Loader2 className="h-3 w-3 animate-spin text-[var(--text-accent)]" />
                            : inc.remediation === "awaiting_approval"
                              ? <ShieldCheck className="h-3 w-3 text-[var(--warning)]" />
                              : inc.remediation === "blocked"
                                ? <Ban className="h-3 w-3 text-[var(--warning)]" />
                                : <Wand2 className={`h-3 w-3 ${inc.remediation === "succeeded" ? "text-[var(--success)]" : "text-[var(--danger)]"}`} />}
                          <span className="text-[var(--text-secondary)]">
                            {inc.remediation === "running"
                              ? "Remediation running"
                              : inc.remediation === "awaiting_approval"
                                ? "Remediation awaiting approval"
                                : inc.remediation === "blocked"
                                  ? "Remediation blocked by policy"
                                  : `Remediation ${inc.remediation}`}
                            {inc.remediationWorkflowName ? ` · ${inc.remediationWorkflowName}` : ""}
                            {inc.remediationNote ? ` · ${inc.remediationNote}` : ""}
                          </span>
                          {inc.remediation !== "awaiting_approval" && inc.remediation !== "blocked" && (
                            <Link to="/runs" className="text-[var(--text-accent)] hover:underline">trace →</Link>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(() => {
                        const rule = rules.find((r) => r.id === inc.ruleId);
                        const wfId = rule?.remediationWorkflowId;
                        if (!wfId || inc.status === "resolved" || inc.remediation === "running") return null;
                        if (inc.remediation === "awaiting_approval") {
                          return (
                            <>
                              <button onClick={() => void remediate(inc, wfId, true)} className="h-7 px-2.5 rounded-md text-[11.5px] border border-[var(--success)]/40 text-[var(--success)] hover:bg-[color:rgb(48_209_88_/_0.10)] inline-flex items-center gap-1" title="Approve and run the remediation workflow">
                                <Check className="h-3 w-3" /> Approve
                              </button>
                              <button onClick={() => patchIncident(inc.id, { remediation: "blocked", remediationNote: "Approval denied by operator" })} className="h-7 px-2.5 rounded-md text-[11.5px] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--danger)] hover:border-[var(--danger)]/40 inline-flex items-center gap-1">
                                <Ban className="h-3 w-3" /> Deny
                              </button>
                            </>
                          );
                        }
                        return (
                          <button onClick={() => void remediate(inc, wfId, true)} className="h-7 px-2.5 rounded-md text-[11.5px] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-accent)] hover:border-[var(--accent-border)] inline-flex items-center gap-1" title="Run the remediation workflow now (guardrails still apply)">
                            <Wand2 className="h-3 w-3" /> Remediate
                          </button>
                        );
                      })()}
                      {inc.status === "firing" && (
                        <button onClick={() => setIncidentStatus(inc.id, "acknowledged")} className="h-7 px-2.5 rounded-md text-[11.5px] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--warning)] hover:border-[var(--warning)]/40 inline-flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Ack
                        </button>
                      )}
                      {inc.status !== "resolved" && (
                        <button onClick={() => setIncidentStatus(inc.id, "resolved")} className="h-7 px-2.5 rounded-md text-[11.5px] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--success)] hover:border-[var(--success)]/40 inline-flex items-center gap-1">
                          <Check className="h-3 w-3" /> Resolve
                        </button>
                      )}
                      {inc.status === "resolved" && (
                        <button onClick={() => setIncidentStatus(inc.id, "firing")} className="h-7 px-2.5 rounded-md text-[11.5px] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--danger)] hover:border-[var(--danger)]/40 inline-flex items-center gap-1">
                          <X className="h-3 w-3" /> Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2 lg:col-span-4" : ""}>
      <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
