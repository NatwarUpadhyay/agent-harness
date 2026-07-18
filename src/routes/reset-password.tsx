import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Hexagon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reset password — Harness" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase JS auto-parses the recovery hash and fires PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setInfo("Password updated. Redirecting…");
      setTimeout(() => navigate({ to: "/dashboard" }), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

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

        <h1 className="text-[20px] font-semibold mb-1">Set a new password</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mb-6">
          {ready
            ? "Enter a new password for your account."
            : "Validating your recovery link…"}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
              New password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || !ready}
              className="w-full h-10 px-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
              Confirm password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading || !ready}
              className="w-full h-10 px-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors"
              placeholder="••••••••"
            />
            {error && <p className="mt-1.5 text-[12px] text-[var(--danger)]">{error}</p>}
            {info && !error && (
              <p className="mt-1.5 text-[12px] text-[var(--text-accent)]">{info}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !ready}
            className="w-full h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-base)] text-[14px] font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-[var(--border-subtle)] text-center">
          <Link to="/login" className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
