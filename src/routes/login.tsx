import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Hexagon, Loader2, KeyRound, Mail } from "lucide-react";
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

type Mode = "signin" | "signup" | "otp";

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If a recovery link lands here (hash or ?code=), forward it to /reset-password.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      window.location.replace(`/reset-password${hash}`);
      return;
    }
    const codeParam = new URL(window.location.href).searchParams.get("code");
    if (codeParam) window.location.replace(`/reset-password?code=${codeParam}`);
  }, []);

  const dest = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/dashboard";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: dest });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else setInfo("Check your email to confirm your account.");
      } else {
        // Email OTP (passwordless)
        if (!codeSent) {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/dashboard` },
          });
          if (error) throw error;
          setCodeSent(true);
          setInfo(`We sent a 6-digit code to ${email}.`);
        } else {
          const { error } = await supabase.auth.verifyOtp({
            email,
            token: code.trim(),
            type: "email",
          });
          if (error) throw error;
          navigate({ to: dest });
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
    setLoading(true);
    try {
      // Send a recovery email that works both as a link and as a 6-digit code.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setInfo("Recovery code sent. Taking you to the reset page…");
      setTimeout(
        () => navigate({ to: "/reset-password", search: { email } as never }),
        700,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send recovery email.");
    } finally {
      setLoading(false);
    }
  };

  const hasError = !!error;
  const inputCls = (bad: boolean) =>
    `w-full h-10 px-3 rounded-md bg-[var(--bg-elevated)] border text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors ${
      bad ? "border-[var(--danger)]" : "border-[var(--border-default)]"
    }`;

  const title =
    mode === "signin"
      ? "Sign in to your workspace"
      : mode === "signup"
        ? "Create your account"
        : "Sign in with an email code";
  const subtitle =
    mode === "signin"
      ? "Enter your email and password to continue."
      : mode === "signup"
        ? "Sign up with email and password to get started."
        : "No password needed — we'll email you a 6-digit code.";

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

        <h1 className="text-[20px] font-semibold mb-1">{title}</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mb-6">{subtitle}</p>

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
              disabled={loading || (mode === "otp" && codeSent)}
              className={inputCls(hasError)}
              placeholder="you@company.com"
            />
          </div>

          {mode !== "otp" && (
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
                className={inputCls(hasError)}
                placeholder="••••••••"
              />
            </div>
          )}

          {mode === "otp" && codeSent && (
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                6-digit code
              </label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
                className={`${inputCls(hasError)} font-mono-tabular tracking-[0.4em]`}
                placeholder="000000"
              />
            </div>
          )}

          {error && <p className="text-[12px] text-[var(--danger)]">{error}</p>}
          {info && !error && <p className="text-[12px] text-[var(--text-accent)]">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-base)] text-[14px] font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin"
              ? loading
                ? "Signing in…"
                : "Sign in"
              : mode === "signup"
                ? loading
                  ? "Creating account…"
                  : "Sign up"
                : codeSent
                  ? loading
                    ? "Verifying…"
                    : "Verify code"
                  : loading
                    ? "Sending code…"
                    : "Email me a code"}
          </button>

          {mode === "otp" && codeSent && (
            <button
              type="button"
              onClick={() => {
                setCodeSent(false);
                setCode("");
                setInfo(null);
                setError(null);
              }}
              className="w-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Use a different email / resend code
            </button>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={onForgot}
              disabled={loading}
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
              {mode === "signup" ? "Have an account? Sign in" : "Create account"}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "otp" ? "signin" : "otp");
              setCodeSent(false);
              setCode("");
              setError(null);
              setInfo(null);
            }}
            className="w-full h-10 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center justify-center gap-2 transition-colors"
          >
            {mode === "otp" ? (
              <>
                <KeyRound className="h-4 w-4" /> Use email + password instead
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" /> Continue with email code (OTP)
              </>
            )}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] text-center">
          <Link to="/" className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            Harness — Enterprise AI control plane
          </Link>
        </div>
      </div>
    </div>
  );
}
