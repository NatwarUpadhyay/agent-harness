import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Hexagon, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Reset password — Harness" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const url = new URL(window.location.href);
    setEmail(url.searchParams.get("email") ?? "");

    // PKCE recovery flow: ?code=...
    const code = url.searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exErr }) => {
        if (!mounted) return;
        if (exErr) setError(exErr.message);
        else {
          setReady(true);
          window.history.replaceState({}, "", url.pathname);
        }
      });
    }

    // Implicit recovery flow: #access_token=...&type=recovery
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error: sErr }) => {
        if (!mounted) return;
        if (sErr) setError(sErr.message);
        else {
          setReady(true);
          window.history.replaceState({}, "", url.pathname);
        }
      });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const verifyCode = async () => {
    setError(null);
    setInfo(null);
    if (!email) return setError("Enter the email you requested recovery for.");
    if (!code.trim()) return setError("Enter the 6-digit code from the email.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "recovery",
      });
      if (error) throw error;
      setReady(true);
      setInfo("Code verified. Choose a new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    if (!email) return setError("Enter your email first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setInfo("New recovery code sent.");
  };

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

  const inputCls =
    "w-full h-10 px-3 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors";

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
            : "Enter the 6-digit code from your recovery email."}
        </p>

        {!ready && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className={inputCls}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                Recovery code
              </label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
                className={`${inputCls} font-mono-tabular tracking-[0.4em]`}
                placeholder="000000"
              />
            </div>
            {error && <p className="text-[12px] text-[var(--danger)]">{error}</p>}
            {info && !error && <p className="text-[12px] text-[var(--text-accent)]">{info}</p>}
            <button
              type="button"
              onClick={verifyCode}
              disabled={loading}
              className="w-full h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-base)] text-[14px] font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Verifying…" : "Verify code"}
            </button>
            <button
              type="button"
              onClick={resend}
              className="w-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Resend recovery email
            </button>
          </div>
        )}

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
              className={inputCls}
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
              className={inputCls}
              placeholder="••••••••"
            />
            {ready && error && <p className="mt-1.5 text-[12px] text-[var(--danger)]">{error}</p>}
            {ready && info && !error && (
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
