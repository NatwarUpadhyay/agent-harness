import { useEffect, useState } from "react";
import type { Collaborator } from "./PresenceOverlay";

export interface CoEditLock {
  peer: Pick<Collaborator, "id" | "name" | "color">;
  kind: "editing" | "dragging";
  since: number;
}

/**
 * Simulated real-time collaborative node editing.
 * Every ~2.5s a random peer "locks" a random node for editing/dragging
 * for a few seconds. Returns a map of nodeId -> lock.
 */
export function useCoEditing(
  peers: Collaborator[],
  nodeIds: string[],
  enabled: boolean,
): Map<string, CoEditLock> {
  const [locks, setLocks] = useState<Map<string, CoEditLock>>(new Map());

  useEffect(() => {
    if (!enabled || peers.length === 0 || nodeIds.length === 0) {
      setLocks(new Map());
      return;
    }
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      setLocks((prev) => {
        const next = new Map(prev);
        // Expire locks older than 4s
        const now = Date.now();
        for (const [k, v] of next) if (now - v.since > 4000) next.delete(k);
        // Purge locks for peers that dropped off
        for (const [k, v] of next) if (!peers.some((p) => p.id === v.peer.id)) next.delete(k);

        // Occasionally add a new lock
        if (Math.random() < 0.85) {
          const peer = peers[Math.floor(Math.random() * peers.length)];
          const nodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
          // Don't double-lock
          if (!next.has(nodeId) && ![...next.values()].some((l) => l.peer.id === peer.id)) {
            next.set(nodeId, {
              peer: { id: peer.id, name: peer.name, color: peer.color },
              kind: Math.random() < 0.5 ? "editing" : "dragging",
              since: now,
            });
          }
        }
        return next;
      });
    };

    tick();
    const t = window.setInterval(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [peers, nodeIds, enabled]);

  useEffect(() => {
    if (!enabled) setLocks(new Map());
  }, [enabled]);

  return locks;
}
