import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => ({ ...config }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { Route } from "../../routes/_authenticated/projects";

const RouteComponent = (Route as unknown as { component: React.ComponentType }).component;

describe("Projects route", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates, filters, persists, and deletes multiple projects", () => {
    const { unmount } = render(<RouteComponent />);

    for (const project of [
      { name: "Pilot Alpha", owner: "NA" },
      { name: "Pilot Beta", owner: "RK" },
      { name: "Pilot Gamma", owner: "SM" },
    ]) {
      fireEvent.click(screen.getByRole("button", { name: /New project/i }));
      fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: project.name } });
      fireEvent.change(screen.getByPlaceholderText("Owner initials"), { target: { value: project.owner } });
      fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    }

    expect(document.body).toHaveTextContent("9 shown · 9 projects · 38 agents total");
    expect(screen.getByText("Pilot Alpha")).toBeInTheDocument();
    expect(screen.getByText("Pilot Beta")).toBeInTheDocument();
    expect(screen.getByText("Pilot Gamma")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search projects…"), { target: { value: "beta" } });
    expect(screen.getByText("Pilot Beta")).toBeInTheDocument();
    expect(screen.queryByText("Pilot Alpha")).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent("1 shown · 9 projects · 38 agents total");

    unmount();
    render(<RouteComponent />);
    expect(screen.getByText("Pilot Alpha")).toBeInTheDocument();
    expect(screen.getByText("Pilot Beta")).toBeInTheDocument();
    expect(screen.getByText("Pilot Gamma")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Delete Pilot Beta"));
    expect(screen.queryByText("Pilot Beta")).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent("8 shown · 8 projects · 37 agents total");
  });
});
