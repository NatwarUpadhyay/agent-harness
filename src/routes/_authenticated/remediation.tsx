import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { Siren, ShieldCheck, Ban, Clock, RefreshCw, Save, Download, Loader2 } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { toast } from "sonner";
import { listRemediationAttempts } from "@/lib/data/remediation.functions";
import { getEnterpriseAuth, saveEnterpriseAuth } from "@/lib/data/enterprise-auth.functions";
import { summarizeLedger, formatPercent, type AttemptRow } from "@/lib/data/remediation-analytics";
import { normalizePolicy, type RemediationMode } from "@/lib/data/remediation-policy";

export const Route = createFileRoute("/_authenticated/remediation")({
  head: () => ({
    meta: [
      { title: "Remediation ledger — Harness" },
      {
        name: "description",
        content:
          "Analytics over every auto-remediation attempt plus org-wide guardrail defaults for new alert rules.",
      },
      { property: "og:title", content: "Remediation ledger — Harness" },
      {
        property: "og:description",
        content: "Audit how often automation fires, what policy stopped, and set org-wide guardrail defaults.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RemediationLedgerView,
});

const MODES: { value: RemediationMode; label: string; hint: string }[] = [
  { value: "manual", label: "Manual only", hint: "never fires itself" },
  { value: "approval", label: "Approval gate", hint: "an operator must approve" },
  { value: "auto", label: "Automatic", hint: "fires within the caps" },
];

const outcomeStyles = {
  allow: { color: "var(--success)", label: "Allowed" },
  needs_approval: { color: "var(--warning)", label: "Awaiting approval" },
  blocked: { color: "var(--danger)", label: "Blocked" },
} as const;

function RemediationLedgerView() {
  const qc = useQueryClient();
  const listAttempts = useServerFn(listRemediationAttempts);
  const loadOrg = useServerFn(getEnterpriseAuth);
  const saveOrg = useServerFn(saveEnterpriseAuth);

  const attemptsQuery = useQuery({
    queryKey: ["remediation-attempts"],
    queryFn: () => listAttempts({}),
    staleTime: 30_000,
  });
  const orgQuery = useQuery({
    queryKey: ["enterprise-auth"],
    queryFn: () => loadOrg({}),
    staleTime: 60_000,
  });

  const [defaults, setDefaults] = useState({ mode: "approval" as RemediationMode, maxPerHour: 3, cooldownMinutes: 10 });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (orgQuery.data?.remediationDefaults && !dirty) {
      setDefaults(normalizePolicy(orgQuery.data.remediationDefaults));
    }
    // only re-sync from the server while the operator has no unsaved edits
  }, [orgQuery.data, dirty]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const config = orgQuery.data;
      if (!config) throw new Error("Org settings are still loading");
      return saveOrg({ data: { ...config, remediationDefaults: normalizePolicy(defaults) } });
    },
    onSuccess: () => {
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["enterprise-auth"] });
      toast.success("Guardrail defaults saved", {
        description: "New alert rules will inherit these limits.",
      });
    },
    onError: (e: Error) => toast.error("Could not save defaults", { description: e.message }),
  });

  const rows = (attemptsQuery.data ?? []) as unknown as AttemptRow[];
  const analytics = useMemo(() => summarizeLedger(rows), [rows]);

  const exportCsv = () => {
    const header = "timestamp,rule,outcome,reason,human_initiated,run_status,workflow\n";
    const body = rows
      .map((r) =>
        [
          new Date(r.created_at).toISOString(),
          `"${(r.rule_name ?? "").replace(/"/g, '""')}"`,
          r.outcome,
          `"${(r.reason ?? "").replace(/"/g, '""')}"`,
          r.human_initiated ? "yes" : "no",
          r.run_status ?? "",
          `"${(r.workflow_name ?? "").replace(/"/g, '""')}"`,
        ].join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "harness-remediation-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Ledger exported", { description: `${rows.length} attempts` });
  };

  const patch = (p: Partial<typeof defaults>) => {
    setDefaults((d) => normalizePolicy({ ...d, ...p }));
    setDirty(true);
  };

  return (
    <>
      <PageHeader
        title="Remediation ledger"
        subtitle="What automation attempted, what policy stopped, and the org-wide guardrail defaults"
        actions={
          <>
            <button
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button
              onClick={() => void attemptsQuery.refetch()}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
            >
              {attemptsQuery.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          index={0}
          label="Attempts (24h)"
          value={analytics.totals.total}
          display={(v) => `${Math.round(v)}`}
          trend={analytics.totals.total}
          trendTone="amber"
          series={[0, 1, analytics.totals.total]}
        />
        <MetricCard
          index={1}
          label="Allowed by policy"
          value={analytics.allowRate * 100}
          display={(v) => `${Math.round(v)}%`}
          trend={analytics.totals.allow}
          trendTone="green"
          series={[0, 1, analytics.totals.allow]}
        />
        <MetricCard
          index={2}
          label="Stopped by guardrails"
          value={analytics.totals.blocked + analytics.totals.needs_approval}
          display={(v) => `${Math.round(v)}`}
          trend={analytics.totals.blocked}
          trendTone={analytics.totals.blocked ? "red" : "green"}
          series={[0, 1, analytics.totals.blocked]}
        />
        <MetricCard
          index={3}
          label="Triggered run success"
          value={analytics.runSuccessRate * 100}
          display={(v) => `${Math.round(v)}%`}
          trend={analytics.runSuccessRate * 100}
          trendTone={analytics.runSuccessRate >= 0.8 ? "green" : "amber"}
          series={[0, 50, analytics.runSuccessRate * 100]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-8">
        {/* Hourly outcome distribution */}
        <div className="lg:col-span-3 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader
            title="Attempt outcomes — last 24 hours"
            action={
              <span className="text-[11px] text-[var(--text-muted)]">
                {formatPercent(analytics.automationShare)} machine-initiated
              </span>
            }
          />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.hourly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} interval={3} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="allow" name="Allowed" stackId="a" fill="var(--success)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="needs_approval" name="Awaiting approval" stackId="a" fill="var(--warning)" />
                <Bar dataKey="blocked" name="Blocked" stackId="a" fill="var(--danger)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Org-wide guardrail defaults */}
        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Org-wide guardrail defaults" />
          <p className="text-[12px] text-[var(--text-secondary)] mb-4">
            Every new alert rule starts from these limits, so a rule can never be created with automation
            wide open by accident. Existing rules keep their own overrides.
          </p>
          <div className="space-y-4">
            <label className="block">
              <span className="block text-[12px] text-[var(--text-secondary)] mb-1.5">Default mode</span>
              <select
                value={defaults.mode}
                onChange={(e) => patch({ mode: e.target.value as RemediationMode })}
                className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[13px] focus:outline-none focus:border-[var(--accent)]"
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} — {m.hint}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[12px] text-[var(--text-secondary)] mb-1.5">Max / hour</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={defaults.maxPerHour}
                  onChange={(e) => patch({ maxPerHour: Number(e.target.value) })}
                  className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[13px] focus:outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block">
                <span className="block text-[12px] text-[var(--text-secondary)] mb-1.5">Cooldown (min)</span>
                <input
                  type="number"
                  min={0}
                  max={720}
                  value={defaults.cooldownMinutes}
                  onChange={(e) => patch({ cooldownMinutes: Number(e.target.value) })}
                  className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2 text-[13px] focus:outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending || !orgQuery.data}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-40"
            >
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? "Save defaults" : "Saved"}
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
            <SectionHeader title="Top block reasons" />
            {analytics.topBlockReasons.length === 0 ? (
              <p className="text-[12px] text-[var(--text-muted)]">Nothing has been blocked in this window.</p>
            ) : (
              <ul className="space-y-2">
                {analytics.topBlockReasons.map((r) => (
                  <li key={r.reason} className="flex items-start justify-between gap-3 text-[12px]">
                    <span className="text-[var(--text-secondary)]">{r.reason}</span>
                    <span className="font-mono-tabular text-[var(--danger)]">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Per-rule breakdown */}
      <div className="mt-8 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="p-5 pb-0">
          <SectionHeader
            title="Per-rule behaviour"
            action={
              analytics.busiestRule ? (
                <span className="text-[11px] text-[var(--text-muted)]">
                  Busiest: {analytics.busiestRule.ruleName}
                </span>
              ) : undefined
            }
          />
        </div>
        {analytics.rules.length === 0 ? (
          <div className="px-5 pb-6 flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
            <Siren className="h-4 w-4" /> No remediation attempts recorded yet — fire a rule from Alerts to
            populate the ledger.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <th className="text-left font-normal px-5 py-3">Rule</th>
                  <th className="text-right font-normal px-3 py-3">Attempts</th>
                  <th className="text-right font-normal px-3 py-3">Allowed</th>
                  <th className="text-right font-normal px-3 py-3">Approval</th>
                  <th className="text-right font-normal px-3 py-3">Blocked</th>
                  <th className="text-right font-normal px-3 py-3">Run failures</th>
                  <th className="text-right font-normal px-5 py-3">Allow rate</th>
                </tr>
              </thead>
              <tbody>
                {analytics.rules.map((r, i) => (
                  <motion.tr
                    key={r.ruleId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                    className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-elevated)]"
                  >
                    <td className="px-5 py-3">
                      <div className="text-[var(--text-primary)]">{r.ruleName}</div>
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {r.lastAt ? new Date(r.lastAt).toLocaleString() : "—"}
                        {r.humanInitiated > 0 && <span>· {r.humanInitiated} operator-initiated</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono-tabular">{r.total}</td>
                    <td className="px-3 py-3 text-right font-mono-tabular text-[var(--success)]">{r.allowed}</td>
                    <td className="px-3 py-3 text-right font-mono-tabular text-[var(--warning)]">{r.needsApproval}</td>
                    <td className="px-3 py-3 text-right font-mono-tabular text-[var(--danger)]">{r.blocked}</td>
                    <td className="px-3 py-3 text-right font-mono-tabular">{r.runFailures}</td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px]"
                        style={{
                          color: r.allowRate >= 0.5 ? outcomeStyles.allow.color : outcomeStyles.blocked.color,
                          background: "var(--bg-elevated)",
                        }}
                      >
                        {r.allowRate >= 0.5 ? <ShieldCheck className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                        {formatPercent(r.allowRate)}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
