import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Plus, Link2, Trash2, MessageSquare, Pencil } from "lucide-react";
import type { Collaborator } from "./PresenceOverlay";

type EventKind = "add" | "connect" | "delete" | "edit" | "comment";

export interface ActivityEvent {
  id: string;
  peer: Pick<Collaborator, "id" | "name" | "color">;
  kind: EventKind;
  target: string;
  at: number;
}

const KIND_MAP: Record<EventKind, { icon: typeof Plus; verb: string }> = {
  add:     { icon: Plus,          verb: "added" },
  connect: { icon: Link2,         verb: "connected" },
  delete:  { icon: Trash2,        verb: "removed" },
  edit:    { icon: Pencil,        verb: "edited" },
  comment: { icon: MessageSquare, verb: "commented on" },
};

const TARGETS = [
  "Planner node", "Retriever node", "Memory node", "Guardrail",
  "Tool: web_search", "Tool: sql_query", "Agent: Analyst", "Agent: Reviewer",
  "edge planner→retriever", "edge memory→agent", "output sink",
];

const KINDS: EventKind[] = ["add", "connect", "edit", "comment", "delete"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function useActivityStream(peers: Collaborator[], enabled: boolean, max = 12) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (!enabled || peers.length === 0) return;
    let cancelled = false;

    const push = () => {
      if (cancelled) return;
      const peer = pick(peers);
      const kind = pick(KINDS);
      const ev: ActivityEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        peer: { id: peer.id, name: peer.name, color: peer.color },
        kind,
        target: pick(TARGETS),
        at: Date.now(),
      };
      setEvents((prev) => [ev, ...prev].slice(0, max));
    };

    // Seed one event immediately so the feed isn't empty when opened.
    push();
    const t = window.setInterval(push, 2600 + Math.random() * 1400);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [enabled, peers, max]);

  useEffect(() => {
    if (!enabled) setEvents([]);
  }, [enabled]);

  return events;
}

function timeAgo(ms: number) {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return `${m}m`;
}

export function ActivityFeed({
  events,
  open,
  onClose,
}: {
  events: ActivityEvent[];
  open: boolean;
  onClose: () => void;
}) {
  // Force periodic re-render so timeAgo() ticks.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.32, 1] }}
          className="absolute top-16 right-4 z-20 w-[280px] rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)]/95 backdrop-blur shadow-xl"
        >
          <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--border-subtle)]">
            <div className="inline-flex items-center gap-1.5 text-[12px] font-medium">
              <GitBranch className="h-3.5 w-3.5 text-[var(--accent)]" />
              Live activity
            </div>
            <button
              onClick={onClose}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Close
            </button>
          </div>
          <div className="max-h-[320px] overflow-y-auto py-1">
            {events.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-[var(--text-muted)]">
                Waiting for peers…
              </div>
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {events.map((ev) => {
                    const Icon = KIND_MAP[ev.kind].icon;
                    return (
                      <motion.li
                        key={ev.id}
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-start gap-2 px-3 py-2 hover:bg-white/5"
                      >
                        <div
                          className="mt-0.5 h-5 w-5 shrink-0 rounded-full grid place-items-center text-[9px] font-semibold text-white"
                          style={{ background: ev.peer.color }}
                          title={ev.peer.name}
                        >
                          {ev.peer.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] leading-snug">
                            <span className="font-medium">{ev.peer.name}</span>{" "}
                            <span className="text-[var(--text-secondary)]">
                              {KIND_MAP[ev.kind].verb}
                            </span>{" "}
                            <span className="font-mono-tabular text-[var(--text-primary)]">
                              {ev.target}
                            </span>
                          </div>
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                            <Icon className="h-3 w-3" />
                            {timeAgo(ev.at)} ago
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
