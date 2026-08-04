import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => ({ ...config }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { Route } from "../../routes/_authenticated/projects";

describe("Projects route", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates, filters, persists, and deletes multiple projects", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Route.component />);

    for (const project of [
      { name: "Pilot Alpha", owner: "NA" },
      { name: "Pilot Beta", owner: "RK" },
      { name: "Pilot Gamma", owner: "SM" },
    ]) {
      await user.click(screen.getByRole("button", { name: /New project/i }));
      await user.type(screen.getByPlaceholderText("Project name"), project.name);
      await user.clear(screen.getByPlaceholderText("Owner initials"));
      await user.type(screen.getByPlaceholderText("Owner initials"), project.owner);
      await user.click(screen.getByRole("button", { name: "Create project" }));
    }

    expect(document.body).toHaveTextContent("9 shown · 9 projects · 38 agents total");
    expect(screen.getByText("Pilot Alpha")).toBeInTheDocument();
    expect(screen.getByText("Pilot Beta")).toBeInTheDocument();
    expect(screen.getByText("Pilot Gamma")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search projects…"), "beta");
    expect(screen.getByText("Pilot Beta")).toBeInTheDocument();
    expect(screen.queryByText("Pilot Alpha")).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent("1 shown · 9 projects · 38 agents total");

    unmount();
    render(<Route.component />);
    expect(screen.getByText("Pilot Alpha")).toBeInTheDocument();
    expect(screen.getByText("Pilot Beta")).toBeInTheDocument();
    expect(screen.getByText("Pilot Gamma")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Delete Pilot Beta"));
    expect(screen.queryByText("Pilot Beta")).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent("8 shown · 8 projects · 37 agents total");
  });
});
