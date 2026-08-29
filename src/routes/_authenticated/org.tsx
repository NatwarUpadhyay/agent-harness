import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, Activity, Coins, Users,
  Building2, Zap, ArrowRight, ShieldCheck, Gauge, Clock, CreditCard,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBillingPlan, getUsageMeters } from "@/lib/data/billing.functions";
import { formatMeterValue, planDisplayName } from "@/lib/data/billing";

// Deterministic PRNG so the "org control room" is stable per session.
function seeded(i: number) {
  const n = (i * 9301 + 49297) % 233280;
  return n / 233280;
}

const DEPTS = [
  { name: "Engineering", seats: 84, spend: 12480, budget: 15000, latency: 620, calls: 184_320, incidents: 2 },
  { name: "Support",     seats: 41, spend: 6320,  budget: 7000,  latency: 480, calls: 96_120,  incidents: 0 },
  { name: "Sales",       seats: 27, spend: 3210,  budget: 4000,  latency: 540, calls: 42_800,  incidents: 1 },
  { name: "Marketing",   seats: 19, spend: 1820,  budget: 2500,  latency: 590, calls: 21_400,  incidents: 0 },
  { name: "Research",    seats: 12, spend: 4980,  budget: 5000,  latency: 810, calls: 12_800,  incidents: 3 },
  { name: "Ops",         seats: 22, spend: 980,   budget: 1500,  latency: 410, calls: 9_600,   incidents: 0 },
];

const dailySpend = Array.from({ length: 30 }, (_, d) => {
  const t = d / 29;
  const base = 900 + Math.sin(d / 3) * 180 + t * 400;
  return {
    day: new Date(Date.now() - (29 - d) * 86_400_000).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    spend: +(base + seeded(d + 1) * 220).toFixed(2),
    tokens: Math.round((base + seeded(d + 20) * 400) * 1200),
  };
});

const modelMix = [
  { model: "gpt-4o",             share: 42, cost: 8420 },
  { model: "claude-3-5-sonnet",  share: 28, cost: 6180 },
  { model: "gemini-1.5-pro",     share: 17, cost: 2410 },
  { model: "o1-mini",            share: 8,  cost: 940 },
  { model: "self-hosted-llama",  share: 5,  cost: 120 },
];

const incidents = [
  { id: "inc_01", team: "Research",    title: "Retrieval recall dropped 18% on legal-corpus",  severity: "high",   at: "12m ago" },
  { id: "inc_02", team: "Engineering", title: "p95 latency > 2.4s on planner-agent",            severity: "medium", at: "47m ago" },
  { id: "inc_03", team: "Sales",       title: "Prompt injection blocked (3 attempts)",           severity: "low",    at: "1h ago" },
  { id: "inc_04", team: "Research",    title: "Budget 98% consumed",                              severity: "high",   at: "2h ago" },
];

export const Route = createFileRoute("/_authenticated/org")({
  head: () => ({ meta: [{ title: "Control Room — Harness" }] }),
  component: OrgView,
});

