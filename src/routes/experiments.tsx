import { createFileRoute } from "@tanstack/react-router";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { experiments } from "@/lib/data/synthetic";
import type { Experiment } from "@/types";

const chartData = experiments.map((e) => ({
  name: e.name.length > 18 ? e.name.slice(0, 18) + "…" : e.name,
  Success: e.successRate,
  Speed: Math.round(100 - e.avgLatency / 8),
}));

const cols: Column<Experiment>[] = [
  { key: "name", header: "Experiment", render: (r) => <span className="font-medium">{r.name}</span> },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "succ", header: "Success", align: "right", render: (r) => <span className="font-mono-tabular">{r.successRate.toFixed(1)}%</span> },
  { key: "lat", header: "Latency", align: "right", render: (r) => <span className="font-mono-tabular">{r.avgLatency}ms</span> },
  { key: "cost", header: "$/call", align: "right", render: (r) => <span className="font-mono-tabular">${r.costPerCall.toFixed(3)}</span> },
  { key: "start", header: "Started", render: (r) => <span className="text-[12px] text-[var(--text-muted)] font-mono-tabular">{r.startDate}</span> },
];

export const Route = createFileRoute("/experiments")({
  head: () => ({ meta: [{ title: "Experiments — Harness" }] }),
  component: () => (
    <>
      <PageHeader title="Experiments" subtitle="A/B test prompts, models, and pipelines side-by-side" />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 mb-5">
        <SectionHeader title="Comparison" />
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "var(--accent-muted)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Success" fill="#4F7AFF" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Speed"   fill="#A78BFA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <DataTable columns={cols} rows={experiments} />
    </>
  ),
});
