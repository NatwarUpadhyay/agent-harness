import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Plus, Trash2, TrendingUp, AlertTriangle, Download, Gauge, ShieldAlert, Check,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { toast } from "sonner";

type Enforcement = "notify" | "throttle" | "block";

interface Budget {
  id: string;
  team: string;
  cap: number;
  spent: number;
  enforcement: Enforcement;
  active: boolean;
  period: "monthly" | "quarterly";
}

const SEED: Budget[] = [
  { id: "b1", team: "Platform",   cap: 4000, spent: 2740, enforcement: "throttle", active: true,  period: "monthly" },
  { id: "b2", team: "Support AI", cap: 2500, spent: 2410, enforcement: "block",    active: true,  period: "monthly" },
  { id: "b3", team: "Research",   cap: 1800, spent: 690,  enforcement: "notify",   active: true,  period: "monthly" },
  { id: "b4", team: "Finance",    cap: 900,  spent: 934,  enforcement: "block",    active: true,  period: "monthly" },
  { id: "b5", team: "Growth",     cap: 1200, spent: 380,  enforcement: "notify",   active: false, period: "quarterly" },
];

const BK = "harness.budgets.v1";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function save(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

const enforceCopy: Record<Enforcement, string> = {
  notify: "Notify owners only",
  throttle: "Throttle agent runs at 100%",
  block: "Hard-block new runs at 100%",
};

const dayOfMonth = 21;
const daysInMonth = 30;

function statusOf(b: Budget) {
  const pct = (b.spent / b.cap) * 100;
  if (pct >= 100) return { key: "breached", label: "Breached", cls: "text-[var(--danger)] bg-[color:rgb(239_68_68_/_0.10)]" };
  if (pct >= 85) return { key: "at-risk", label: "At risk", cls: "text-[var(--warning)] bg-[color:rgb(245_158_11_/_0.10)]" };
  return { key: "healthy", label: "Healthy", cls: "text-[var(--success)] bg-[color:rgb(34_197_94_/_0.10)]" };
}

function BudgetsView() {
  const [budgets, setBudgets] = useState<Budget[]>(SEED);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<{ team: string; cap: string; enforcement: Enforcement }>({
    team: "", cap: "1000", enforcement: "notify",
  });
  const [showDraft, setShowDraft] = useState(false);

  useEffect(() => {
    setBudgets(load(BK, SEED));
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) save(BK, budgets); }, [budgets, hydrated]);

  const active = budgets.filter((b) => b.active);
  const totalCap = active.reduce((s, b) => s + b.cap, 0);
  const totalSpent = active.reduce((s, b) => s + b.spent, 0);
  const burnRate = totalSpent / dayOfMonth;
  const forecast = Math.round(burnRate * daysInMonth);
  const breaches = active.filter((b) => b.spent >= b.cap).length;

  const forecastSeries = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const actual = day <= dayOfMonth ? Math.round(burnRate * day * (0.92 + ((day * 37) % 17) / 100)) : null;
      return {
        day: `D${day}`,
        actual,
        projected: day >= dayOfMonth ? Math.round(burnRate * day) : null,
      };
    });
  }, [burnRate]);

  const update = (id: string, patch: Partial<Budget>) =>
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const addBudget = () => {
    const team = draft.team.trim();
    const cap = Number(draft.cap);
    if (!team || !Number.isFinite(cap) || cap <= 0) {
      toast.error("Enter a team name and a positive cap");
      return;
    }
    const b: Budget = {
      id: `b${Date.now()}`, team, cap, spent: 0,
      enforcement: draft.enforcement, active: true, period: "monthly",
    };
    setBudgets((prev) => [b, ...prev]);
    setDraft({ team: "", cap: "1000", enforcement: "notify" });
    setShowDraft(false);
    toast.success(`Budget created for ${team}`, { description: `$${cap.toLocaleString()} / month · ${enforceCopy[b.enforcement]}` });
  };

  const raiseCap = (b: Budget) => {
    const next = Math.ceil((b.cap * 1.25) / 50) * 50;
    update(b.id, { cap: next });
    toast.success(`${b.team} cap raised to $${next.toLocaleString()}`);
  };

  const exportCsv = () => {
    const header = "team,period,cap_usd,spent_usd,utilization_pct,enforcement,active,status\n";
    const body = budgets.map((b) => [
      b.team, b.period, b.cap, b.spent, ((b.spent / b.cap) * 100).toFixed(1),
      b.enforcement, b.active, statusOf(b).label,
    ].join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "harness-budgets.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Budgets exported", { description: `${budgets.length} rows` });
  };

  return (
    <>
      <PageHeader
        title="Budgets & forecasting"
        subtitle="Per-team spend caps, burn-down projections, and breach enforcement"
        actions={
          <>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              onClick={() => setShowDraft((v) => !v)}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              New budget
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard index={0} label="Allocated" value={totalCap} display={(v) => `$${Math.round(v).toLocaleString()}`} />
        <MetricCard index={1} label="Spent to date" value={totalSpent} display={(v) => `$${Math.round(v).toLocaleString()}`} trend={Math.round((totalSpent / Math.max(1, totalCap)) * 100)} trendTone="amber" />
        <MetricCard index={2} label="Forecast (month end)" value={forecast} display={(v) => `$${Math.round(v).toLocaleString()}`} trendTone={forecast > totalCap ? "red" : "green"} />
        <MetricCard index={3} label="Breached caps" value={breaches} trendTone={breaches ? "red" : "green"} />
      </div>

      <AnimatePresence>
        {showDraft && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-4"
          >
            <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Team</label>
                <input
                  value={draft.team}
                  onChange={(e) => setDraft({ ...draft, team: e.target.value })}
                  placeholder="e.g. Customer Success"
                  className="w-full h-9 px-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px] outline-none focus:border-[var(--border-strong)]"
                />
              </div>
              <div className="w-full sm:w-36">
                <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Monthly cap ($)</label>
                <input
                  value={draft.cap}
                  onChange={(e) => setDraft({ ...draft, cap: e.target.value })}
                  inputMode="numeric"
                  className="w-full h-9 px-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px] font-mono-tabular outline-none focus:border-[var(--border-strong)]"
                />
              </div>
              <div className="w-full sm:w-52">
                <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">On breach</label>
                <select
                  value={draft.enforcement}
                  onChange={(e) => setDraft({ ...draft, enforcement: e.target.value as Enforcement })}
                  className="w-full h-9 px-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px] outline-none focus:border-[var(--border-strong)]"
                >
                  <option value="notify">Notify owners</option>
                  <option value="throttle">Throttle runs</option>
                  <option value="block">Block runs</option>
                </select>
              </div>
              <button
                onClick={addBudget}
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
              >
                <Check className="h-3.5 w-3.5" />
                Create
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-8">
        <div className="lg:col-span-3 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Burn-down & forecast" />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(199,199,204,0.25)" />
                    <stop offset="100%" stopColor="rgba(199,199,204,0)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                    borderRadius: 8, fontSize: 12, color: "var(--text-primary)",
                  }}
                  formatter={(v: number, n: string) => [`$${Number(v).toLocaleString()}`, n === "actual" ? "Actual" : "Projected"]}
                />
                <ReferenceLine y={totalCap} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: "cap", fill: "var(--text-muted)", fontSize: 10, position: "insideTopRight" }} />
                <Area type="monotone" dataKey="actual" stroke="#C7C7CC" strokeWidth={2} fill="url(#spendFill)" connectNulls />
                <Area type="monotone" dataKey="projected" stroke="#8E8E93" strokeWidth={2} strokeDasharray="4 4" fill="none" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-2"><Gauge className="h-3.5 w-3.5" /> Burn rate ${burnRate.toFixed(0)}/day</span>
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              Projected {forecast > totalCap ? "overage" : "headroom"} ${Math.abs(forecast - totalCap).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Enforcement summary" />
          <ul className="space-y-3">
            {(["notify", "throttle", "block"] as Enforcement[]).map((e) => {
              const rows = active.filter((b) => b.enforcement === e);
              return (
                <li key={e} className="rounded-md bg-[var(--bg-elevated)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium capitalize">{e}</span>
                    <span className="text-[11px] font-mono-tabular text-[var(--text-muted)]">{rows.length} teams</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">{enforceCopy[e]}</p>
                  {rows.length > 0 && (
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 truncate">{rows.map((r) => r.team).join(", ")}</p>
                  )}
                </li>
              );
            })}
          </ul>
          {breaches > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-[color:rgb(239_68_68_/_0.35)] bg-[color:rgb(239_68_68_/_0.08)] p-3">
              <ShieldAlert className="h-4 w-4 text-[var(--danger)] mt-0.5 shrink-0" />
              <p className="text-[11px] text-[var(--text-secondary)]">
                {breaches} cap{breaches > 1 ? "s" : ""} breached — enforcement is live and incidents were routed to the alert console.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <SectionHeader title="Team budgets" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] text-left">
                <th className="py-2 pr-3 font-medium">Team</th>
                <th className="py-2 pr-3 font-medium">Cap</th>
                <th className="py-2 pr-3 font-medium w-[180px]">Utilization</th>
                <th className="py-2 pr-3 font-medium">On breach</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => {
                const pct = (b.spent / b.cap) * 100;
                const st = statusOf(b);
                return (
                  <tr key={b.id} className="border-t border-[var(--border-subtle)]">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className={b.active ? "" : "text-[var(--text-muted)]"}>{b.team}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] capitalize">{b.period}</span>
                    </td>
                    <td className="py-3 pr-3 font-mono-tabular">${b.cap.toLocaleString()}</td>
                    <td className="py-3 pr-3">
                      <div className="h-1.5 w-full max-w-[140px] rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, pct)}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.32, 1] }}
                          className="h-full rounded-full"
                          style={{ background: pct >= 100 ? "var(--danger)" : pct >= 85 ? "var(--warning)" : "var(--accent)" }}
                        />
                      </div>
                      <span className="text-[10px] font-mono-tabular text-[var(--text-muted)]">
                        ${b.spent.toLocaleString()} · {pct.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={b.enforcement}
                        onChange={(e) => {
                          update(b.id, { enforcement: e.target.value as Enforcement });
                          toast(`${b.team}: ${enforceCopy[e.target.value as Enforcement]}`);
                        }}
                        className="h-8 px-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[12px] outline-none focus:border-[var(--border-strong)]"
                      >
                        <option value="notify">Notify</option>
                        <option value="throttle">Throttle</option>
                        <option value="block">Block</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-sm font-mono-tabular ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => raiseCap(b)}
                          className="inline-flex items-center gap-1.5 h-8 px-2 rounded-md border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                        >
                          <TrendingUp className="h-3 w-3" />
                          Raise 25%
                        </button>
                        <button
                          onClick={() => {
                            update(b.id, { active: !b.active });
                            toast(`${b.team} budget ${b.active ? "paused" : "resumed"}`);
                          }}
                          className="h-8 px-2 rounded-md border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                        >
                          {b.active ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => {
                            setBudgets((prev) => prev.filter((x) => x.id !== b.id));
                            toast.success(`${b.team} budget removed`);
                          }}
                          aria-label={`Delete ${b.team} budget`}
                          className="h-8 w-8 grid place-items-center rounded-md border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--border-strong)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {budgets.length === 0 && (
          <div className="py-10 text-center text-[13px] text-[var(--text-muted)]">
            <AlertTriangle className="h-4 w-4 mx-auto mb-2" />
            No budgets yet — create one to start enforcing spend caps.
          </div>
        )}
      </div>
    </>
  );
}

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets & Forecasting — Harness" },
      { name: "description", content: "Per-team AI spend caps, burn-down forecasting, and breach enforcement for your agent fleet." },
      { property: "og:title", content: "Budgets & Forecasting — Harness" },
      { property: "og:description", content: "Set per-team spend caps, forecast month-end burn, and enforce budget breaches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BudgetsView,
});
