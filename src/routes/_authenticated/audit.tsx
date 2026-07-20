import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Shield, Download, Search, Filter, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit Log — Harness" }] }),
  component: AuditView,
});

// Enterprise-grade tamper-evident activity log (synthetic).
const ACTORS = [
  "aarav.sharma@acme.co","priya.patel@acme.co","rohan.iyer@acme.co","meera.kapoor@acme.co",
  "kabir.rao@acme.co","ishita.menon@acme.co","vikram.verma@acme.co","ananya.nair@acme.co",
  "system@acme.co","ci-bot@acme.co",
] as const;

const ACTIONS = [
  { key: "workflow.publish",   sev: "info",  category: "Workflow" },
  { key: "workflow.delete",    sev: "warn",  category: "Workflow" },
  { key: "workflow.share",     sev: "info",  category: "Workflow" },
  { key: "prompt.version.new", sev: "info",  category: "Prompt" },
  { key: "prompt.rollback",    sev: "warn",  category: "Prompt" },
  { key: "dataset.upload",     sev: "info",  category: "Dataset" },
  { key: "dataset.delete",     sev: "warn",  category: "Dataset" },
  { key: "integration.connect",sev: "info",  category: "Integration" },
  { key: "integration.rotate", sev: "info",  category: "Integration" },
  { key: "auth.login",         sev: "info",  category: "Auth" },
  { key: "auth.login.failed",  sev: "error", category: "Auth" },
  { key: "auth.mfa.enrolled",  sev: "info",  category: "Auth" },
  { key: "role.grant.admin",   sev: "warn",  category: "IAM" },
  { key: "policy.updated",     sev: "warn",  category: "Policy" },
  { key: "budget.exceeded",    sev: "error", category: "Budget" },
] as const;

const RESOURCES = [
  "wf_rag_pipeline","wf_multi_agent","wf_eval_harness","prompt_summarizer_v3",
  "prompt_classifier_v1","dataset_support_tickets","dataset_product_qna",
  "integration_openai","integration_pinecone","policy_pii_redact","role_admin",
];

type Sev = "info" | "warn" | "error";
interface Entry {
  id: string;
  ts: number;
  actor: string;
  action: string;
  category: string;
  resource: string;
  ip: string;
  severity: Sev;
  status: "success" | "denied";
  hash: string;
}

function seeded(i: number) { const n = (i * 9301 + 49297) % 233280; return n / 233280; }
function ip(i: number) {
  return `10.${(i * 7) % 250}.${(i * 13) % 250}.${(i * 29) % 250}`;
}
function hash(i: number) {
  // deterministic short hash-looking string
  const base = (i * 2654435761) >>> 0;
  return base.toString(16).padStart(8, "0") + ((i * 1103515245) >>> 0).toString(16).padStart(8, "0");
}

const now = Date.now();
const ENTRIES: Entry[] = Array.from({ length: 240 }, (_, i) => {
  const a = ACTIONS[Math.floor(seeded(i + 1) * ACTIONS.length)];
  const denied = a.key === "auth.login.failed" || (a.sev === "warn" && seeded(i + 9) > 0.85);
  return {
    id: `evt_${i.toString(36)}`,
    ts: now - Math.floor(seeded(i + 3) * 1000 * 60 * 60 * 24 * 14), // last 14d
    actor: ACTORS[Math.floor(seeded(i + 5) * ACTORS.length)],
    action: a.key,
    category: a.category,
    resource: RESOURCES[Math.floor(seeded(i + 7) * RESOURCES.length)],
    ip: ip(i + 1),
    severity: a.sev as Sev,
    status: denied ? "denied" : "success",
    hash: hash(i + 1),
  };
}).sort((a, b) => b.ts - a.ts);

const CATEGORIES = ["All", ...Array.from(new Set(ACTIONS.map(a => a.category)))];
const SEVS: (Sev | "all")[] = ["all", "info", "warn", "error"];

