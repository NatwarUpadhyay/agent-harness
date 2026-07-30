import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { InlineBarStat } from "@/components/ui/inline-bar-stat";
import { Wrench, Search, Database, ArrowLeftRight, Trash2, Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { useTools, useDeleteTool, useCreateTool, useToggleTool, type ToolRow } from "@/lib/hooks/use-entities";
import { toast } from "sonner";

const CATEGORIES = ["retrieval", "execution", "memory", "io"] as const;
type Category = (typeof CATEGORIES)[number];

const iconFor = (cat: string) =>
  cat === "retrieval" ? Search : cat === "memory" ? Database : cat === "io" ? ArrowLeftRight : Wrench;

const catColor: Record<string, string> = {
  retrieval: "var(--accent)", execution: "var(--amber)", memory: "var(--violet)", io: "var(--teal)",
};

function ToolCard({ tool, index }: { tool: ToolRow; index: number }) {
  const del = useDeleteTool();
  const toggle = useToggleTool();
  const Icon = iconFor(tool.category);
  const color = catColor[tool.category] ?? catColor.execution;
  const remove = async () => {
    if (!confirm(`Remove tool "${tool.name}"?`)) return;
    try {
      await del.mutateAsync(tool.id);
      toast.success(`Tool “${tool.name}” removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };
  const flip = async () => {
    const next = !tool.enabled;
    try {
      await toggle.mutateAsync({ id: tool.id, enabled: next });
      toast.success(`${tool.name} ${next ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`group relative rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)] ${tool.enabled ? "" : "opacity-60"}`}
    >
      <button
        onClick={remove} aria-label="Remove tool"
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-center gap-2 pr-6">
        <div className="grid h-8 w-8 place-items-center rounded-md"
          style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="font-semibold text-[14px]">{tool.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{tool.category}</div>
        </div>
      </div>
      <div className="mt-3 text-[11px] text-[var(--text-muted)] font-mono-tabular">
        {Number(tool.call_count).toLocaleString()} calls
      </div>
      <div className="mt-2"><InlineBarStat label="Success" value={Number(tool.success_rate)} /></div>
      <button
        onClick={flip}
        aria-label={tool.enabled ? "Disable tool" : "Enable tool"}
        className="mt-3 inline-flex items-center gap-2 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <span className={`h-4 w-7 rounded-full transition-colors relative ${tool.enabled ? "bg-[var(--accent)]" : "bg-[var(--bg-elevated)]"}`}>
          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-[var(--bg-base)] transition-all ${tool.enabled ? "left-3.5" : "left-0.5"}`} />
        </span>
        {tool.enabled ? "Enabled" : "Disabled"}
      </button>
    </motion.div>
  );
}

function ToolsView() {
  const { data: tools = [], isLoading } = useTools();
  const create = useCreateTool();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"all" | Category>("all");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [newCat, setNewCat] = useState<Category>("execution");

  const filtered = useMemo(
    () => tools.filter((t) =>
      (cat === "all" || t.category === cat) &&
      t.name.toLowerCase().includes(query.trim().toLowerCase())),
    [tools, cat, query],
  );

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Give the tool a name"); return; }
    try {
      await create.mutateAsync({
        name: trimmed, category: newCat, call_count: 0, success_rate: 100, enabled: true,
      });
      toast.success(`Tool “${trimmed}” registered`);
      setName(""); setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not register tool");
    }
  };

  return (
    <>
      <PageHeader
        title="Tools"
        subtitle={`${tools.length} capabilities registered · ${tools.filter(t => t.enabled).length} enabled`}
        actions={
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)]"
          >
            {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {open ? "Cancel" : "Register tool"}
          </button>
        }
      />

      {open && (
        <div className="mb-4 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row gap-2">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Tool name, e.g. vector_search"
            className="flex-1 h-9 px-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px] outline-none focus:border-[var(--border-strong)]"
          />
          <select
            value={newCat} onChange={(e) => setNewCat(e.target.value as Category)}
            className="h-9 px-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[13px]"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={submit} disabled={create.isPending}
            className="h-9 px-4 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {create.isPending ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[13px] outline-none focus:border-[var(--border-strong)]"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(["all", ...CATEGORIES] as const).map((c) => (
            <button
              key={c} onClick={() => setCat(c)}
              className={`h-9 px-3 rounded-md text-[12px] capitalize border ${cat === c ? "border-[var(--border-strong)] text-[var(--text-primary)] bg-[var(--bg-elevated)]" : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-[13px] text-[var(--text-muted)]">Loading tools…</div>
      ) : filtered.length === 0 ? (
        <div className="text-[13px] text-[var(--text-muted)]">No tools match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((t, i) => <ToolCard key={t.id} tool={t} index={i} />)}
        </div>
      )}
    </>
  );
}

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({
    meta: [
      { title: "Tools — Harness" },
      { name: "description", content: "Register, enable, and monitor the tool capabilities available to your agent fleet." },
      { property: "og:title", content: "Tools — Harness" },
      { property: "og:description", content: "Register, enable, and monitor agent tool capabilities." },
    ],
  }),
  component: ToolsView,
});
