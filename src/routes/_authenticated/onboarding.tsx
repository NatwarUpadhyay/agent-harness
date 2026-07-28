import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Users, Boxes, Coins, Cable, ShieldCheck, Check, ArrowRight,
  ArrowLeft, Sparkles, Copy, Plus, X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";

const STORAGE_KEY = "harness.onboarding.v1";

type Provider = "openai" | "anthropic" | "google" | "azure" | "bedrock";
interface Invite { email: string; role: "admin" | "member" | "viewer" }
interface State {
  org: { name: string; domain: string; size: string; industry: string };
  providers: Provider[];
  invites: Invite[];
  budget: { monthly: number; alertAt: number; perSeat: number };
  sources: string[];
  policies: { pii: boolean; dataResidency: "us" | "eu" | "global"; retentionDays: number };
  completed: boolean;
}

const DEFAULT: State = {
  org: { name: "", domain: "", size: "51-200", industry: "SaaS" },
  providers: [],
  invites: [{ email: "", role: "member" }],
  budget: { monthly: 5000, alertAt: 80, perSeat: 200 },
  sources: [],
  policies: { pii: true, dataResidency: "us", retentionDays: 90 },
  completed: false,
};

const PROVIDERS: { id: Provider; name: string; blurb: string }[] = [
  { id: "openai", name: "OpenAI", blurb: "GPT-4o, o1, embeddings" },
  { id: "anthropic", name: "Anthropic", blurb: "Claude 3.5 Sonnet, Haiku" },
  { id: "google", name: "Google", blurb: "Gemini 1.5 Pro / Flash" },
  { id: "azure", name: "Azure OpenAI", blurb: "Enterprise SLA" },
  { id: "bedrock", name: "AWS Bedrock", blurb: "Multi-model gateway" },
];

const SOURCES = [
  "Snowflake", "BigQuery", "Confluence", "Notion", "Google Drive",
  "S3", "SharePoint", "Postgres", "Slack", "Jira",
];

const STEPS = [
  { id: "org", label: "Organization", icon: Building2 },
  { id: "providers", label: "Providers", icon: Boxes },
  { id: "team", label: "Team", icon: Users },
  { id: "budget", label: "Budget", icon: Coins },
  { id: "sources", label: "Data", icon: Cable },
  { id: "policies", label: "Policies", icon: ShieldCheck },
  { id: "done", label: "Done", icon: Sparkles },
] as const;

function load(): State {
  if (typeof window === "undefined") return DEFAULT;
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT; }
  catch { return DEFAULT; }
}
function save(s: State) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Get started — Harness" }] }),
  component: OnboardingView,
});

