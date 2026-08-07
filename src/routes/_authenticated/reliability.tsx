import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Download, Flame, Gauge, ShieldCheck, Timer, Zap,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { toast } from "sonner";
import { SEED_SLOS, burnDown, evaluateSlo, type BurnSeverity } from "@/lib/data/slo";

export const Route = createFileRoute("/_authenticated/reliability")({
  head: () => ({
    meta: [
      { title: "Reliability SLOs — Harness" },
      {
        name: "description",
        content:
          "Service level objectives and error budgets for every agent service: burn rate, budget burn-down and time to exhaustion.",
      },
      { property: "og:title", content: "Reliability SLOs — Harness" },
      {
        property: "og:description",
        content: "Track error budgets, burn rate and exhaustion forecasts across your agent platform.",
      },
    ],
  }),
  component: ReliabilityPage,
});

const sevStyles: Record<BurnSeverity, { label: string; cls: string; dot: string }> = {
  ok: {
    label: "Healthy",
    cls: "text-[var(--success)] bg-[color:rgb(48_209_88_/_0.10)]",
    dot: "bg-[var(--success)]",
  },
  warning: {
    label: "At risk",
    cls: "text-[var(--warning)] bg-[color:rgb(255_159_10_/_0.10)]",
    dot: "bg-[var(--warning)]",
  },
  critical: {
    label: "Burning",
    cls: "text-[var(--danger)] bg-[color:rgb(255_69_58_/_0.10)]",
    dot: "bg-[var(--danger)]",
  },
};

const fmtHours = (h: number | null) => {
  if (h === null) return "—";
  if (h <= 0) return "exhausted";
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
};

