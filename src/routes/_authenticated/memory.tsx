import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, RefreshCw, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { toast } from "sonner";

interface Namespace { id: string; name: string; rows: number; embedding: string; lastWrite: string }

const SEED: Namespace[] = [
  { id: "n1", name: "support-tickets-2025",   rows: 184_233, embedding: "text-embedding-3-large", lastWrite: "1m ago" },
  { id: "n2", name: "product-docs",           rows: 12_900,  embedding: "text-embedding-3-large", lastWrite: "4h ago" },
  { id: "n3", name: "sales-call-transcripts", rows: 6_420,   embedding: "text-embedding-3-small", lastWrite: "12m ago" },
  { id: "n4", name: "internal-wiki",          rows: 21_007,  embedding: "voyage-3-large",         lastWrite: "2d ago" },
  { id: "n5", name: "compliance-corpus",      rows: 3_188,   embedding: "text-embedding-3-large", lastWrite: "1w ago" },
];

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({
    meta: [
      { title: "Memory — Harness" },
      { name: "description", content: "Long-term vector stores powering agent recall." },
    ],
  }),
  component: MemoryPage,
});

function MemoryPage() {
  const [rows, setRows] = useState<Namespace[]>(SEED);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const reindex = (n: Namespace) => {
    setBusy(n.id);
    toast(`Reindexing ${n.name}…`);
    setTimeout(() => {
      setRows((r) => r.map((x) => (x.id === n.id ? { ...x, lastWrite: "just now" } : x)));
      setBusy(null);
      toast.success(`${n.name} reindexed`, { description: `${n.rows.toLocaleString()} vectors refreshed` });
    }, 900);
  };

  const drop = (n: Namespace) => {
    setRows((r) => r.filter((x) => x.id !== n.id));
    toast.success(`Namespace “${n.name}” dropped`);
  };

  const addNamespace = () => {
    const name = `namespace-${rows.length + 1}`;
    setRows((r) => [{ id: `n_${Date.now()}`, name, rows: 0, embedding: "text-embedding-3-large", lastWrite: "just now" }, ...r]);
    toast.success(`Created “${name}”`);
  };

  const visible = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())),
    [rows, q],
  );

  const totalVectors = rows.reduce((s, r) => s + r.rows, 0);
  const stats = [
    { label: "Total vectors", value: totalVectors.toLocaleString() },
    { label: "Namespaces", value: String(rows.length) },
    { label: "Queries / sec", value: "184.2" },
    { label: "Avg recall@10", value: "92.7%" },
  ];

  const cols: Column<Namespace>[] = [
    { key: "name", header: "Namespace", render: (r) => <span className="font-mono-tabular text-[var(--text-primary)]">{r.name}</span> },
    { key: "rows", header: "Rows", align: "right", render: (r) => <span className="font-mono-tabular">{r.rows.toLocaleString()}</span> },
    { key: "embedding", header: "Embedding model", render: (r) => <span className="text-[12px] text-[var(--text-secondary)] font-mono-tabular">{r.embedding}</span> },
    { key: "lastWrite", header: "Last write", render: (r) => <span className="text-[12px] text-[var(--text-muted)]">{r.lastWrite}</span> },
    { key: "actions", header: "", align: "right", render: (r) => (
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => reindex(r)} aria-label={`Reindex ${r.name}`}
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy === r.id ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={() => drop(r)} aria-label={`Drop ${r.name}`}
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Memory"
        subtitle="Long-term vector stores powering agent recall"
        actions={
          <button
            onClick={addNamespace}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> New namespace
          </button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{s.label}</div>
            <div className="mt-1 text-[22px] font-semibold font-mono-tabular">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search namespaces…"
          className="w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] pl-8 pr-3 text-[13px] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
      <DataTable columns={cols} rows={visible} />
    </>
  );
}
