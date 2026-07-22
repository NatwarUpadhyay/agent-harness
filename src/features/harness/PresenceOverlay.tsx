import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MousePointer2 } from "lucide-react";

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  x: number; // 0..1 relative
  y: number; // 0..1 relative
  label?: string;
  active: boolean;
}

const SEED: Omit<Collaborator, "x" | "y" | "active">[] = [
  { id: "ap", name: "Ada Patel",      color: "#8B5CF6", label: "editing Planner" },
  { id: "jr", name: "Jordan Reyes",   color: "#14B8A6", label: "reviewing edges" },
  { id: "sm", name: "Sana Mori",      color: "#F59E0B", label: "adding Retriever" },
  { id: "kt", name: "Kai Tanaka",     color: "#22C55E", label: "watching sim" },
];

function rand(min: number, max: number) { return min + Math.random() * (max - min); }

function newPeers(): Collaborator[] {
  return SEED.map((p) => ({ ...p, x: rand(0.1, 0.9), y: rand(0.12, 0.86), active: true }));
}

export function usePresence(enabled: boolean) {
  const [peers, setPeers] = useState<Collaborator[]>(() => newPeers());

  useEffect(() => {
    if (!enabled) return;
    // One state update every ~3s; framer-motion tweens between targets on the GPU.
    const t = window.setInterval(() => setPeers(newPeers()), 3000);
    return () => window.clearInterval(t);
  }, [enabled]);

  return peers;
}

export function PresenceCursors({ peers }: { peers: Collaborator[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      <AnimatePresence>
        {peers.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0.6, left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            animate={{ opacity: 1, scale: 1, left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ left: { duration: 2.8, ease: "easeInOut" }, top: { duration: 2.8, ease: "easeInOut" }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}
            className="absolute -translate-x-1 -translate-y-1"
          >
            <MousePointer2 className="h-4 w-4" style={{ color: p.color, fill: p.color }} />
            <div
              className="mt-1 ml-3 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium whitespace-nowrap text-white shadow"
              style={{ background: p.color }}
            >
              {p.name}
              {p.label && (
                <span className="ml-1 opacity-80 font-normal">· {p.label}</span>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function PresenceAvatars({
  peers, enabled, onToggle,
}: { peers: Collaborator[]; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] hover:bg-white/5"
        title={enabled ? "Disable live cursors" : "Enable live cursors"}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-[#22C55E] animate-pulse" : "bg-[var(--text-muted)]"}`} />
        {enabled ? "Live" : "Solo"}
      </button>
      {enabled && (
        <div className="flex -space-x-1.5">
          {peers.map((p) => (
            <div
              key={p.id}
              title={`${p.name}${p.label ? " — " + p.label : ""}`}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border border-[var(--bg-surface)]"
              style={{ background: p.color }}
            >
              {p.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
