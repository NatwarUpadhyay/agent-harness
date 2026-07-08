import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Play, Save, Trash2, History, X, Copy, Check } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  usePromptLibrary, extractVariables, renderPrompt,
  type PromptRecord,
} from "@/lib/data/prompts-store";
import { estimateNodeCost, recordRun, formatCost } from "@/lib/data/harness-usage";
import { toast } from "sonner";

const CATEGORIES = ["sales", "support", "research", "safety", "planner", "tools", "eval"];

function PromptsView() {
  const { prompts, create, saveNewVersion, remove } = usePromptLibrary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [creating, setCreating] = useState(false);

  // Editor buffer
  const [body, setBody] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(
    () => prompts.find((p) => p.id === selectedId) ?? null,
    [prompts, selectedId],
  );

  // Auto-select first prompt after mount
  useEffect(() => {
    if (!selectedId && prompts.length) setSelectedId(prompts[0].id);
  }, [prompts, selectedId]);

  // Load selected prompt into editor
  useEffect(() => {
    if (!selected) { setBody(""); setVars({}); setOutput(null); setDirty(false); return; }
    const current = selected.versions[selected.versions.length - 1];
    setBody(current.body);
    setOutput(null);
    setDirty(false);
    setShowHistory(false);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const variables = useMemo(() => extractVariables(body), [body]);
  useEffect(() => {
    setVars((prev) => {
      const next: Record<string, string> = {};
      variables.forEach((v) => { next[v] = prev[v] ?? ""; });
      return next;
    });
  }, [variables.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [prompts, query, category]);

  const rendered = useMemo(() => renderPrompt(body, vars), [body, vars]);
  const missing = variables.filter((v) => !vars[v]?.trim());

  async function handleRun() {
    if (!selected || missing.length) return;
    setRunning(true);
    setOutput(null);

    // Simulate LLM latency proportional to prompt length
    const latency = 350 + Math.min(1400, rendered.length * 2);
    await new Promise((r) => setTimeout(r, latency));

    // Deterministic-ish canned output shaped to the prompt
    const preview = rendered.split("\n").filter(Boolean).slice(-3).join(" · ");
    const answer = [
      `Draft response for ${selected.name}`,
      "-----",
      "1. " + (variables[0] ? `Focus on ${vars[variables[0]] ?? "the topic"} first.` : "Restate the ask succinctly."),
      "2. Surface constraints the user hasn't yet named.",
      "3. Propose one concrete next step and a fallback.",
      "",
      `Context echo: ${preview.slice(0, 160)}${preview.length > 160 ? "…" : ""}`,
    ].join("\n");
    setOutput(answer);

    // Record cost into the harness usage tracker so the analytics widget picks it up
    const { tokens, cost } = estimateNodeCost("Planner", latency);
    recordRun({
      workflowName: `prompt: ${selected.name}`,
      totalLatencyMs: latency,
      totalTokens: tokens,
      totalCost: cost,
      nodeCount: 1,
      edgeCount: 0,
      perNode: [{ typeName: "Planner", latencyMs: latency, tokens, cost }],
    });
    toast.success(`Run complete · ${formatCost(cost)} · ${tokens.toLocaleString()} tok`);
    setRunning(false);
  }

  function handleSave() {
    if (!selected || !dirty) return;
    saveNewVersion(selected.id, body);
    setDirty(false);
    toast.success("New version saved");
  }

  function handleDelete() {
    if (!selected) return;
    if (!confirm(`Delete ${selected.name}?`)) return;
    remove(selected.id);
    setSelectedId(null);
    toast.success("Prompt deleted");
  }

  function handleCopy() {
    navigator.clipboard.writeText(rendered).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <>
      <PageHeader
        title="Prompt library"
        subtitle="Versioned prompts with variables and an inline test playground — every run bills into your harness usage"
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New prompt
          </button>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        {/* LIST */}
        <div className="col-span-4 xl:col-span-3">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts"
              className="pl-8 h-8 text-[13px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1 mb-3">
            {["All", ...CATEGORIES].map((t) => (
              <button
                key={t}
                onClick={() => setCategory(t)}
                className={cn(
                  "h-6 px-2 rounded-full text-[11px] border transition-colors",
                  category === t
                    ? "bg-[var(--accent-muted)] border-[var(--accent-border)] text-[var(--text-accent)]"
                    : "border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="space-y-1 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {filtered.map((p) => {
              const current = p.versions[p.versions.length - 1];
              const active = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md border transition-colors",
                    active
                      ? "bg-[var(--accent-muted)] border-[var(--accent-border)]"
                      : "border-[var(--border-default)] hover:bg-[var(--bg-hover)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-[12px] text-[var(--text-primary)] truncate">{p.name}</span>
                    <span className="font-mono-tabular text-[10px] text-[var(--text-muted)] shrink-0">{current.version}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--bg-elevated)] text-[var(--text-muted)] capitalize">{p.category}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{p.versions.length} version{p.versions.length !== 1 ? "s" : ""}</span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-[12px] text-[var(--text-muted)]">No prompts match</div>
            )}
          </div>
        </div>

        {/* EDITOR */}
        <div className="col-span-8 xl:col-span-9">
          {!selected ? (
            <div className="border border-[var(--border-default)] rounded-lg p-12 text-center text-[13px] text-[var(--text-muted)]">
              Select a prompt or create a new one to start editing.
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-7">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-mono-tabular text-[13px] text-[var(--text-primary)]">{selected.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {selected.versions[selected.versions.length - 1].version} · updated {new Date(selected.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
                      <History className="h-3.5 w-3.5 mr-1" /> {selected.versions.length}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDelete} className="text-[var(--text-muted)] hover:text-[var(--text-danger)]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <textarea
                  value={body}
                  onChange={(e) => { setBody(e.target.value); setDirty(true); }}
                  spellCheck={false}
                  className="w-full h-[380px] bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md p-3 font-mono-tabular text-[12.5px] leading-relaxed text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent-border)]"
                  placeholder="Write your prompt. Use {{variable}} placeholders."
                />

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {body.length.toLocaleString()} chars · {variables.length} variable{variables.length !== 1 ? "s" : ""}
                  </div>
                  <Button size="sm" onClick={handleSave} disabled={!dirty}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Save version
                  </Button>
                </div>

                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 border border-[var(--border-default)] rounded-md overflow-hidden"
                    >
                      <div className="px-3 py-2 border-b border-[var(--border-default)] flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Version history</span>
                        <button onClick={() => setShowHistory(false)}><X className="h-3.5 w-3.5 text-[var(--text-muted)]" /></button>
                      </div>
                      <div className="max-h-52 overflow-y-auto divide-y divide-[var(--border-default)]">
                        {[...selected.versions].reverse().map((v) => (
                          <button
                            key={v.version}
                            onClick={() => { setBody(v.body); setDirty(true); }}
                            className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono-tabular text-[12px]">{v.version}</span>
                              <span className="text-[10px] text-[var(--text-muted)]">{new Date(v.createdAt).toLocaleString()}</span>
                            </div>
                            {v.note && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{v.note}</div>}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* PLAYGROUND */}
              <div className="col-span-5">
                <SectionHeader title="Playground" />
                <div className="space-y-2 mb-3">
                  {variables.length === 0 && (
                    <div className="text-[11px] text-[var(--text-muted)]">No variables — add {"{{name}}"} placeholders to parametrise this prompt.</div>
                  )}
                  {variables.map((v) => (
                    <div key={v}>
                      <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-0.5">{v}</label>
                      <Input
                        value={vars[v] ?? ""}
                        onChange={(e) => setVars((prev) => ({ ...prev, [v]: e.target.value }))}
                        placeholder={`value for ${v}`}
                        className="h-8 text-[12px]"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Button
                    size="sm"
                    onClick={handleRun}
                    disabled={running || missing.length > 0}
                    className="flex-1"
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    {running ? "Running…" : missing.length ? `Fill ${missing.length} var${missing.length !== 1 ? "s" : ""}` : "Run"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCopy} title="Copy rendered prompt">
                    {copied ? <Check className="h-3.5 w-3.5 text-[var(--text-success)]" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Output</div>
                  <div className="border border-[var(--border-default)] bg-[var(--bg-elevated)] rounded-md p-3 min-h-[180px] text-[12px] font-mono-tabular whitespace-pre-wrap text-[var(--text-primary)]">
                    {running ? (
                      <span className="text-[var(--text-muted)]">Simulating model call…</span>
                    ) : output ? (
                      output
                    ) : (
                      <span className="text-[var(--text-muted)]">Run the prompt to see a mock completion. Cost is recorded to the harness usage widget.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewPromptModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(input) => {
          const rec = create(input);
          setSelectedId(rec.id);
          setCreating(false);
          toast.success("Prompt created");
        }}
      />
    </>
  );
}

function NewPromptModal({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; category: string; body: string }) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) { setName(""); setCategory(CATEGORIES[0]); setBody(""); }
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-[520px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold mb-4">New prompt</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. sales/objection-handler" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-9 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 text-[13px]"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Use {{variable}} placeholders"
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md p-2 font-mono-tabular text-[12.5px] focus:outline-none focus:border-[var(--accent-border)]"
            />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!name.trim() || !body.trim()}
            onClick={() => onCreate({ name: name.trim(), category, body: body.trim() })}
          >
            Create
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/prompts")({
  head: () => ({ meta: [{ title: "Prompt library — Harness" }] }),
  component: PromptsView,
});
