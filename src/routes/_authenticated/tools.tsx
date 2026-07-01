import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { InlineBarStat } from "@/components/ui/inline-bar-stat";
import { Wrench, Search, Database, ArrowLeftRight, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useTools, useDeleteTool, type ToolRow } from "@/lib/hooks/use-entities";
import { toast } from "sonner";

const iconFor = (cat: string) =>
  cat === "retrieval" ? Search : cat === "memory" ? Database : cat === "io" ? ArrowLeftRight : Wrench;

const catColor: Record<string, string> = {
  retrieval: "var(--accent)", execution: "var(--amber)", memory: "var(--violet)", io: "var(--teal)",
};

function ToolCard({ tool, index }: { tool: ToolRow; index: number }) {
  const del = useDeleteTool();
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="group relative rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-strong)]"
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
    </motion.div>
  );
}

function ToolsView() {
  const { data: tools = [], isLoading } = useTools();
  return (
    <>
      <PageHeader
        title="Tools"
        subtitle={`${tools.length} capabilities registered · ${tools.filter(t => t.enabled).length} enabled`}
      />
      {isLoading ? (
        <div className="text-[13px] text-[var(--text-muted)]">Loading tools…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tools.map((t, i) => <ToolCard key={t.id} tool={t} index={i} />)}
        </div>
      )}
    </>
  );
}

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({ meta: [{ title: "Tools — Harness" }] }),
  component: ToolsView,
});
