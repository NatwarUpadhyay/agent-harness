import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { Calendar, Download } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusDot } from "@/components/ui/status-badge";
import { agents as fallbackAgents, tools, timeseries, evaluations, experiments, relativeTime } from "@/lib/data/synthetic";
import { useAgents } from "@/lib/hooks/use-entities";

const tooltipStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text-primary)",
};

export function DashboardView() {
  const { data: liveAgents } = useAgents();
  const agents = useMemo(
    () => (liveAgents && liveAgents.length > 0
      ? liveAgents.map((a) => ({
          id: a.id, name: a.name, model: a.model as "gpt-4o" | "claude-3-5-sonnet" | "gemini-1.5-pro",
          status: a.status as "active" | "idle" | "error",
          successRate: Number(a.success_rate), totalCalls: Number(a.total_calls),
          avgLatency: a.avg_latency, lastActive: a.last_active,
        }))
      : fallbackAgents),
    [liveAgents],
  );
  const trendSpark = timeseries.map((t) => t.agentCalls);

  const activeCount = agents.filter((a) => a.status === "active").length;
  const avgLatency = Math.round(agents.reduce((s, a) => s + a.avgLatency, 0) / Math.max(1, agents.length));
  const avgSuccess = agents.reduce((s, a) => s + a.successRate, 0) / Math.max(1, agents.length);

  const topAgents = useMemo(
    () => [...agents].sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 5),
    [agents],
  );

  const toolDist = useMemo(() => {
    const byCat: Record<string, number> = {};
    tools.forEach((t) => { byCat[t.category] = (byCat[t.category] ?? 0) + t.callCount; });
    const palette = ["#E6E6E6", "#A0A0A5", "#6E6E73", "#48484D", "#2C2C30"];
    return Object.entries(byCat).map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
  }, []);

  const totalToolCalls = toolDist.reduce((a, b) => a + b.value, 0);

  const expChart = experiments.slice(0, 3).map((e) => ({
    name: e.name.length > 22 ? e.name.slice(0, 22) + "…" : e.name,
    Success: e.successRate,
    Speed: Math.round(100 - e.avgLatency / 8),
    Cost: Math.round(100 - e.costPerCall * 2000),
  }));

  return (
    <>
      <PageHeader
        title="Platform overview"
        subtitle="Real-time intelligence across your agent fleet"
        actions={
          <>
            <button className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]">
              <Calendar className="h-3.5 w-3.5" />
              Last 7 days
            </button>
            <button className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard index={0} label="Active agents" value={activeCount} trend={12} trendTone="green" series={[30,32,35,40,activeCount]} />
        <MetricCard index={1} label="Avg latency" value={avgLatency} display={(v) => `${Math.round(v)}ms`} trend={-8} trendTone="green" series={[340,322,310,295,avgLatency]} />
        <MetricCard index={2} label="Eval score" value={avgSuccess} display={(v) => `${v.toFixed(1)}%`} trend={2.1} trendTone="green" series={[91,92,92.5,93.6,avgSuccess]} />
        <MetricCard index={3} label="Monthly cost" value={2847} display={(v) => `$${Math.round(v).toLocaleString()}`} trend={5} trendTone="amber" series={[2500,2620,2700,2780,2847]} />
      </div>

      {/* 60/40 split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-3 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
        >
          <SectionHeader title="Agent activity" />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="callsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="rgba(79,122,255,0.25)" />
                    <stop offset="100%" stopColor="rgba(79,122,255,0)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(d) => d.slice(5)} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: "var(--accent-border)" }}
                  labelFormatter={(d) => `Date: ${d}`}
                  formatter={(v: number) => [v.toLocaleString(), "Agent calls"]}
                />
                <Area type="monotone" dataKey="agentCalls" stroke="#C7C7CC" strokeWidth={2} fill="url(#callsFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
        >
          <SectionHeader title="Top agents" />
          <ul className="space-y-3">
            {topAgents.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
                className="flex items-center gap-3"
              >
                <span className="font-mono-tabular text-[11px] text-[var(--text-muted)] w-4">{i + 1}</span>
                <StatusDot status={a.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium truncate">{a.name}</span>
                    <span className="text-[10px] font-mono-tabular text-[var(--text-muted)]">{a.totalCalls.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--accent-muted)] text-[var(--text-accent)] font-mono-tabular">{a.model}</span>
                    <div className="h-1 w-20 rounded-full bg-[var(--bg-elevated)] overflow-hidden shrink-0">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, a.successRate)}%` }}
                        transition={{ duration: 0.9, delay: 0.25 + i * 0.05, ease: [0.16, 1, 0.32, 1] }}
                        className="h-full rounded-full bg-[var(--accent)]"
                      />
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Tool call distribution" />
          <div className="relative h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={toolDist} dataKey="value" innerRadius={56} outerRadius={80} stroke="none" paddingAngle={2}>
                  {toolDist.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <div className="text-[20px] font-semibold font-mono-tabular">{totalToolCalls.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">total calls</div>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {toolDist.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="capitalize">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="Context health" />
          <div className="relative h-[200px] flex items-center justify-center">
            <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
              <circle
                cx="90" cy="90" r="70"
                fill="none"
                stroke="var(--bg-elevated)"
                strokeWidth="10"
              />
              <motion.circle
                cx="90" cy="90" r="70"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 70}
                initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 70 * (1 - 0.73) }}
                transition={{ duration: 1, ease: [0.16, 1, 0.32, 1] }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <div className="text-[28px] font-semibold font-mono-tabular text-[var(--text-primary)]">73%</div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">context healthy</div>
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {[["fresh","58%"],["stale","27%"],["evicted","15%"]].map(([k,v]) => (
              <div key={k} className="rounded-md bg-[var(--bg-elevated)] py-1.5">
                <div className="text-[12px] font-mono-tabular">{v}</div>
                <div className="text-[10px] text-[var(--text-muted)] capitalize">{k}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 flex flex-col">
          <SectionHeader title="Recent evaluations" action={<a className="text-[11px] text-[var(--text-accent)] hover:underline" href="/evaluations">View all →</a>} />
          <ul className="space-y-2 overflow-y-auto max-h-[240px] pr-1">
            {evaluations.slice(0, 6).map((e) => {
              const tone =
                e.score >= 90 ? "text-[var(--success)] bg-[color:rgb(34_197_94_/_0.10)]" :
                e.score >= 70 ? "text-[var(--warning)] bg-[color:rgb(245_158_11_/_0.10)]" :
                                "text-[var(--danger)] bg-[color:rgb(239_68_68_/_0.10)]";
              return (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="text-[13px] truncate">{e.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-mono-tabular px-1.5 py-0.5 rounded-sm ${tone}`}>{e.score}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono-tabular w-16 text-right">{relativeTime(e.timestamp)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Experiment comparison */}
      <div className="mt-8 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <SectionHeader title="Experiment comparison" />
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expChart} layout="vertical" margin={{ top: 8, right: 16, left: 60, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-subtle)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} width={140} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent-muted)" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
              <Bar dataKey="Success" fill="#C7C7CC" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Speed"   fill="#8E8E93" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Cost"    fill="#5A5A5F" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ marginBottom: trendSpark.length * 0 }} />
    </>
  );
}