function OrgView() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const fetchPlan = useServerFn(getBillingPlan);
  const fetchMeters = useServerFn(getUsageMeters);
  const { data: plan } = useQuery({ queryKey: ["billing-plan"], queryFn: () => fetchPlan() });
  const { data: meters = [] } = useQuery({ queryKey: ["usage-meters"], queryFn: () => fetchMeters() });

  const planMeter = meters.find((m) => m.name === "cost_usd");
  const planPct = planMeter && planMeter.limit_value > 0 ? planMeter.current_value / planMeter.limit_value : 0;

  const totals = useMemo(() => {
    const spend = DEPTS.reduce((s, d) => s + d.spend, 0);
    const budget = DEPTS.reduce((s, d) => s + d.budget, 0);
    const seats = DEPTS.reduce((s, d) => s + d.seats, 0);
    const calls = DEPTS.reduce((s, d) => s + d.calls, 0);
    const latency = Math.round(DEPTS.reduce((s, d) => s + d.latency * d.calls, 0) / calls);
    const incidents = DEPTS.reduce((s, d) => s + d.incidents, 0);
    return { spend, budget, seats, calls, latency, incidents };
  }, []);

  const budgetPct = (totals.spend / totals.budget) * 100;

  return (
    <>
      <PageHeader
        title="Control room"
        subtitle="One view across every team, model, and cost centre in your organization."
        actions={
          <>
            <div className="flex rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-0.5">
              {(["7d","30d","90d"] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`h-8 px-3 rounded-sm text-[12px] transition-colors ${range === r ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                  {r}
                </button>
              ))}
            </div>
            <Link to="/onboarding" className="h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium inline-flex items-center gap-2">
              Invite team <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <Kpi icon={<Building2 className="h-4 w-4" />} label="Departments" value={DEPTS.length.toString()} sub={`${totals.seats} seats`} />
        <Kpi icon={<Coins className="h-4 w-4" />} label="Spend (30d)" value={`$${totals.spend.toLocaleString()}`} sub={`of $${totals.budget.toLocaleString()}`} accent={budgetPct / 100} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="Agent calls" value={`${(totals.calls / 1000).toFixed(1)}k`} sub="+8.4% w/w" trend="up" />
        <Kpi icon={<Gauge className="h-4 w-4" />} label="Avg latency" value={`${totals.latency}ms`} sub="p95 1.2s" />
        <Kpi icon={<ShieldCheck className="h-4 w-4" />} label="Success rate" value="97.4%" sub="+0.6% vs last week" trend="up" />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Open incidents" value={totals.incidents.toString()} sub="2 high sev" warn={totals.incidents > 0} />
      </div>

      {/* Plan usage */}
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Plan & entitlements" />
          <Link to="/settings" className="text-[11px] text-[var(--accent)] hover:underline">Manage →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              <CreditCard className="h-3.5 w-3.5" /> Plan
            </div>
            <div className="mt-2 text-[15px] font-medium text-[var(--text-primary)]">
              {plan ? planDisplayName(plan) : "Loading…"}
            </div>
          </div>
          {meters.slice(0, 3).map((m) => {
            const pct = m.limit_value > 0 ? Math.min(100, (m.current_value / m.limit_value) * 100) : 0;
            const warn = pct >= 80;
            return (
              <div key={m.name} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{m.name.replace("cost_usd", "Spend").replace("_", " ")}</div>
                <div className="mt-2 text-[18px] font-mono-tabular text-[var(--text-primary)]">
                  {formatMeterValue(m.name, m.current_value)}
                  <span className="text-[12px] text-[var(--text-muted)]"> / {formatMeterValue(m.name, m.limit_value)}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: warn ? "var(--danger)" : "var(--accent)" }} />
                </div>
              </div>
            );
          })}
        </div>
        {planPct >= 0.9 && (
          <div className="mt-4 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[12px] text-[var(--danger)]">
            You are within 10% of your monthly spend cap. Upgrade to keep runs flowing.
          </div>
        )}
      </div>

      {/* Spend + Model mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Daily spend" action={<span className="text-[11px] text-[var(--text-muted)]">{range} · USD</span>} />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailySpend}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="spend" stroke="var(--accent)" strokeWidth={2} fill="url(#spendGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Model mix" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={modelMix} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="var(--text-muted)" fontSize={11} />
              <YAxis type="category" dataKey="model" stroke="var(--text-muted)" fontSize={11} width={130} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="cost" fill="var(--accent)" radius={[0, 4, 4, 0]} name="USD" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department roll-up + Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Departments" action={<Link to="/usage" className="text-[11px] text-[var(--accent)] hover:underline">Per-seat →</Link>} />
          <div className="space-y-2">
            {DEPTS.map((d, i) => {
              const pct = Math.min(100, (d.spend / d.budget) * 100);
              const over = pct > 90;
              return (
                <motion.div key={d.name}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="grid grid-cols-[1.2fr_80px_100px_120px_1fr_60px] gap-3 items-center px-3 py-2.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  <div>
                    <div className="text-[13px] font-medium">{d.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{d.seats} seats · {(d.calls / 1000).toFixed(1)}k calls</div>
                  </div>
                  <div className="text-[12px] font-mono-tabular text-right">{d.latency}ms</div>
                  <div className="text-[12px] font-mono-tabular text-right">${d.spend.toLocaleString()}</div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular text-right">of ${d.budget.toLocaleString()}</div>
                  <div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "var(--danger)" : "var(--accent)" }} />
                    </div>
                    <div className="mt-1 text-[10px] font-mono-tabular text-[var(--text-muted)]">{pct.toFixed(0)}%</div>
                  </div>
                  <div className="text-right">
                    {d.incidents > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--danger)]/15 text-[var(--danger)]">
                        <AlertTriangle className="h-2.5 w-2.5" />{d.incidents}
                      </span>
                    ) : <span className="text-[10px] text-[var(--text-muted)]">—</span>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Live incidents" action={<Link to="/observability" className="text-[11px] text-[var(--accent)] hover:underline">All traces →</Link>} />
          <div className="space-y-2">
            {incidents.map((i) => (
              <div key={i.id} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${
                    i.severity === "high" ? "bg-[var(--danger)]/15 text-[var(--danger)]"
                    : i.severity === "medium" ? "bg-[var(--warning)]/15 text-[var(--warning)]"
                    : "bg-[var(--accent-muted)] text-[var(--text-secondary)]"
                  }`}>{i.severity}</span>
                  <span className="text-[11px] text-[var(--text-muted)] inline-flex items-center gap-1"><Clock className="h-3 w-3" />{i.at}</span>
                </div>
                <div className="text-[13px] mt-1.5">{i.title}</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{i.team}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <SectionHeader title="Next steps" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <QuickCard to="/onboarding" icon={<Users className="h-4 w-4" />} title="Invite your team" desc="Bulk-import from SSO or send email invites." />
        <QuickCard to="/integrations" icon={<Zap className="h-4 w-4" />} title="Connect your stack" desc="Snowflake, Slack, Notion, GitHub — 40+ connectors." />
        <QuickCard to="/optimizer" icon={<TrendingDown className="h-4 w-4" />} title="Cut cost by 30%" desc="Apply live RAG + memory optimization suggestions." />
      </div>
    </>
  );
}

function Kpi({ icon, label, value, sub, warn, accent, trend }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  warn?: boolean; accent?: number; trend?: "up" | "down";
}) {
  const ratio = accent !== undefined ? Math.min(1, accent) : undefined;
  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
        <span className={warn ? "text-[var(--danger)]" : ""}>{icon}</span>{label}
      </div>
      <div className={`mt-2 text-[22px] font-semibold font-mono-tabular ${warn ? "text-[var(--danger)]" : ""}`}>{value}</div>
      {sub && (
        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 inline-flex items-center gap-1">
          {trend === "up" && <TrendingUp className="h-3 w-3 text-[var(--success)]" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 text-[var(--danger)]" />}
          {sub}
        </div>
      )}
      {ratio !== undefined && (
        <div className="mt-2 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <div className="h-full" style={{ width: `${ratio * 100}%`, background: ratio > 0.9 ? "var(--danger)" : "var(--accent)" }} />
        </div>
      )}
    </div>
  );
}

function QuickCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="group rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 hover:border-[var(--accent)] transition-colors">
      <div className="flex items-center gap-2 text-[var(--accent)]">{icon}<span className="text-[13px] font-medium text-[var(--text-primary)]">{title}</span></div>
      <p className="text-[12px] text-[var(--text-secondary)] mt-1">{desc}</p>
      <div className="mt-2 text-[11px] text-[var(--accent)] inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
