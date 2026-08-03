import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DashboardView } from "./DashboardView";

const mockAgents = [
  { id: "a1", name: "Alpha", model: "gpt-4o", status: "active", successRate: 96, totalCalls: 120, avgLatency: 210, lastActive: "1m ago" },
  { id: "a2", name: "Beta", model: "claude-3-5-sonnet", status: "idle", successRate: 88, totalCalls: 87, avgLatency: 360, lastActive: "5m ago" },
];

vi.mock("@/lib/hooks/use-entities", () => ({
  useAgents: () => ({ data: mockAgents }),
}));

vi.mock("@/components/ui/metric-card", () => ({
  MetricCard: ({ label, value }: { label: string; value: number }) => (
    <div data-testid={`metric-${label}`}>{label}: {value}</div>
  ),
}));

vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    AreaChart: passthrough,
    PieChart: passthrough,
    BarChart: passthrough,
    Area: passthrough,
    Pie: passthrough,
    Bar: passthrough,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    CartesianGrid: () => null,
    Legend: () => null,
  };
});

describe("DashboardView", () => {
  it("changes the range and exports a csv report", async () => {
    const user = userEvent.setup();

    render(<DashboardView />);

    await user.click(screen.getByRole("button", { name: /Last 7 days/i }));
    await user.click(screen.getByRole("button", { name: /Last 30 days/i }));

    expect(screen.getByRole("button", { name: /Last 30 days/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Export/i }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });
});