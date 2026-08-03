import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { HarnessCanvas } from "./HarnessCanvas";

vi.useFakeTimers();

vi.mock("reactflow", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  default: ({ nodes, onNodeClick, onPaneClick, children }: any) => (
    <div data-testid="react-flow">
      <button type="button" onClick={() => onPaneClick?.()}>Canvas backdrop</button>
      {nodes.map((node: any) => (
        <button
          key={node.id}
          type="button"
          onClick={(event) => onNodeClick?.(event, node)}
        >
          {node.data.label}
        </button>
      ))}
      {children}
    </div>
  ),
  ReactFlow: ({ nodes, onNodeClick, onPaneClick, children }: any) => (
    <div data-testid="react-flow">
      <button type="button" onClick={() => onPaneClick?.()}>Canvas backdrop</button>
      {nodes.map((node: any) => (
        <button
          key={node.id}
          type="button"
          onClick={(event) => onNodeClick?.(event, node)}
        >
          {node.data.label}
        </button>
      ))}
      {children}
    </div>
  ),
  useNodesState: (initial: any[]) => React.useState(() => initial),
  useEdgesState: (initial: any[]) => React.useState(() => initial),
  useReactFlow: () => ({
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
  addEdge: (edge: unknown, edges: unknown[]) => [...edges, edge],
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
  Background: () => null,
  BackgroundVariant: { Dots: "Dots" },
  Controls: () => null,
  MiniMap: () => null,
}));

vi.mock("@/lib/hooks/use-entities", () => ({
  useWorkflows: () => ({ data: [] }),
  useSaveWorkflow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteWorkflow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDuplicateWorkflow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRenameWorkflow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useToggleWorkflowFavorite: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useToggleWorkflowPublic: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("./PresenceOverlay", () => ({
  usePresence: () => [],
  PresenceAvatars: ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle}>{enabled ? "Live" : "Solo"}</button>
  ),
  PresenceCursors: () => null,
}));

vi.mock("./PresenceActivity", () => ({
  useActivityStream: () => [],
  ActivityFeed: () => null,
}));

vi.mock("./CoEditing", () => ({
  useCoEditing: () => new Map(),
}));

vi.mock("./SnapshotsMenu", () => ({
  SnapshotsMenu: () => <button type="button">Snapshots</button>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("HarnessCanvas", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-08-03T12:00:00Z"));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("loads a template and records a simulated run", async () => {
    render(<HarnessCanvas />);

    fireEvent.click(screen.getByRole("button", { name: /Templates/i }));
    fireEvent.click(screen.getByRole("button", { name: /RAG Pipeline/i }));

    expect(screen.getAllByText("RAG Pipeline").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Simulate/i }));
    await vi.runAllTimersAsync();

    expect(screen.getByText(/1 runs/)).toBeInTheDocument();
  });
});