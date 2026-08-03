import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Sidebar } from "./Sidebar";

const navigate = vi.fn();

let uiState = {
  sidebarCollapsed: false,
  commandOpen: false,
  toggleSidebar: vi.fn(() => {
    uiState.sidebarCollapsed = !uiState.sidebarCollapsed;
  }),
  setCommandOpen: vi.fn((v: boolean) => {
    uiState.commandOpen = v;
  }),
};

vi.mock("@/stores/ui", () => ({
  useUiStore: (selector: (state: typeof uiState) => unknown) => selector(uiState),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: "/dashboard" } }),
  useNavigate: () => navigate,
}));

vi.mock("@/lib/hooks/use-entities", () => ({
  useEntityCounts: () => ({ agents: 2, tools: 4, workflows: 6, experiments: 1, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe("Sidebar", () => {
  beforeEach(() => {
    uiState = {
      sidebarCollapsed: false,
      commandOpen: false,
      toggleSidebar: vi.fn(() => {
        uiState.sidebarCollapsed = !uiState.sidebarCollapsed;
      }),
      setCommandOpen: vi.fn((v: boolean) => {
        uiState.commandOpen = v;
      }),
    };
    navigate.mockClear();
  });

  it("toggles collapse and signs out", async () => {
    const user = userEvent.setup();

    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: /Toggle sidebar/i }));
    expect(uiState.sidebarCollapsed).toBe(true);

    await user.click(screen.getByRole("button", { name: /Sign out/i }));
    expect(navigate).toHaveBeenCalledWith({ to: "/login", replace: true });
  });
});