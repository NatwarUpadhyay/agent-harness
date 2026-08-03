import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const createAgent = vi.fn().mockResolvedValue({ id: "a3", name: "Gamma" });
const deleteAgent = vi.fn().mockResolvedValue(undefined);

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => ({ ...config }),
}));

vi.mock("@/lib/hooks/use-entities", () => ({
  useAgents: () => ({
    data: [
      { id: "a1", name: "Alpha", model: "gpt-4o", status: "active", success_rate: 91, total_calls: 120, avg_latency: 220, last_active: "1m ago" },
      { id: "a2", name: "Beta", model: "claude-3-5-sonnet", status: "idle", success_rate: 84, total_calls: 60, avg_latency: 330, last_active: "5m ago" },
    ],
    isLoading: false,
  }),
  useCreateAgent: () => ({ mutateAsync: createAgent, isPending: false }),
  useDeleteAgent: () => ({ mutateAsync: deleteAgent, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { Route } from "../../routes/_authenticated/agents";

describe("Agents route", () => {
  beforeEach(() => {
    createAgent.mockClear();
    deleteAgent.mockClear();
  });

  it("deploys an agent and filters the list", async () => {
    const user = userEvent.setup();
    render(<Route.component />);

    await user.click(screen.getByRole("button", { name: /Deploy agent/i }));
    await user.type(screen.getByPlaceholderText(/e\.g\. Vega-2/i), "Gamma");
    await user.click(screen.getByRole("button", { name: /^Deploy$/i }));

    expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({ name: "Gamma" }));

    await user.click(screen.getByRole("button", { name: /^idle$/i }));
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("removes an agent", async () => {
    const user = userEvent.setup();
    render(<Route.component />);

    await user.click(screen.getAllByLabelText(/Remove agent/i)[0]);

    expect(deleteAgent).toHaveBeenCalledWith("a1");
  });
});