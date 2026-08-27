import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Header } from "./Header";

const navigate = vi.fn();
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

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

let allRead = false;
vi.mock("@/lib/data/activity.functions", () => ({
  listActivityEvents: vi.fn().mockImplementation(() => Promise.resolve([
    { id: "a1", kind: "info", title: "Deployment complete", body: "", read: allRead, created_at: new Date().toISOString() },
    { id: "a2", kind: "warning", title: "Budget alert", body: "", read: allRead, created_at: new Date().toISOString() },
    { id: "a3", kind: "success", title: "Run finished", body: "", read: true, created_at: new Date().toISOString() },
  ])),
  markActivityRead: vi.fn().mockImplementation(() => { allRead = true; return Promise.resolve(undefined); }),
  markAllActivityRead: vi.fn().mockImplementation(() => { allRead = true; return Promise.resolve(undefined); }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: "avery@example.com", user_metadata: { full_name: "Avery Kim" } } },
      }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe("Header", () => {
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
    queryClient.clear();
  });

  it("opens search, marks notifications read, and signs out", async () => {
    const user = userEvent.setup();

    render(<QueryClientProvider client={queryClient}><Header /></QueryClientProvider>);

    await user.click(screen.getAllByRole("button", { name: /Open search/i })[0]);
    expect(uiState.commandOpen).toBe(true);

    await waitFor(() => expect(screen.getByRole("button", { name: /Account: Avery Kim/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Notifications \(2 unread\)/i }));
    await user.click(screen.getByRole("button", { name: /Mark all read/i }));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Account: Avery Kim/i }));
    await user.click(screen.getByRole("button", { name: /Sign out/i }));

    expect(navigate).toHaveBeenCalledWith({ to: "/login", replace: true });
  });
});