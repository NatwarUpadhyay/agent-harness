import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Hexagon, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Harness" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const dest = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/dashboard";
        navigate({ to: dest });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard" });
        } else {
          setInfo("Check your email to confirm your account.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Enter your email above first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setInfo("Password reset link sent.");
  };

  const hasError = !!error;

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] flex items-center justify-center px-4">
      <div
        className="w-full max-w-[480px] rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-8"
        style={{
          backgroundImage:
            "radial-gradient(circle at 0% 0%, rgba(79,122,255,0.08), transparent 55%)",
        }}
      >
        <div className="flex items-center gap-2.5 mb-7">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--accent-muted)] text-[var(--text-accent)]">
            <Hexagon className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <span className="font-semibold tracking-tight text-[17px]">Harness</span>
        </div>

        <h1 className="text-[20px] font-semibold mb-1">
          {mode === "signin" ? "Sign in to your workspace" : "Create your account"}
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mb-6">
          {mode === "signin"
            ? "Enter your email and password to continue."
            : "Sign up with email and password to get started."}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className={`w-full h-10 px-3 rounded-md bg-[var(--bg-elevated)] border text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors ${
                hasError ? "border-[var(--danger)]" : "border-[var(--border-default)]"
              }`}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className={`w-full h-10 px-3 rounded-md bg-[var(--bg-elevated)] border text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors ${
                hasError ? "border-[var(--danger)]" : "border-[var(--border-default)]"
              }`}
              placeholder="••••••••"
            />
            {error && (
              <p className="mt-1.5 text-[12px] text-[var(--danger)]">{error}</p>
            )}
            {info && !error && (
              <p className="mt-1.5 text-[12px] text-[var(--text-accent)]">{info}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-base)] text-[14px] font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading
              ? mode === "signin" ? "Signing in…" : "Creating account…"
              : mode === "signin" ? "Sign in" : "Sign up"}
          </button>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={onForgot}
              className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
              className="text-[12px] text-[var(--text-accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              {mode === "signin" ? "Create account" : "Have an account? Sign in"}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-4 border-t border-[var(--border-subtle)] text-center">
          <Link to="/" className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            Harness — Enterprise AI control plane
          </Link>
        </div>
      </div>
    </div>
  );
}