function OnboardingView() {
  const [state, setState] = useState<State>(DEFAULT);
  const [step, setStep] = useState(0);
  const nav = useNavigate();

  useEffect(() => { setState(load()); }, []);
  useEffect(() => { save(state); }, [state]);

  const update = <K extends keyof State>(k: K, v: State[K]) => setState((s) => ({ ...s, [k]: v }));
  const stepId = STEPS[step].id;

  const canNext = (() => {
    if (stepId === "org") return state.org.name.trim().length > 1 && state.org.domain.trim().length > 3;
    if (stepId === "providers") return state.providers.length > 0;
    if (stepId === "team") return state.invites.some((i) => /\S+@\S+\.\S+/.test(i.email));
    if (stepId === "budget") return state.budget.monthly > 0;
    if (stepId === "sources") return true;
    if (stepId === "policies") return true;
    return true;
  })();

  const next = () => {
    if (!canNext) { toast.error("Complete this step to continue"); return; }
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const back = () => step > 0 && setStep(step - 1);

  const finish = () => {
    update("completed", true);
    toast.success("Workspace is live", { description: `${state.org.name || "Your org"} is ready.` });
    setTimeout(() => nav({ to: "/org" as string }), 400);
  };

  return (
    <>
      <PageHeader
        title="Set up your workspace"
        subtitle="Six quick steps. Bring your providers, your team, and your data — start observing in under a minute."
        actions={
          state.completed ? (
            <button onClick={() => nav({ to: "/org" as string })}
              className="h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium inline-flex items-center gap-2">
              Open control room <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null
        }
      />

      {/* Stepper */}
      <div className="mb-6 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <button key={s.id} onClick={() => i <= step && setStep(i)}
                className={`flex-1 min-w-[110px] flex items-center gap-2 px-3 py-2 rounded-md text-[12px] transition-colors ${
                  active ? "bg-[var(--accent-muted)] text-[var(--text-primary)]"
                  : done ? "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  : "text-[var(--text-muted)]"
                }`}>
                <span className={`h-6 w-6 rounded-full inline-flex items-center justify-center border ${
                  done ? "bg-[var(--accent)] text-[var(--bg-base)] border-transparent"
                  : active ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-[var(--border-default)]"
                }`}>
                  {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 min-h-[380px]">
        <AnimatePresence mode="wait">
          <motion.div key={stepId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {stepId === "org" && <OrgStep state={state} setState={setState} />}
            {stepId === "providers" && <ProvidersStep state={state} setState={setState} />}
            {stepId === "team" && <TeamStep state={state} setState={setState} />}
            {stepId === "budget" && <BudgetStep state={state} setState={setState} />}
            {stepId === "sources" && <SourcesStep state={state} setState={setState} />}
            {stepId === "policies" && <PoliciesStep state={state} setState={setState} />}
            {stepId === "done" && <DoneStep state={state} onFinish={finish} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={back} disabled={step === 0}
          className="h-9 px-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[13px] inline-flex items-center gap-2 disabled:opacity-40">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="text-[11px] text-[var(--text-muted)]">Step {step + 1} of {STEPS.length}</div>
        {stepId !== "done" ? (
          <button onClick={next}
            className="h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium inline-flex items-center gap-2">
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button onClick={finish}
            className="h-9 px-3 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium inline-flex items-center gap-2">
            Launch workspace <Sparkles className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </>
  );
}

/* ---------- Steps ---------- */

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-[var(--text-muted)] mt-1">{hint}</div>}
    </label>
  );
}

const inputCls = "w-full h-9 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 text-[13px] focus:outline-none focus:border-[var(--accent)]";

function OrgStep({ state, setState }: any) {
  const o = state.org;
  const set = (k: string, v: any) => setState({ ...state, org: { ...o, [k]: v } });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
      <Field label="Company name"><input className={inputCls} placeholder="Acme Corp" value={o.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <Field label="Primary domain" hint="Used to auto-map employees on sign-in."><input className={inputCls} placeholder="acme.co" value={o.domain} onChange={(e) => set("domain", e.target.value)} /></Field>
      <Field label="Company size">
        <select className={inputCls} value={o.size} onChange={(e) => set("size", e.target.value)}>
          {["1-10","11-50","51-200","201-1000","1000+"].map((x) => <option key={x}>{x}</option>)}
        </select>
      </Field>
      <Field label="Industry">
        <select className={inputCls} value={o.industry} onChange={(e) => set("industry", e.target.value)}>
          {["SaaS","Fintech","Healthcare","Retail","Manufacturing","Government","Other"].map((x) => <option key={x}>{x}</option>)}
        </select>
      </Field>
    </div>
  );
}

function ProvidersStep({ state, setState }: any) {
  const toggle = (p: Provider) => {
    const has = state.providers.includes(p);
    setState({ ...state, providers: has ? state.providers.filter((x: Provider) => x !== p) : [...state.providers, p] });
  };
  return (
    <div>
      <p className="text-[13px] text-[var(--text-secondary)] mb-4">Pick the model providers your teams already use. You can route across them later.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PROVIDERS.map((p) => {
          const active = state.providers.includes(p.id);
          return (
            <button key={p.id} onClick={() => toggle(p.id)}
              className={`text-left rounded-md border p-4 transition-colors ${active ? "border-[var(--accent)] bg-[var(--accent-muted)]" : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"}`}>
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-medium">{p.name}</div>
                {active && <Check className="h-4 w-4 text-[var(--accent)]" />}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">{p.blurb}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamStep({ state, setState }: any) {
  const set = (invites: Invite[]) => setState({ ...state, invites });
  const add = () => set([...state.invites, { email: "", role: "member" }]);
  const rm = (i: number) => set(state.invites.filter((_: any, idx: number) => idx !== i));
  const upd = (i: number, patch: Partial<Invite>) => set(state.invites.map((inv: Invite, idx: number) => idx === i ? { ...inv, ...patch } : inv));
  return (
    <div className="max-w-3xl">
      <p className="text-[13px] text-[var(--text-secondary)] mb-4">Invite your first teammates. You can bulk-import later from SSO.</p>
      <div className="space-y-2">
        {state.invites.map((inv: Invite, i: number) => (
          <div key={i} className="flex gap-2">
            <input className={inputCls} placeholder="name@company.com" value={inv.email} onChange={(e) => upd(i, { email: e.target.value })} />
            <select className={`${inputCls} w-36`} value={inv.role} onChange={(e) => upd(i, { role: e.target.value as any })}>
              <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
            </select>
            <button onClick={() => rm(i)} className="h-9 w-9 rounded-md border border-[var(--border-default)] inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)]"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 h-8 px-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[12px] inline-flex items-center gap-2 hover:bg-[var(--bg-surface)]">
        <Plus className="h-3 w-3" /> Add another
      </button>
    </div>
  );
}

function BudgetStep({ state, setState }: any) {
  const b = state.budget;
  const set = (k: string, v: number) => setState({ ...state, budget: { ...b, [k]: v } });
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
      <Field label="Monthly org budget (USD)" hint="Hard-cap the whole workspace."><input type="number" className={inputCls} value={b.monthly} onChange={(e) => set("monthly", +e.target.value)} /></Field>
      <Field label="Alert threshold (% of budget)"><input type="number" min={1} max={100} className={inputCls} value={b.alertAt} onChange={(e) => set("alertAt", +e.target.value)} /></Field>
      <Field label="Default per-seat cap (USD/mo)"><input type="number" className={inputCls} value={b.perSeat} onChange={(e) => set("perSeat", +e.target.value)} /></Field>
      <div className="md:col-span-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 text-[12px] text-[var(--text-secondary)]">
        We alert admins in Slack and email when the org crosses <span className="text-[var(--text-primary)] font-medium">{b.alertAt}%</span> of the ${b.monthly}/mo cap. Individuals crossing their per-seat cap get soft-throttled to cheaper models.
      </div>
    </div>
  );
}

function SourcesStep({ state, setState }: any) {
  const toggle = (s: string) => {
    const has = state.sources.includes(s);
    setState({ ...state, sources: has ? state.sources.filter((x: string) => x !== s) : [...state.sources, s] });
  };
  return (
    <div>
      <p className="text-[13px] text-[var(--text-secondary)] mb-4">Optional. Pick the systems your agents should read from. You can connect these securely later.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {SOURCES.map((s) => {
          const active = state.sources.includes(s);
          return (
            <button key={s} onClick={() => toggle(s)}
              className={`h-10 rounded-md border text-[12px] px-3 inline-flex items-center justify-between transition-colors ${active ? "border-[var(--accent)] bg-[var(--accent-muted)]" : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"}`}>
              {s}{active && <Check className="h-3.5 w-3.5 text-[var(--accent)]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PoliciesStep({ state, setState }: any) {
  const p = state.policies;
  const set = (k: string, v: any) => setState({ ...state, policies: { ...p, [k]: v } });
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
      <Field label="Data residency">
        <select className={inputCls} value={p.dataResidency} onChange={(e) => set("dataResidency", e.target.value)}>
          <option value="us">United States</option><option value="eu">European Union</option><option value="global">Global</option>
        </select>
      </Field>
      <Field label="Trace retention (days)"><input type="number" className={inputCls} value={p.retentionDays} onChange={(e) => set("retentionDays", +e.target.value)} /></Field>
      <Field label="PII redaction">
        <button onClick={() => set("pii", !p.pii)} className={`h-9 w-full rounded-md border px-3 text-[13px] inline-flex items-center justify-between ${p.pii ? "border-[var(--accent)] bg-[var(--accent-muted)]" : "border-[var(--border-default)] bg-[var(--bg-elevated)]"}`}>
          {p.pii ? "Enabled" : "Disabled"} <Check className={`h-3.5 w-3.5 ${p.pii ? "opacity-100" : "opacity-30"}`} />
        </button>
      </Field>
    </div>
  );
}

function DoneStep({ state, onFinish }: { state: State; onFinish: () => void }) {
  const snippet = `curl https://api.harness.dev/v1/traces \\
  -H "Authorization: Bearer $HARNESS_KEY" \\
  -H "X-Org: ${state.org.domain || "your-org"}" \\
  -d '{"agent":"support-bot","model":"gpt-4o","tokens_in":842,"tokens_out":210}'`;
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
        <Sparkles className="h-4 w-4 text-[var(--accent)]" /> You are one click from live observability.
      </div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Summary label="Providers" value={state.providers.length.toString()} />
        <Summary label="Seats invited" value={state.invites.filter((i) => i.email).length.toString()} />
        <Summary label="Monthly cap" value={`$${state.budget.monthly.toLocaleString()}`} />
        <Summary label="Data sources" value={state.sources.length.toString()} />
      </div>
      <div className="mt-6">
        <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-2">Drop-in SDK</div>
        <div className="relative rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
          <pre className="text-[11px] font-mono-tabular text-[var(--text-secondary)] overflow-x-auto whitespace-pre">{snippet}</pre>
          <button onClick={() => { navigator.clipboard.writeText(snippet); toast.success("Copied"); }}
            className="absolute top-2 right-2 h-7 w-7 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] inline-flex items-center justify-center hover:bg-[var(--bg-surface)]">
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>
      <button onClick={onFinish} className="mt-6 h-10 px-4 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium inline-flex items-center gap-2">
        Launch control room <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
      <div className="text-[18px] font-mono-tabular font-semibold mt-0.5">{value}</div>
    </div>
  );
}
