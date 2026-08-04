import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Zap, Ban, Gauge, Activity, AlertTriangle, TrendingUp,
  Play, Download, Check, Flame, Radar,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  ReferenceDot, Line, ComposedChart,
} from "recharts";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { toast } from "sonner";

type Enforcement = "notify" | "throttle" | "block";
type RunState = "allowed" | "throttled" | "blocked";

interface TeamBudget {
  id: string;
  team: string;
  cap: number;
  spent: number;
  enforcement: Enforcement;
}

interface BurnSample {
  t: number;
  rate: number;
  isAnomaly: boolean;
}

interface EnforcementEvent {
  id: string;
  ts: number;
  team: string;
  type: "allowed" | "throttled" | "blocked" | "anomaly" | "notify";
  detail: string;
  cost: number;
}

const SEED_TEAMS: TeamBudget[] = [
  { id: "t1", team: "Platform",   cap: 4000, spent: 2740, enforcement: "throttle" },
  { id: "t2", team: "Support AI", cap: 2500, spent: 2410, enforcement: "block" },
  { id: "t3", team: "Research",   cap: 1800, spent: 690,  enforcement: "notify" },
  { id: "t4", team: "Finance",    cap: 900,  spent: 934,  enforcement: "block" },
  { id: "t5", team: "Growth",     cap: 1200, spent: 380,  enforcement: "notify" },
];

const BK = "harness.enforcement.teams.v1";
const EK = "harness.enforcement.events.v1";

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
  notify: "Notify owners",
  throttle: "Throttle runs",
  block: "Block runs",
};

function pctOf(b: TeamBudget) {
  return (b.spent / b.cap) * 100;
}

function statusOf(b: TeamBudget): { label: string; cls: string; state: RunState } {
  const pct = pctOf(b);
  if (pct >= 100) return { label: "Blocked", cls: "text-[var(--danger)] bg-[color:rgb(255_69_58_/_0.10)]", state: "blocked" };
  if (pct >= 85) return { label: "Throttled", cls: "text-[var(--warning)] bg-[color:rgb(255_159_10_/_0.10)]", state: "throttled" };
  return { label: "Clear", cls: "text-[var(--success)] bg-[color:rgb(48_209_88_/_0.10)]", state: "allowed" };
}

// Z-score anomaly detection on a burn-rate window
function detectAnomalies(samples: number[], threshold = 2.2): boolean[] {
  if (samples.length < 5) return samples.map(() => false);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
  const std = Math.sqrt(variance) || 1;
  return samples.map((s) => Math.abs((s - mean) / std) >= threshold && s > mean);
}

function genBurnSeries(seedTeams: TeamBudget[]): BurnSample[] {
  // 48 half-hour samples (~24h) — base rate derived from team spend, with noise + injected spikes
  const baseRate = seedTeams.reduce((s, t) => s + t.spent, 0) / 24 / seedTeams.length;
  const rates: number[] = [];
  for (let i = 0; i < 48; i++) {
    const noise = (Math.sin(i * 0.7) * 0.15 + Math.random() * 0.25) * baseRate;
    let r = baseRate + noise;
    // Inject 2 spikes
    if (i === 18 || i === 35) r *= 2.6;
    rates.push(Math.max(0, Math.round(r * 100) / 100));
  }
  const flags = detectAnomalies(rates);
  return rates.map((rate, t) => ({ t, rate, isAnomaly: flags[t] }));
}

export const Route = createFileRoute("/_authenticated/enforcement")({
  head: () => ({
    meta: [
      { title: "Spend Enforcement — Harness" },
      { name: "description", content: "Real-time budget breach enforcement and burn-rate anomaly detection across teams." },
    ],
  }),
  component: EnforcementView,
});