function ReliabilityPage() {
  const [selected, setSelected] = useState(SEED_SLOS[1]!.id);
  const [ackd, setAckd] = useState<string[]>([]);

  const health = useMemo(() => SEED_SLOS.map(evaluateSlo), []);
  const active = health.find((h) => h.id === selected) ?? health[0]!;
  const activeSlo = SEED_SLOS.find((s) => s.id === active.id)!;
  const curve = useMemo(() => burnDown(activeSlo), [activeSlo]);

  const atRisk = health.filter((h) => h.severity !== "ok").length;
  const breached = health.filter((h) => h.breached).length;
  const worstBurn = Math.max(...health.map((h) => h.burnRate));
  const avgAchieved = health.reduce((s, h) => s + h.achieved, 0) / health.length;

  const exportCsv = () => {
    const rows = [
      ["service", "kind", "target", "achieved", "budget_total", "budget_remaining", "burn_rate", "severity"],
      ...health.map((h) => [
        h.service, h.kind, h.target.toFixed(3), h.achieved.toFixed(4),
        h.budgetTotal.toFixed(1), h.budgetRemaining.toFixed(1),
        h.burnRate.toFixed(2), h.severity,
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "harness-slo-report.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("SLO report exported", { description: `${health.length} objectives written to CSV` });
  };

  const ack = (id: string, service: string) => {
    setAckd((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (!ackd.includes(id)) {
      toast.success(`Acknowledged ${service}`, { description: "Owners notified, page suppressed for 4h" });
    }
  };

  return (
    <>
      <PageHeader
        title="Reliability"
        subtitle="Service level objectives and error budgets across every agent service"
        actions={
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
          >
            <Download className="h-3.5 w-3.5" /> Export report
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <MetricCard
          label="Fleet success rate"
          value={avgAchieved}
          display={(v) => `${v.toFixed(3)}%`}
          trend={0.04}
          series={curve.slice(-24).map((c) => c.remaining)}
          index={0}
        />
        <MetricCard
          label="Objectives at risk"
          value={atRisk}
          trend={-12}
          trendTone={atRisk ? "amber" : "green"}
          series={health.map((h) => h.consumed * 100)}
          index={1}
        />
        <MetricCard
          label="Budgets breached"
          value={breached}
          trend={breached ? 100 : 0}
          trendTone={breached ? "red" : "green"}
          series={health.map((h) => (h.breached ? 100 : 20))}
          index={2}
        />
        <MetricCard
          label="Peak burn rate"
          value={worstBurn}
          display={(v) => `${v.toFixed(1)}x`}
          trend={18}
          trendTone="red"
          series={health.map((h) => h.burnRate)}
          index={3}
        />
      </div>

      <SectionHeader title="Objectives" />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-x-auto mb-8">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
              {["Service", "Objective", "Achieved", "Budget left", "Burn rate", "Exhausts in", "State", ""].map((h) => (
                <th key={h} className="text-left font-normal px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {health.map((h) => {
              const sev = sevStyles[h.severity];
              const pctLeft = Math.max(0, Math.min(100, (h.budgetRemaining / (h.budgetTotal || 1)) * 100));
              return (
                <tr
                  key={h.id}
                  onClick={() => setSelected(h.id)}
                  className={`cursor-pointer hover:bg-[var(--bg-elevated)] ${h.id === selected ? "bg-[var(--bg-elevated)]" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                      <span className="font-medium">{h.service}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-muted)] pl-3.5">
                      {h.kind === "latency"
                        ? `p95 under ${SEED_SLOS.find((s) => s.id === h.id)?.thresholdMs}ms`
                        : "successful responses"}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono-tabular">{h.target}%</td>
                  <td className="px-4 py-3 font-mono-tabular">{h.achieved.toFixed(3)}%</td>
                  <td className="px-4 py-3 w-[160px]">
                    <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pctLeft}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.32, 1] }}
                        className={`h-full ${h.severity === "critical" ? "bg-[var(--danger)]" : h.severity === "warning" ? "bg-[var(--warning)]" : "bg-[var(--success)]"}`}
                      />
                    </div>
                    <div className="mt-1 text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                      {Math.round(Math.max(0, h.budgetRemaining)).toLocaleString()} / {Math.round(h.budgetTotal).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono-tabular">{h.burnRate.toFixed(2)}x</td>
                  <td className="px-4 py-3 font-mono-tabular">{fmtHours(h.hoursToExhaustion)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${sev.cls}`}>
                      {sev.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); ack(h.id, h.service); }}
                      className="h-7 px-2.5 rounded-md border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                    >
                      {ackd.includes(h.id) ? "Acked" : "Acknowledge"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title={`Error budget burn-down — ${active.service}`} />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve}>
                <defs>
                  <linearGradient id="burnFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number, name) => [`${v.toFixed(1)}%`, name === "ideal" ? "Ideal pace" : "Budget remaining"]}
                  labelFormatter={(t) => `Minute ${t}`}
                />
                <Area type="monotone" dataKey="remaining" stroke="var(--accent)" strokeWidth={1.8} fill="url(#burnFill)" />
                <Line type="monotone" dataKey="ideal" stroke="var(--text-muted)" strokeDasharray="4 4" strokeWidth={1} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[12px] text-[var(--text-secondary)]">
            Solid line is the remaining error budget; dashed is the pace that would consume it exactly over the{" "}
            {activeSlo.windowDays}-day window. Dropping below the dashed line means you are burning faster than the objective allows.
          </p>
        </div>

        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Recommended action" />
          <div className="space-y-3">
            {[
              {
                icon: Flame,
                title: `${active.burnRate.toFixed(1)}x burn rate`,
                body:
                  active.burnRate >= 6
                    ? "Page the on-call owner now — this budget exhausts within hours."
                    : active.burnRate >= 2
                      ? "Open an incident and freeze risky deploys for this service."
                      : "No action needed; burn is within the sustainable envelope.",
              },
              {
                icon: active.kind === "latency" ? Timer : ShieldCheck,
                title: active.kind === "latency" ? "Latency objective" : "Availability objective",
                body:
                  active.kind === "latency"
                    ? `Shed load or cache hot retrievals to keep p95 under ${activeSlo.thresholdMs}ms.`
                    : "Add retries with jitter on transient upstream failures.",
              },
              {
                icon: active.breached ? AlertTriangle : Gauge,
                title: active.breached ? "Budget exhausted" : "Budget healthy",
                body: active.breached
                  ? "Enforce a change freeze until the rolling window recovers."
                  : `${Math.round(active.budgetRemaining).toLocaleString()} bad events still available in this window.`,
              },
              {
                icon: Zap,
                title: "Rollout guard",
                body: "Wire this objective into deployments so canaries auto-halt on a 2x burn.",
              },
            ].map((r) => (
              <div key={r.title} className="flex gap-3">
                <r.icon className="h-4 w-4 mt-0.5 text-[var(--accent)] shrink-0" />
                <div>
                  <div className="text-[13px] font-medium">{r.title}</div>
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <Activity className="h-3.5 w-3.5" />
            {active.requests.toLocaleString()} requests evaluated over {activeSlo.windowDays} days
          </div>
        </div>
      </div>
    </>
  );
}
