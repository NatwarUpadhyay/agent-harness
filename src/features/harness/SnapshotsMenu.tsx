import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, RotateCcw, Trash2 } from "lucide-react";
import type { Node, Edge } from "reactflow";
import { toast } from "sonner";

interface Snapshot {
  id: string;
  label: string;
  ts: number;
  nodeCount: number;
  edgeCount: number;
  nodes: Node[];
  edges: Edge[];
}

const STORAGE_KEY = "harness.snapshots.v1";
const MAX_PER_KEY = 12;

type Store = Record<string, Snapshot[]>;

function readStore(): Store {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(s: Store) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function keyFor(workflowId: string | null, workflowName: string) {
  return workflowId ?? `unsaved::${workflowName}`;
}

function ago(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function SnapshotsMenu({
  workflowId, workflowName, nodes, edges, onRestore,
}: {
  workflowId: string | null;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
  onRestore: (nodes: Node[], edges: Edge[], label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const btnRef = useRef<HTMLDivElement>(null);
  const key = keyFor(workflowId, workflowName);

  useEffect(() => {
    setSnaps(readStore()[key] ?? []);
  }, [key, open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as globalThis.Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const take = useCallback(() => {
    if (nodes.length === 0) { toast.error("Nothing to snapshot"); return; }
    const store = readStore();
    const list = store[key] ?? [];
    const snap: Snapshot = {
      id: `s${Math.random().toString(36).slice(2, 9)}`,
      label: `${workflowName} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      ts: Date.now(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    const next = [snap, ...list].slice(0, MAX_PER_KEY);
    store[key] = next;
    writeStore(store);
    setSnaps(next);
    toast.success("Snapshot saved");
  }, [nodes, edges, key, workflowName]);

  const restore = useCallback((s: Snapshot) => {
    onRestore(s.nodes, s.edges, s.label);
    setOpen(false);
  }, [onRestore]);

  const remove = useCallback((id: string) => {
    const store = readStore();
    const next = (store[key] ?? []).filter((s) => s.id !== id);
    store[key] = next;
    writeStore(store);
    setSnaps(next);
  }, [key]);

  return (
    <div ref={btnRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
        title="Canvas snapshots"
      >
        <Camera className="h-3.5 w-3.5" /> Snapshots
        {snaps.length > 0 && (
          <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-white/10 text-[10px] font-mono-tabular text-[var(--text-primary)] inline-flex items-center justify-center">
            {snaps.length}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-10 right-0 w-72 max-h-96 flex flex-col rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg z-20"
          >
            <div className="p-2 border-b border-[var(--border-default)] flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Snapshots</span>
              <button
                onClick={take}
                className="inline-flex items-center gap-1 h-7 px-2 rounded bg-[var(--accent)] text-[var(--bg-base)] text-[11px] font-medium hover:bg-[var(--accent-hover)]"
              >
                <Camera className="h-3 w-3" /> Take
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {snaps.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px] text-[var(--text-muted)] leading-relaxed">
                  No snapshots for this workflow.<br />
                  <span className="text-[10px]">Take one before risky edits — restore instantly.</span>
                </div>
              ) : (
                snaps.map((s) => (
                  <div key={s.id} className="group flex items-center gap-1 pr-1 hover:bg-white/5">
                    <button
                      onClick={() => restore(s)}
                      className="flex-1 flex flex-col items-start gap-0.5 py-2 pl-3 pr-1 text-left min-w-0"
                    >
                      <span className="text-[12px] text-[var(--text-primary)] truncate w-full">{s.label}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono-tabular">
                        {s.nodeCount} nodes · {s.edgeCount} edges · {ago(s.ts)}
                      </span>
                    </button>
                    <button
                      onClick={() => restore(s)}
                      title="Restore"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)]"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      title="Delete snapshot"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-muted)] hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
            {snaps.length > 0 && (
              <div className="px-3 py-1.5 border-t border-[var(--border-default)] text-[10px] text-[var(--text-muted)]">
                Local to this browser · max {MAX_PER_KEY} per workflow
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
