import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EvaluationsView } from "./EvaluationsView";
import { evalRuns } from "@/lib/data/evals";

describe("EvaluationsView", () => {
  it("opens a run drawer", async () => {
    const user = userEvent.setup();

    render(<EvaluationsView />);

    await user.click(screen.getByText(evalRuns[0].name));

    expect(screen.getByText("Pass rate")).toBeInTheDocument();
    expect(screen.getByText(/Cases:/)).toBeInTheDocument();
  });

  it("enables comparison after selecting two runs", async () => {
    const user = userEvent.setup();

    render(<EvaluationsView />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole("button", { name: /Compare \(2\)/i }));

    expect(screen.getByText("Compare runs")).toBeInTheDocument();
  });

  it("switches datasets", async () => {
    const user = userEvent.setup();

    render(<EvaluationsView />);
    await user.click(screen.getByRole("button", { name: /Production sample/i }));

    expect(screen.getByRole("button", { name: /Production sample/i })).toHaveClass("bg-[var(--accent-muted)]");
  });
});