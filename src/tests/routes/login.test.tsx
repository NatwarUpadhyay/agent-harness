import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  auth: {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => ({ ...config }),
  useNavigate: () => mocks.navigate,
  useSearch: () => ({}),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: mocks.auth },
}));

import { Route } from "../../routes/login";

// createFileRoute is mocked above, so the route object is a plain config bag.
const RouteComponent = (Route as unknown as { component: React.ComponentType }).component;

describe("Login route", () => {
  beforeEach(() => {
    mocks.navigate.mockClear();
    Object.values(mocks.auth).forEach((fn) => fn.mockClear());
  });

  it("signs in and switches auth modes", async () => {
    const user = userEvent.setup();
    render(<RouteComponent />);

    await user.type(screen.getByPlaceholderText(/you@company\.com/i), "avery@example.com");
    await user.type(screen.getByPlaceholderText(/••••••••/i), "secret123");
    await user.click(screen.getByRole("button", { name: /^Sign in$/i }));

    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "avery@example.com",
      password: "secret123",
    });
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });

    await user.click(screen.getByRole("button", { name: /Create account/i }));
    expect(screen.getByText(/Create your account/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Continue with an email sign-in link/i }));
    expect(screen.getByText(/Sign in with an email code/i)).toBeInTheDocument();
  });

  it("sends a recovery email from the forgot password button", async () => {
    const user = userEvent.setup();
    render(<RouteComponent />);

    await user.type(screen.getByPlaceholderText(/you@company\.com/i), "avery@example.com");
    await user.click(screen.getByRole("button", { name: /Forgot password\?/i }));

    expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "avery@example.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password") }),
    );
    expect(screen.getByText(/Recovery code sent/i)).toBeInTheDocument();
  });
});
