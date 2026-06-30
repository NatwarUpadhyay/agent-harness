import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { evaluations, agents, relativeTime } from "@/lib/data/synthetic";
import type { Evaluation } from "@/types";

const rows = evaluations.map((e) => ({
  ...e,
  agent: agents.find((a) => a.id === e.agentId)?.name ?? e.agentId,
  duration: `${(0.4 + (parseInt(e.id.slice(-2)) % 9) * 0.13).toFixed(2)}s`,
  date: relativeTime(e.timestamp),
}));

type Row = (typeof rows)[number];

const scoreTone = (n: number) =>
  n >= 90 ? "text-[var(--success)] bg-[color:rgb(34_197_94_/_0.10)]"
  : n >= 70 ? "text-[var(--warning)] bg-[color:rgb(245_158_11_/_0.10)]"
  :           "text-[var(--danger)] bg-[color:rgb(239_68_68_/_0.10)]";

const cols: Column<Row>[] = [
  { key: "name", header: "Eval", render: (r) => <span className="font-medium">{r.name}</span> },
  { key: "agent", header: "Agent", render: (r) => <span className="font-mono-tabular text-[12px]">{r.agent}</span> },
  { key: "score", header: "Score", align: "right", render: (r) => <span className={`text-[12px] font-mono-tabular px-1.5 py-0.5 rounded-sm ${scoreTone(r.score)}`}>{r.score}</span> },
  { key: "pass", header: "Result", render: (r) => (
    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-sm ${r.passed ? "text-[var(--success)] bg-[color:rgb(34_197_94_/_0.10)]" : "text-[var(--danger)] bg-[color:rgb(239_68_68_/_0.10)]"}`}>
      {r.passed ? "PASS" : "FAIL"}
    </span>
  ) },
  { key: "date", header: "Run", render: (r) => <span className="text-[12px] text-[var(--text-muted)] font-mono-tabular">{r.date}</span> },
  { key: "duration", header: "Duration", align: "right", render: (r) => <span className="font-mono-tabular text-[12px]">{r.duration}</span> },
];

export const Route = createFileRoute("/_authenticated/evaluations")({
  head: () => ({ meta: [{ title: "Evaluations — Harness" }] }),
  component: () => {
    const pass = (evaluations as Evaluation[]).filter((e) => e.passed).length;
    return (
      <>
        <PageHeader title="Evaluations" subtitle="Continuous quality checks on every agent output" />
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            ["Total runs", evaluations.length.toString()],
            ["Pass rate", `${((pass / evaluations.length) * 100).toFixed(1)}%`],
            ["Avg score", `${(evaluations.reduce((a, b) => a + b.score, 0) / evaluations.length).toFixed(1)}`],
            ["Critical fails", "2"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{k}</div>
              <div className="mt-1 text-[22px] font-semibold font-mono-tabular">{v}</div>
            </div>
          ))}
        </div>
        <DataTable columns={cols} rows={rows} />
      </>
    );
  },
});