function EnforcementView() {
  const [teams, setTeams] = useState<TeamBudget[]>(SEED_TEAMS);
  const [events, setEvents] = useState<EnforcementEvent[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [burnSeries, setBurnSeries] = useState<BurnSample[]>(() => genBurnSeries(SEED_TEAMS));
  const [simTeam, setSimTeam] = useState<string>(SEED_TEAMS[0].id);
  const [simCost, setSimCost] = useState("45");
  const [running, setRunning] = useState(false);
  const eventIdRef = useRef(0);

  useEffect(() => {
    setTeams(load(BK, SEED_TEAMS));
    setEvents(load(EK, []));
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) save(BK, teams); }, [teams, hydrated]);
  useEffect(() => { if (hydrated) save(EK, events); }, [events, hydrated]);

  const anomalies = useMemo(() => burnSeries.filter((s) => s.isAnomaly), [burnSeries]);
  const avgRate = useMemo(() => burnSeries.reduce((s, p) => s + p.rate, 0) / burnSeries.length, [burnSeries]);
  const peakRate = useMemo(() => Math.max(...burnSeries.map((s) => s.rate)), [burnSeries]);

  const blockedCount = useMemo(() => events.filter((e) => e.type === "blocked").length, [events]);
  const throttledCount = useMemo(() => events.filter((e) => e.type === "throttled").length, [events]);
  const anomalyCount = useMemo(() => events.filter((e) => e.type === "anomaly").length + anomalies.length, [events, anomalies]);

  const addEvent = useCallback((ev: Omit<EnforcementEvent, "id" | "ts">) => {
    const id = `ev${Date.now()}_${eventIdRef.current++}`;
    const ts = Date.now();
    setEvents((prev) => [{ ...ev, id, ts }, ...prev].slice(0, 60));
  }, []);

  const rescan = () => {
    setBurnSeries(genBurnSeries(teams));
    const newAnoms = detectAnomalies(burnSeries.map((s) => s.rate));
    const count = newAnoms.filter(Boolean).length;
    if (count > 0) {
      addEvent({ team: "—", type: "anomaly", detail: `${count} burn-rate spike${count > 1 ? "s" : ""} detected in 24h window`, cost: 0 });
      toast.warning("Anomalies detected", { description: `${count} burn-rate spike${count > 1 ? "s" : ""} flagged for review` });
    } else {
      toast.success("Burn-rate scan clean", { description: "No anomalies in the 24h window" });
    }
  };

  const simulateRun = () => {
    const team = teams.find((t) => t.id === simTeam);
    if (!team) return;
    const cost = Number(simCost);
    if (!Number.isFinite(cost) || cost <= 0) { toast.error("Enter a valid run cost"); return; }

    setRunning(true);
    const pct = pctOf(team);
    const willBreach = team.spent + cost > team.cap;
    const state: RunState =
      team.enforcement === "block" && willBreach ? "blocked" :
      team.enforcement === "throttle" && pct >= 85 ? "throttled" :
      team.enforcement === "block" && pct >= 85 && !willBreach ? "throttled" :
      "allowed";

    setTimeout(() => {
      if (state === "blocked") {
        addEvent({ team: team.team, type: "blocked", detail: `Run blocked — ${team.team} cap $${team.cap.toLocaleString()} exceeded (${pct.toFixed(0)}% used)`, cost: 0 });
        toast.error(`Run blocked for ${team.team}`, { description: "Budget cap would be breached" });
      } else if (state === "throttled") {
        const throttledCost = Math.round(cost * 0.4 * 100) / 100;
        setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, spent: t.spent + throttledCost } : t));
        addEvent({ team: team.team, type: "throttled", detail: `Run throttled to 40% throughput (${pct.toFixed(0)}% cap used)`, cost: throttledCost });
        toast.warning(`Run throttled for ${team.team}`, { description: "Near cap — throughput reduced to 40%" });
      } else {
        setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, spent: t.spent + cost } : t));
        addEvent({ team: team.team, type: "allowed", detail: `Run allowed — $${cost} charged to ${team.team}`, cost });
        toast.success(`Run completed for ${team.team}`, { description: `$${cost} charged` });
      }
      setRunning(false);
    }, 700);
  };

  const exportLog = () => {
    const header = "timestamp,team,event,detail,cost_usd\n";
    const body = events.map((e) => [
      new Date(e.ts).toISOString(), e.team, e.type, `"${e.detail.replace(/"/g, '""')}"`, e.cost,
    ].join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "harness-enforcement-log.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Enforcement log exported", { description: `${events.length} events` });
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 5000) return "just now";
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    return `${Math.round(diff / 3600000)}h ago`;
  };

  const eventIcon = (type: EnforcementEvent["type"]) => {
    switch (type) {
      case "blocked": return <Ban className="h-3.5 w-3.5 text-[var(--danger)]" />;
      case "throttled": return <Gauge className="h-3.5 w-3.5 text-[var(--warning)]" />;
      case "anomaly": return <Radar className="h-3.5 w-3.5 text-[var(--violet)]" />;
      case "notify": return <AlertTriangle className="h-3.5 w-3.5 text-[var(--amber)]" />;
      default: return <Check className="h-3.5 w-3.5 text-[var(--success)]" />;
    }
  };

  const simTeamObj = teams.find((t) => t.id === simTeam);

  return (
    <>
      <PageHeader
        title="Spend enforcement"
        subtitle="Real-time budget breach enforcement and burn-rate anomaly detection"
        actions={
          <>
            <button
              onClick={exportLog}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            >
              <Download className="h-3.5 w-3.5" /> Export log
            </button>
            <button
              onClick={rescan}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
            >
              <Radar className="h-3.5 w-3.5" /> Rescan burn-rate
            </button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard index={0} label="Active enforcements" value={teams.filter((t) => pctOf(t) >= 85).length} display={(v) => `${Math.round(v)}`} trend={0} trendTone="amber" series={[0, 1, 2]} />
        <MetricCard index={1} label="Anomalies (24h)" value={anomalyCount} display={(v) => `${Math.round(v)}`} trend={anomalyCount} trendTone={anomalyCount ? "red" : "green"} series={[0, 1, anomalyCount]} />
        <MetricCard index={2} label="Runs blocked" value={blockedCount} display={(v) => `${Math.round(v)}`} trend={blockedCount} trendTone={blockedCount ? "red" : "green"} series={[0, 0, blockedCount]} />
        <MetricCard index={3} label="Runs throttled" value={throttledCount} display={(v) => `${Math.round(v)}`} trend={throttledCount} trendTone="amber" series={[0, 1, throttledCount]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-8">
        {/* Burn-rate chart with anomaly markers */}
        <div className="lg:col-span-3 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Burn-rate · 24h window" action={
            <span className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
              avg ${avgRate.toFixed(1)}/h · peak ${peakRate.toFixed(1)}/h
            </span>
          } />
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={burnSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="burnFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(199,199,204,0.22)" />
                    <stop offset="100%" stopColor="rgba(199,199,204,0)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="t" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }}
                  formatter={(v: number) => [`$${Number(v).toFixed(2)}/h`, "Burn rate"]}
                  labelFormatter={(l) => `Sample ${l} (30m)`}
                />
                <Area type="monotone" dataKey="rate" stroke="#C7C7CC" strokeWidth={2} fill="url(#burnFill)" />
                {anomalies.map((a) => (
                  <ReferenceDot key={a.t} x={a.t} y={a.rate} r={5} fill="var(--violet)" stroke="var(--bg-surface)" strokeWidth={2} isFront />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {anomalies.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-[color:rgb(191_90_242_/_0.30)] bg-[color:rgb(191_90_242_/_0.06)] p-3">
              <Radar className="h-4 w-4 text-[var(--violet)] mt-0.5 shrink-0" />
              <p className="text-[11px] text-[var(--text-secondary)]">
                {anomalies.length} burn-rate anomaly{anomalies.length > 1 ? "ies" : ""} detected (z-score > 2.2σ). Spikes at samples {anomalies.map((a) => `#${a.t}`).join(", ")}.
              </p>
            </div>
          )}
        </div>

        {/* Simulate run panel */}
        <div className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Simulate agent run" />
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Team</label>
              <select
                value={simTeam}
                onChange={(e) => setSimTeam(e.target.value)}
                className="w-full h-9 px-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px] outline-none focus:border-[var(--border-strong)]"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.team} — {pctOf(t).toFixed(0)}% used</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Run cost ($)</label>
              <input
                value={simCost}
                onChange={(e) => setSimCost(e.target.value)}
                inputMode="numeric"
                className="w-full h-9 px-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px] font-mono-tabular outline-none focus:border-[var(--border-strong)]"
              />
            </div>

            {simTeamObj && (
              <div className="rounded-md bg-[var(--bg-elevated)] p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">Budget state</span>
                  <span className={`px-1.5 py-0.5 rounded-sm font-mono-tabular ${statusOf(simTeamObj).cls}`}>{statusOf(simTeamObj).label}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">Cap remaining</span>
                  <span className="font-mono-tabular text-[var(--text-secondary)]">${Math.max(0, simTeamObj.cap - simTeamObj.spent).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">Enforcement</span>
                  <span className="font-mono-tabular text-[var(--text-secondary)]">{enforceCopy[simTeamObj.enforcement]}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">Predicted outcome</span>
                  <span className="font-mono-tabular text-[var(--text-accent)] capitalize">
                    {simTeamObj.enforcement === "block" && simTeamObj.spent + Number(simCost || 0) > simTeamObj.cap ? "blocked" :
                     simTeamObj.enforcement === "throttle" && pctOf(simTeamObj) >= 85 ? "throttled" :
                     simTeamObj.enforcement === "block" && pctOf(simTeamObj) >= 85 ? "throttled" : "allowed"}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={simulateRun}
              disabled={running}
              className="w-full inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {running ? (
                <><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}><Activity className="h-3.5 w-3.5" /></motion.span> Processing…</>
              ) : (
                <><Play className="h-3.5 w-3.5" /> Trigger run</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Team enforcement status */}
      <div className="mt-8 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <SectionHeader title="Team enforcement status" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] text-left">
                <th className="py-2 pr-4 font-medium">Team</th>
                <th className="py-2 pr-4 font-medium">Cap</th>
                <th className="py-2 pr-4 font-medium">Spent</th>
                <th className="py-2 pr-4 font-medium w-[160px]">Utilization</th>
                <th className="py-2 pr-4 font-medium">Enforcement</th>
                <th className="py-2 pr-4 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((b) => {
                const pct = pctOf(b);
                const st = statusOf(b);
                return (
                  <tr key={b.id} className="border-t border-[var(--border-subtle)]">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="font-medium">{b.team}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono-tabular">${b.cap.toLocaleString()}</td>
                    <td className="py-3 pr-4 font-mono-tabular">${b.spent.toLocaleString()}</td>
                    <td className="py-3 pr-4">
                      <div className="h-1.5 w-full max-w-[120px] rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, pct)}%` }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.32, 1] }}
                          className="h-full rounded-full"
                          style={{ background: pct >= 100 ? "var(--danger)" : pct >= 85 ? "var(--warning)" : "var(--accent)" }}
                        />
                      </div>
                      <span className="text-[10px] font-mono-tabular text-[var(--text-muted)]">{pct.toFixed(0)}%</span>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={b.enforcement}
                        onChange={(e) => {
                          setTeams((prev) => prev.map((t) => t.id === b.id ? { ...t, enforcement: e.target.value as Enforcement } : t));
                          toast(`${b.team}: ${enforceCopy[e.target.value as Enforcement]}`);
                        }}
                        className="h-8 px-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[12px] outline-none focus:border-[var(--border-strong)]"
                      >
                        <option value="notify">Notify</option>
                        <option value="throttle">Throttle</option>
                        <option value="block">Block</option>
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-sm font-mono-tabular ${st.cls}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enforcement log */}
      <div className="mt-8 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <SectionHeader title="Enforcement log" action={
          <button
            onClick={() => { setEvents([]); toast.success("Log cleared"); }}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            Clear
          </button>
        } />
        {events.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[var(--text-muted)]">
            No enforcement events yet. Trigger a run or rescan to see enforcement in action.
          </div>
        ) : (
          <div className="space-y-1 max-h-[340px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {events.map((e) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 py-2.5 border-b border-[var(--border-subtle)] last:border-0"
                >
                  <span className="mt-0.5">{eventIcon(e.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[var(--text-primary)]">{e.detail}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono-tabular">
                      {e.team !== "—" ? `${e.team} · ` : ""}{timeAgo(e.ts)}{e.cost > 0 ? ` · $${e.cost}` : ""}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  );
}
