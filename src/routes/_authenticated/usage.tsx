import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { AlertTriangle, TrendingUp, Users, Coins, Download } from "lucide-react";

// Deterministic mock roster — the enterprise "seats" view.
const TEAMS = ["Platform", "Research", "GTM", "Support", "Data"] as const;
const MODELS = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro", "o1-mini"] as const;

interface Employee {
  id: string;
  name: string;
  email: string;
  team: (typeof TEAMS)[number];
  tokensIn: number;
  tokensOut: number;
  cost: number;
  calls: number;
  budget: number;
  topModel: (typeof MODELS)[number];
  lastActive: string;
}

const FIRST = ["Aarav","Priya","Rohan","Meera","Kabir","Ishita","Vikram","Ananya","Arjun","Diya","Kunal","Riya","Zoya","Sameer","Nisha","Devansh","Tara","Om","Sara","Yash","Aditi","Neel","Kavya","Reyansh"];
const LAST = ["Sharma","Patel","Iyer","Kapoor","Rao","Menon","Chatterjee","Verma","Nair","Bose","Reddy","Gupta","Khan","Malhotra"];

function seeded(i: number) {
  const n = (i * 9301 + 49297) % 233280;
  return n / 233280;
}

const employees: Employee[] = Array.from({ length: 24 }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 3) % LAST.length];
  const tokensIn = Math.round(50_000 + seeded(i + 1) * 950_000);
  const tokensOut = Math.round(20_000 + seeded(i + 2) * 400_000);
  const cost = +(((tokensIn / 1000) * 0.005 + (tokensOut / 1000) * 0.015)).toFixed(2);
  const budget = 500 + Math.round(seeded(i + 7) * 4500);
  return {
    id: `emp_${i}`,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@acme.co`,
    team: TEAMS[i % TEAMS.length],
    tokensIn, tokensOut, cost,
    calls: Math.round(120 + seeded(i + 4) * 6000),
    budget,
    topModel: MODELS[i % MODELS.length],
    lastActive: `${1 + (i % 23)}h ago`,
  };
});

const dailySeries = Array.from({ length: 14 }, (_, d) => {
  const day = new Date(); day.setDate(day.getDate() - (13 - d));
  const base = 800 + Math.sin(d / 2) * 220;
  return {
    day: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    tokens: Math.round((base + seeded(d + 20) * 400) * 1000),
    cost: +((base + seeded(d + 30) * 200) * 0.018).toFixed(2),
  };
});

const byModel = MODELS.map((m, i) => ({
  model: m,
  tokens: employees.filter(e => e.topModel === m).reduce((s, e) => s + e.tokensIn + e.tokensOut, 0),
  cost: employees.filter(e => e.topModel === m).reduce((s, e) => s + e.cost, 0),
  color: ["#4F7AFF","#8B5CF6","#EC4899","#22D3EE"][i],
}));

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({ meta: [{ title: "Usage & Cost — Harness" }] }),
  component: UsagePage,
});

function UsagePage() {
  const [team, setTeam] = useState<string>("All");
  const filtered = useMemo(
    () => team === "All" ? employees : employees.filter(e => e.team === team),
    [team],
  );

  const totalTokens = filtered.reduce((s, e) => s + e.tokensIn + e.tokensOut, 0);
  const totalCost = filtered.reduce((s, e) => s + e.cost, 0);
  const totalBudget = filtered.reduce((s, e) => s + e.budget, 0);
  const overBudget = filtered.filter(e => e.cost > e.budget * 0.9);

  const teamRoll = TEAMS.map(t => {
    const rows = employees.filter(e => e.team === t);
    return {
      team: t,
      cost: +rows.reduce((s, e) => s + e.cost, 0).toFixed(2),
      tokens: rows.reduce((s, e) => s + e.tokensIn + e.tokensOut, 0),
      seats: rows.length,
    };
  });

  const csv = () => {
    const rows = [
      ["Name","Email","Team","Model","Tokens In","Tokens Out","Calls","Cost (USD)","Budget (USD)","% of Budget"],
      ...filtered.map(e => [
        e.name, e.email, e.team, e.topModel, e.tokensIn, e.tokensOut, e.calls,
        e.cost.toFixed(2), e.budget.toFixed(2), ((e.cost/e.budget)*100).toFixed(1) + "%",
      ]),
    ].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv.length > 0 ? rows : ""], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `harness-usage-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <>
      <PageHeader
        title="Usage & Cost"
        subtitle="Per-seat token consumption, model spend, and budget guardrails across the org."
        actions={
          <>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 text-[13px]"
            >
              <option>All</option>
              {TEAMS.map(t => <option key={t}>{t}</option>)}
            </select>
            <button
              onClick={csv}
              className="h-9 px-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[13px] inline-flex items-center gap-2 hover:bg-[var(--bg-surface)]"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Kpi icon={<Users className="h-4 w-4" />} label="Active seats" value={filtered.length.toString()} sub={`${TEAMS.length} teams`} />
        <Kpi icon={<Coins className="h-4 w-4" />} label="Tokens (30d)" value={`${(totalTokens/1_000_000).toFixed(2)}M`} sub={`${filtered.reduce((s,e)=>s+e.calls,0).toLocaleString()} calls`} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Spend (30d)" value={`$${totalCost.toFixed(2)}`} sub={`of $${totalBudget.toFixed(0)} budget`} accent={totalCost / totalBudget} />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="At risk" value={overBudget.length.toString()} sub="seats over 90% budget" warn={overBudget.length > 0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Daily spend (14d)" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailySeries}>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="cost" stroke="var(--accent)" strokeWidth={2} dot={false} name="USD" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Spend by model" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byModel} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="var(--text-muted)" fontSize={11} />
              <YAxis type="category" dataKey="model" stroke="var(--text-muted)" fontSize={11} width={110} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="cost" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Team roll-up */}
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 mb-6">
        <SectionHeader title="Team roll-up" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {teamRoll.map(t => (
            <button
              key={t.team}
              onClick={() => setTeam(t.team)}
              className={`text-left rounded-md border p-3 transition-colors ${team === t.team ? "border-[var(--accent)] bg-[var(--accent-muted)]" : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"}`}
            >
              <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">{t.team}</div>
              <div className="mt-1 text-[18px] font-semibold font-mono-tabular">${t.cost}</div>
              <div className="text-[11px] text-[var(--text-secondary)]">{t.seats} seats · {(t.tokens/1_000_000).toFixed(2)}M tok</div>
            </button>
          ))}
        </div>
      </div>

      {/* Employee table */}
      <SectionHeader title={`Seats (${filtered.length})`} />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="grid grid-cols-[minmax(180px,1.4fr)_100px_140px_120px_120px_1fr_80px] gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          <div>Employee</div>
          <div>Team</div>
          <div className="text-right">Tokens</div>
          <div className="text-right">Calls</div>
          <div className="text-right">Cost</div>
          <div>Budget</div>
          <div className="text-right">Active</div>
        </div>
        {filtered.map(e => {
          const pct = Math.min(100, (e.cost / e.budget) * 100);
          const over = pct > 90;
          return (
            <div key={e.id} className="grid grid-cols-[minmax(180px,1.4fr)_100px_140px_120px_120px_1fr_80px] gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] items-center text-[13px] hover:bg-[var(--bg-elevated)]">
              <div className="min-w-0">
                <div className="truncate font-medium">{e.name}</div>
                <div className="truncate text-[11px] text-[var(--text-muted)]">{e.email} · {e.topModel}</div>
              </div>
              <div className="text-[12px] text-[var(--text-secondary)]">{e.team}</div>
              <div className="text-right font-mono-tabular text-[12px]">{((e.tokensIn + e.tokensOut)/1000).toFixed(1)}k</div>
              <div className="text-right font-mono-tabular text-[12px]">{e.calls.toLocaleString()}</div>
              <div className="text-right font-mono-tabular text-[12px]">${e.cost.toFixed(2)}</div>
              <div>
                <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: over ? "var(--danger)" : "var(--accent)",
                    }}
                  />
                </div>
                <div className="mt-1 text-[10px] font-mono-tabular text-[var(--text-muted)]">
                  ${e.cost.toFixed(0)} / ${e.budget}
                </div>
              </div>
              <div className="text-right text-[11px] text-[var(--text-muted)]">{e.lastActive}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Kpi({ icon, label, value, sub, warn, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  warn?: boolean; accent?: number;
}) {
  const ratio = accent !== undefined ? Math.min(1, accent) : undefined;
  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
        <span className={warn ? "text-[var(--danger)]" : ""}>{icon}</span>
        {label}
      </div>
      <div className={`mt-2 text-[24px] font-semibold font-mono-tabular ${warn ? "text-[var(--danger)]" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{sub}</div>}
      {ratio !== undefined && (
        <div className="mt-2 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <div
            className="h-full"
            style={{ width: `${ratio * 100}%`, background: ratio > 0.9 ? "var(--danger)" : "var(--accent)" }}
          />
        </div>
      )}
    </div>
  );
}
