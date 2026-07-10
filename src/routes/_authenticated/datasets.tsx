import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, FileText, FileJson, Trash2, Eye, X, Search, Database } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { useDatasets, formatBytes, type DatasetRecord, type DatasetKind } from "@/lib/data/datasets-store";

const kindIcon = (k: DatasetKind) =>
  k === "jsonl" || k === "json" ? FileJson : k === "markdown" ? FileText : FileSpreadsheet;

const kindColor: Record<DatasetKind, string> = {
  csv: "var(--accent)", jsonl: "var(--violet)", json: "var(--violet)",
  markdown: "var(--teal)", parquet: "var(--amber)",
};

function relTime(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toISOString().slice(0, 10);
}

function DatasetsView() {
  const { datasets, upload, remove } = useDatasets();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DatasetRecord | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<DatasetKind | "all">("all");

  const filtered = useMemo(() => {
    return datasets.filter((d) =>
      (kindFilter === "all" || d.kind === kindFilter) &&
      (query.trim() === "" || d.name.toLowerCase().includes(query.toLowerCase()))
    );
  }, [datasets, kindFilter, query]);

  const totals = useMemo(() => ({
    files: datasets.length,
    rows: datasets.reduce((s, d) => s + d.rows, 0),
    bytes: datasets.reduce((s, d) => s + d.sizeBytes, 0),
    uploads: datasets.filter((d) => d.source === "upload").length,
  }), [datasets]);

  const handleFiles = async (files: FileList | File[]) => {
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        const rec = await upload(file);
        ok++;
        toast.success(`Uploaded ${rec.name}`, { description: `${rec.rows.toLocaleString()} rows · ${formatBytes(rec.sizeBytes)}` });
      } catch (err) {
        toast.error(`Failed to parse ${file.name}`, { description: err instanceof Error ? err.message : "unknown error" });
      }
    }
    setBusy(false);
    if (ok === 0 && files.length > 0) toast.error("No files could be added");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const onDelete = (d: DatasetRecord) => {
    if (!confirm(`Delete "${d.name}"?`)) return;
    remove(d.id);
    if (preview?.id === d.id) setPreview(null);
    toast.success(`Deleted ${d.name}`);
  };

  const kinds: (DatasetKind | "all")[] = ["all", "csv", "jsonl", "json", "markdown", "parquet"];

  return (
    <>
      <PageHeader
        title="Datasets"
        subtitle="Upload, preview, and manage training, eval, and red-team corpora"
        actions={
          <>
            <input
              ref={inputRef} type="file" multiple hidden
              accept=".csv,.json,.jsonl,.ndjson,.md,.markdown,.parquet"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <button
              onClick={() => inputRef.current?.click()} disabled={busy}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload"}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard index={0} label="Datasets" value={totals.files} trend={0} series={[totals.files]} />
        <MetricCard index={1} label="Total rows" value={totals.rows} display={(v) => Math.round(v).toLocaleString()} trend={0} series={[totals.rows]} />
        <MetricCard index={2} label="Total size" value={totals.bytes} display={(v) => formatBytes(v)} trend={0} series={[totals.bytes]} />
        <MetricCard index={3} label="Your uploads" value={totals.uploads} trend={totals.uploads > 0 ? totals.uploads : 0} series={[totals.uploads]} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`mt-8 rounded-[10px] border border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-[var(--accent)] bg-[var(--accent-muted)]" : "border-[var(--border-default)] bg-[var(--bg-surface)]"
        }`}
      >
        <div className="grid h-10 w-10 place-items-center mx-auto rounded-md bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
          <Upload className="h-4 w-4" />
        </div>
        <div className="mt-3 text-[13px] text-[var(--text-primary)]">Drop CSV, JSON, JSONL, or Markdown files here</div>
        <div className="mt-1 text-[11px] text-[var(--text-muted)]">Parsed locally — first {50} rows kept as preview. Max 2 MB parsed inline.</div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-[380px]">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search datasets…"
            className="w-full h-9 pl-8 pr-3 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[13px] outline-none focus:border-[var(--accent-border)]"
          />
        </div>
        <div className="flex items-center gap-1">
          {kinds.map((k) => (
            <button key={k} onClick={() => setKindFilter(k)}
              className={`h-7 px-2.5 rounded-md text-[11px] font-mono-tabular capitalize transition-colors ${
                kindFilter === k
                  ? "bg-[var(--accent)] text-[var(--bg-base)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              }`}>{k}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_120px_110px_130px_88px] gap-4 px-5 py-2.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-elevated)]/60 border-b border-[var(--border-subtle)]">
          <span>Name</span><span>Type</span><span className="text-right">Rows</span><span className="text-right">Size</span><span className="text-right">Added</span><span className="text-right">Actions</span>
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-[var(--text-muted)]">
            <Database className="h-5 w-5 mx-auto mb-2 opacity-60" />
            No datasets match your filters.
          </div>
        ) : filtered.map((d, i) => {
          const Icon = kindIcon(d.kind);
          const color = kindColor[d.kind];
          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="grid grid-cols-[1fr_100px_120px_110px_130px_88px] gap-4 px-5 py-3 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)]/50 group"
            >
              <button className="flex items-center gap-2.5 text-left min-w-0" onClick={() => setPreview(d)}>
                <div className="grid h-7 w-7 place-items-center rounded-md shrink-0"
                  style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono-tabular text-[13px] truncate">{d.name}</div>
                  {d.source === "upload" && (
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {d.columns.length > 0 ? `${d.columns.length} cols` : "metadata only"}
                    </div>
                  )}
                </div>
              </button>
              <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-[var(--accent-muted)] text-[var(--text-accent)] self-center w-fit uppercase font-mono-tabular">{d.kind}</span>
              <span className="font-mono-tabular text-[12px] text-right self-center">{d.rows.toLocaleString()}</span>
              <span className="font-mono-tabular text-[12px] text-right self-center text-[var(--text-secondary)]">{formatBytes(d.sizeBytes)}</span>
              <span className="font-mono-tabular text-[12px] text-right self-center text-[var(--text-muted)]">{relTime(d.createdAt)}</span>
              <div className="flex items-center justify-end gap-1 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setPreview(d)} aria-label="Preview"
                  className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]">
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onDelete(d)} aria-label="Delete"
                  className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.32, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[85vh] rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-surface)] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
                <div className="min-w-0">
                  <div className="font-mono-tabular text-[14px] truncate">{preview.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular mt-0.5">
                    {preview.rows.toLocaleString()} rows · {formatBytes(preview.sizeBytes)} · {preview.kind}
                    {preview.truncated && preview.preview.length > 0 && ` · preview of first ${preview.preview.length}`}
                  </div>
                </div>
                <button onClick={() => setPreview(null)} className="p-1.5 rounded hover:bg-[var(--bg-elevated)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {preview.preview.length === 0 ? (
                  <div className="text-center py-16 text-[13px] text-[var(--text-muted)]">
                    {preview.kind === "parquet" ? "Parquet is stored as metadata only." : "No preview rows available."}
                  </div>
                ) : (
                  <SectionHeader title={`Preview · ${preview.columns.length} columns`} />
                )}
                {preview.preview.length > 0 && (
                  <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
                    <table className="w-full text-[12px] font-mono-tabular">
                      <thead className="bg-[var(--bg-elevated)]/60 text-[var(--text-muted)] uppercase text-[10px] tracking-wider">
                        <tr>
                          {preview.columns.map((c) => (
                            <th key={c} className="px-3 py-2 text-left font-normal whitespace-nowrap">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((row, i) => (
                          <tr key={i} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/40">
                            {preview.columns.map((c) => (
                              <td key={c} className="px-3 py-2 align-top text-[var(--text-secondary)] max-w-[280px] truncate" title={row[c]}>{row[c] || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export const Route = createFileRoute("/_authenticated/datasets")({
  head: () => ({ meta: [{ title: "Datasets — Harness" }] }),
  component: DatasetsView,
});