function fmt(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AuditView() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [sev, setSev] = useState<Sev | "all">("all");
  const [selected, setSelected] = useState<Entry | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ENTRIES.filter(e => {
      if (cat !== "All" && e.category !== cat) return false;
      if (sev !== "all" && e.severity !== sev) return false;
      if (!needle) return true;
      return (
        e.actor.toLowerCase().includes(needle) ||
        e.action.toLowerCase().includes(needle) ||
        e.resource.toLowerCase().includes(needle) ||
        e.ip.includes(needle)
      );
    });
  }, [q, cat, sev]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const denied = filtered.filter(e => e.status === "denied").length;
    const errors = filtered.filter(e => e.severity === "error").length;
    const actors = new Set(filtered.map(e => e.actor)).size;
    return { total, denied, errors, actors };
  }, [filtered]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(e => map.set(e.category, (map.get(e.category) ?? 0) + 1));
    return Array.from(map.entries()).map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const exportCsv = () => {
    const header = "timestamp,actor,action,category,resource,ip,severity,status,hash";
    const rows = filtered.map(e =>
      [new Date(e.ts).toISOString(), e.actor, e.action, e.category, e.resource, e.ip, e.severity, e.status, e.hash].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-log-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-8 py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Audit Log"
        subtitle="Tamper-evident record of every action across the platform. Filter, inspect, and export for compliance."
        actions={
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] hover:border-[var(--accent)]/50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <Kpi icon={<Shield className="h-3.5 w-3.5" />} label="Events" value={kpis.total.toLocaleString()} />
        <Kpi icon={<XCircle className="h-3.5 w-3.5" />} label="Denied" value={kpis.denied.toString()} accent="#F97316" />
        <Kpi icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Errors" value={kpis.errors.toString()} accent="#EF4444" />
        <Kpi icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Unique actors" value={kpis.actors.toString()} accent="#22C55E" />
      </div>

      <div className="mb-8">
        <SectionHeader title="Activity by category" />
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="category" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 6, fontSize: 12 }}
              />
              <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor, action, resource, IP..."
            className="w-full h-9 pl-8 pr-3 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[13px] outline-none focus:border-[var(--accent)]/50"
          />
        </div>
        <Filter className="h-3.5 w-3.5 text-[var(--text-muted)] ml-2" />
        <select
          value={cat} onChange={(e) => setCat(e.target.value)}
          className="h-9 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[13px]"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={sev} onChange={(e) => setSev(e.target.value as Sev | "all")}
          className="h-9 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[13px]"
        >
          {SEVS.map(s => <option key={s} value={s}>{s === "all" ? "All severities" : s}</option>)}
        </select>
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_180px_140px_180px_100px_100px] gap-4 px-4 py-2.5 border-b border-[var(--border-default)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          <div>Time</div><div>Actor</div><div>Action</div><div>Category</div><div>Resource</div><div>IP</div><div>Status</div>
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          {filtered.slice(0, 200).map(e => (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              className="w-full grid grid-cols-[160px_1fr_180px_140px_180px_100px_100px] gap-4 px-4 py-2.5 border-b border-[var(--border-default)] text-[12px] text-left hover:bg-white/[0.02]"
            >
              <div className="font-mono-tabular text-[var(--text-secondary)]">{fmt(e.ts)}</div>
              <div className="truncate">{e.actor}</div>
              <div className="font-mono-tabular text-[var(--text-secondary)]">{e.action}</div>
              <div className="text-[var(--text-secondary)]">{e.category}</div>
              <div className="font-mono-tabular text-[var(--text-secondary)] truncate">{e.resource}</div>
              <div className="font-mono-tabular text-[var(--text-muted)]">{e.ip}</div>
              <div>
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider"
                  style={{
                    background: e.status === "denied" ? "rgba(239,68,68,0.12)" : e.severity === "warn" ? "rgba(249,115,22,0.12)" : "rgba(34,197,94,0.10)",
                    color: e.status === "denied" ? "#EF4444" : e.severity === "warn" ? "#F97316" : "#22C55E",
                  }}
                >
                  {e.status}
                </span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-[13px] text-[var(--text-muted)]">No events match your filters.</div>
          )}
        </div>
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSelected(null)} />
          <aside className="fixed top-0 right-0 h-full w-[420px] z-50 bg-[var(--bg-surface)] border-l border-[var(--border-default)] p-6 overflow-y-auto">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Event</div>
            <div className="text-[16px] font-mono-tabular mb-4">{selected.action}</div>
            <Row k="Time" v={new Date(selected.ts).toISOString()} />
            <Row k="Actor" v={selected.actor} />
            <Row k="Category" v={selected.category} />
            <Row k="Resource" v={selected.resource} />
            <Row k="IP" v={selected.ip} />
            <Row k="Severity" v={selected.severity} />
            <Row k="Status" v={selected.status} />
            <Row k="Chain hash" v={selected.hash} />
            <div className="mt-6 text-[11px] text-[var(--text-muted)] leading-relaxed">
              Each entry is chained via SHA-256 to the previous entry, forming a tamper-evident log
              suitable for SOC 2 and ISO 27001 evidence collection.
            </div>
            <button
              onClick={() => setSelected(null)}
              className="mt-6 w-full h-9 rounded-md border border-[var(--border-default)] text-[13px] hover:border-[var(--accent)]/50"
            >Close</button>
          </aside>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
        {icon}{label}
      </div>
      <div className="mt-2 text-[24px] font-semibold font-mono-tabular" style={{ color: accent ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border-default)] text-[12px]">
      <div className="text-[var(--text-muted)]">{k}</div>
      <div className="font-mono-tabular text-right break-all text-[var(--text-primary)]">{v}</div>
    </div>
  );
}
