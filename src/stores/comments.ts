import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NodeComment {
  id: string;
  nodeId: string;
  author: string;
  authorColor: string;
  body: string;
  createdAt: number;
  resolved: boolean;
}

interface CommentsState {
  comments: NodeComment[];
  add: (c: Omit<NodeComment, "id" | "createdAt" | "resolved">) => void;
  toggleResolved: (id: string) => void;
  remove: (id: string) => void;
  clearForNode: (nodeId: string) => void;
  countFor: (nodeId: string) => { total: number; open: number };
}

export const useCommentsStore = create<CommentsState>()(
  persist(
    (set, get) => ({
      comments: [],
      add: (c) =>
        set((s) => ({
          comments: [
            ...s.comments,
            {
              ...c,
              id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
              createdAt: Date.now(),
              resolved: false,
            },
          ],
        })),
      toggleResolved: (id) =>
        set((s) => ({
          comments: s.comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c)),
        })),
      remove: (id) => set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),
      clearForNode: (nodeId) =>
        set((s) => ({ comments: s.comments.filter((c) => c.nodeId !== nodeId) })),
      countFor: (nodeId) => {
        const list = get().comments.filter((c) => c.nodeId === nodeId);
        return { total: list.length, open: list.filter((c) => !c.resolved).length };
      },
    }),
    { name: "harness-node-comments" },
  ),
);
