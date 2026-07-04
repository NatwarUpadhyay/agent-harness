import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Search, Activity, Pause, X, AlertCircle } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { StatusDot } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  generateTraces,
  latencyHistogram,
  percentile,
  relativeTime,
  type Trace,
  type Span,
} from "@/lib/data/traces";

const INITIAL = 240;

function ObservabilityView() {
  const [traces, setTraces] = useState<Trace[]>(() => generateTraces(INITIAL));
  const [live, setLive] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "error">("all");
  const [minLatency, setMinLatency] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const seedRef = useRef(INITIAL + 1);

  // Live tail
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => {
      setTraces((prev) => {
        const next = generateTraces(1, seedRef.current);
        seedRef.current += 1;
        return [next[0], ...prev].slice(0, 500);
      });
    }, 1400);
    return () => clearInterval(iv);
  }, [live]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return traces.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (t.duration < minLatency) return false;
      if (!q) return true;
      return (
        t.id.includes(q) ||
        t.agent.toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q) ||
        t.spans.some((s) => s.service.includes(q))
      );
    });
  }, [traces, query, statusFilter, minLatency]);

  const durations = useMemo(() => filtered.map((t) => t.duration), [filtered]);
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const errorRate = filtered.length
    ? (filtered.filter((t) => t.status === "error").length / filtered.length) * 100
    : 0;

  const histogram = useMemo(() => latencyHistogram(filtered), [filtered]);

  const errorGroups = useMemo(() => {
    const map = new Map<string, { count: number; example: Trace }>();
    for (const t of filtered) {
      if (t.status !== "error" || !t.errorGroup) continue;
      const cur = map.get(t.errorGroup);
      if (cur) cur.count++;
      else map.set(t.errorGroup, { count: 1, example: t });
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [filtered]);

  const selected = selectedId ? traces.find((t) => t.id === selectedId) ?? null : null;

  const stats = [
    { k: "Traces", v: filtered.length.toLocaleString() },
    { k: "p50", v: `${p50}ms` },
    { k: "p95", v: `${p95}ms` },
    { k: "p99", v: `${p99}ms` },
    { k: "Error rate", v: `${errorRate.toFixed(2)}%` },
  ];

  return (
    <div className="relative">
      <PageHeader title="Observability" subtitle="Distributed traces across every agent invocation" />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-[420px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search traces, agents, services…"
            className="pl-8 h-8 text-[12px] bg-[var(--bg-surface)] border-[var(--border-default)]"
          />
        </div>
        <div className="flex rounded-md border border-[var(--border-default)] overflow-hidden">
          {(["all", "ok", "error"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 h-8 text-[11px] uppercase tracking-wider transition-colors",
                statusFilter === s
                  ? "bg-[var(--accent-muted)] text-[var(--text-accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="uppercase tracking-wider">Min latency</span>
          <input
            type="range"
            min={0}
            max={1500}
            step={50}
            value={minLatency}
            onChange={(e) => setMinLatency(Number(e.target.value))}
            className="accent-[var(--accent)] w-28"
          />
          <span className="font-mono-tabular w-12 text-right">{minLatency}ms</span>
        </div>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLive((v) => !v)}
          className="h-8 gap-1.5 text-[12px] border-[var(--border-default)]"
        >
          {live ? <Pause className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
          {live ? "Pause live tail" : "Resume live tail"}
          {live && <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse ml-1" />}
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {stats.map((s) => (
          <div key={s.k} className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">{s.k}</div>
            <div className="mt-1 text-[22px] font-semibold font-mono-tabular">{s.v}</div>
          </div>
        ))}
      </div>

      {/* Histogram + Error groups */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="col-span-2 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <SectionHeader title="Latency distribution" />
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <XAxis
                  dataKey="x"
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickFormatter={(v) => `${v}ms`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--bg-elevated)" }}
                  contentStyle={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [v, "traces"]}
                  labelFormatter={(l) => `≥ ${l}ms`}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <SectionHeader title="Error groups" />
          {errorGroups.length === 0 ? (
            <div className="text-[12px] text-[var(--text-muted)] py-6 text-center">No errors in window</div>
          ) : (
            <div className="space-y-2">
              {errorGroups.slice(0, 5).map(([msg, info]) => (
                <button
                  key={msg}
                  onClick={() => setSelectedId(info.example.id)}
                  className="w-full text-left group rounded-md border border-[var(--border-subtle)] hover:border-[var(--danger)] hover:bg-[var(--bg-elevated)]/50 p-2 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-[var(--danger)] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] truncate">{msg}</div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono-tabular">
                        {info.count} occurrence{info.count === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trace list */}
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)]">
          <SectionHeader title="Recent traces" />
          <span className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
            showing {Math.min(filtered.length, 200)} of {filtered.length}
          </span>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <TraceList traces={filtered.slice(0, 200)} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 bg-black/40 z-40"
            />
            <motion.aside
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed right-0 top-0 h-full w-[520px] bg-[var(--bg-surface)] border-l border-[var(--border-default)] z-50 overflow-y-auto"
            >
              <TraceDetail trace={selected} onClose={() => setSelectedId(null)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function TraceList({
  traces,
  selectedId,
  onSelect,
}: {
  traces: Trace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const maxDur = Math.max(...traces.map((t) => t.duration), 1);
  return (
    <div>
      {traces.map((t) => {
        const selected = t.id === selectedId;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2 text-[12px] border-b border-[var(--border-subtle)] transition-colors text-left",
              selected
                ? "bg-[var(--accent-muted)]/40"
                : "hover:bg-[var(--bg-elevated)]/50",
            )}
          >
            <span className="font-mono-tabular text-[11px] text-[var(--text-muted)] w-20 shrink-0">
              {t.id}
            </span>
            <StatusDot status={t.status === "error" ? "error" : "active"} />
            <span className="w-24 truncate">{t.agent}</span>
            <span className="w-36 truncate text-[var(--text-secondary)] font-mono-tabular text-[11px]">
              {t.model}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className={
                  t.status === "error"
                    ? "h-full bg-[var(--danger)]"
                    : "h-full bg-gradient-to-r from-[var(--text-secondary)] to-[var(--text-primary)]"
                }
                style={{ width: `${(t.duration / maxDur) * 100}%` }}
              />
            </div>
            <span className="w-16 text-right font-mono-tabular">{t.duration}ms</span>
            <span className="w-16 text-right text-[10px] text-[var(--text-muted)] font-mono-tabular">
              {relativeTime(t.startedAt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TraceDetail({ trace, onClose }: { trace: Trace; onClose: () => void }) {
  const total = trace.duration;
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Trace</div>
          <div className="text-[14px] font-mono-tabular truncate">{trace.id}</div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Agent", trace.agent],
            ["Model", trace.model],
            ["Duration", `${trace.duration}ms`],
            ["Status", trace.status.toUpperCase()],
            ["Tokens", trace.tokens.toLocaleString()],
            ["Cost", `$${trace.cost.toFixed(4)}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-[var(--border-subtle)] p-2.5">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{k}</div>
              <div className="text-[13px] font-mono-tabular">{v}</div>
            </div>
          ))}
        </div>

        {trace.errorGroup && (
          <div className="rounded-md border border-[var(--danger)]/40 bg-[color:rgb(239_68_68_/_0.06)] p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--danger)]">
              <AlertCircle className="h-3.5 w-3.5" /> Error group
            </div>
            <div className="mt-1 text-[12px]">{trace.errorGroup}</div>
          </div>
        )}

        <div>
          <SectionHeader title="Waterfall" />
          <div className="space-y-1">
            {trace.spans.map((s) => (
              <WaterfallRow key={s.id} span={s} total={total} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WaterfallRow({ span, total }: { span: Span; total: number }) {
  const left = (span.start / total) * 100;
  const width = Math.max(0.5, (span.duration / total) * 100);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span
        className="truncate font-mono-tabular text-[var(--text-secondary)] shrink-0"
        style={{ width: 160, paddingLeft: span.depth * 10 }}
      >
        {span.service}
      </span>
      <div className="flex-1 relative h-4 bg-[var(--bg-elevated)]/40 rounded-sm overflow-hidden">
        <div
          className={cn(
            "absolute top-0 h-full rounded-sm",
            span.status === "error"
              ? "bg-[var(--danger)]"
              : "bg-gradient-to-r from-[var(--text-secondary)] to-[var(--text-primary)]",
          )}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
      <span className="w-14 text-right font-mono-tabular text-[var(--text-muted)]">
        {span.duration}ms
      </span>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/observability")({
  head: () => ({ meta: [{ title: "Observability — Harness" }] }),
  component: ObservabilityView,
});
