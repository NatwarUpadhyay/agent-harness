import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { KeyRound, Plus, Copy, Trash2, Check, ShieldAlert, Activity, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/api-keys")({
  head: () => ({
    meta: [
      { title: "API Keys — Harness" },
      { name: "description", content: "Programmatic access keys and service accounts for Harness. Scope, rotate, and revoke keys used by CI, agents, and integrations." },
      { property: "og:title", content: "API Keys — Harness" },
      { property: "og:description", content: "Programmatic access keys and service accounts for Harness." },
    ],
  }),
  component: ApiKeysView,
});

const STORAGE_KEY = "harness.apiKeys.v1";

type Scope = "read" | "write" | "admin";
type Env = "production" | "staging" | "development";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;         // e.g. hns_live_ab12
  masked: string;         // hns_live_ab12••••••••••••
  scopes: Scope[];
  env: Env;
  createdAt: number;
  lastUsedAt: number | null;
  requests7d: number;
  createdBy: string;
}

const SCOPES: Scope[] = ["read", "write", "admin"];
const ENVS: Env[] = ["production", "staging", "development"];

function randomTok(len: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function mkKey(env: Env) {
  const envTag = env === "production" ? "live" : env === "staging" ? "test" : "dev";
  const prefix = `hns_${envTag}_${randomTok(4)}`;
  const secret = randomTok(28);
  return { prefix, secret, full: `${prefix}_${secret}`, masked: `${prefix}_${"•".repeat(24)}` };
}

function loadKeys(): ApiKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // seed
  const seed: ApiKey[] = [
    {
      id: "k_ci_prod",
      name: "CI / GitHub Actions",
      prefix: "hns_live_ci42",
      masked: `hns_live_ci42_${"•".repeat(24)}`,
      scopes: ["read", "write"],
      env: "production",
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 42,
      lastUsedAt: Date.now() - 1000 * 60 * 12,
      requests7d: 18234,
      createdBy: "priya.patel@acme.co",
    },
    {
      id: "k_agent_ret",
      name: "Retriever service account",
      prefix: "hns_live_rt91",
      masked: `hns_live_rt91_${"•".repeat(24)}`,
      scopes: ["read"],
      env: "production",
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 96,
      lastUsedAt: Date.now() - 1000 * 60 * 3,
      requests7d: 92140,
      createdBy: "rohan.iyer@acme.co",
    },
    {
      id: "k_staging",
      name: "Staging harness",
      prefix: "hns_test_stg7",
      masked: `hns_test_stg7_${"•".repeat(24)}`,
      scopes: ["read", "write", "admin"],
      env: "staging",
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
      lastUsedAt: Date.now() - 1000 * 60 * 60 * 5,
      requests7d: 421,
      createdBy: "meera.kapoor@acme.co",
    },
  ];
  return seed;
}

function saveKeys(keys: ApiKey[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys)); } catch { /* ignore */ }
}

function fmtRel(ts: number | null) {
  if (!ts) return "never";
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ApiKeysView() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<{ key: ApiKey; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [env, setEnv] = useState<Env>("production");
  const [scopes, setScopes] = useState<Scope[]>(["read"]);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  useEffect(() => { setKeys(loadKeys()); }, []);
  useEffect(() => { if (keys.length) saveKeys(keys); }, [keys]);

  const kpis = useMemo(() => {
    const total = keys.length;
    const prod = keys.filter(k => k.env === "production").length;
    const admin = keys.filter(k => k.scopes.includes("admin")).length;
    const req = keys.reduce((s, k) => s + k.requests7d, 0);
    return { total, prod, admin, req };
  }, [keys]);

  const create = () => {
    if (!name.trim()) return;
    const { prefix, full, masked } = mkKey(env);
    const key: ApiKey = {
      id: `k_${Date.now().toString(36)}`,
      name: name.trim(),
      prefix,
      masked,
      scopes,
      env,
      createdAt: Date.now(),
      lastUsedAt: null,
      requests7d: 0,
      createdBy: "you@acme.co",
    };
    setKeys(prev => [key, ...prev]);
    setJustCreated({ key, secret: full });
    setCreating(false);
    setName(""); setEnv("production"); setScopes(["read"]);
  };

  const revoke = (id: string) => {
    setKeys(prev => prev.filter(k => k.id !== id));
    setRevokeTarget(null);
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* ignore */ }
  };

  const toggleScope = (s: Scope) => setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  return (
    <div className="px-8 py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="API Keys"
        subtitle="Programmatic access for CI, agents, and integrations. Rotate quarterly. Never share admin keys."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New key
          </button>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <Kpi icon={<KeyRound className="h-3.5 w-3.5" />} label="Active keys" value={kpis.total.toString()} />
        <Kpi icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Production" value={kpis.prod.toString()} accent="#F97316" />
        <Kpi icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Admin scope" value={kpis.admin.toString()} accent="#EF4444" />
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Requests (7d)" value={kpis.req.toLocaleString()} accent="#22C55E" />
      </div>

      <SectionHeader title="Keys" />
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="grid grid-cols-[1.4fr_1.6fr_120px_160px_120px_140px_60px] gap-4 px-4 py-2.5 border-b border-[var(--border-default)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          <div>Name</div><div>Key</div><div>Env</div><div>Scopes</div><div>Requests 7d</div><div>Last used</div><div></div>
        </div>
        {keys.map(k => (
          <div key={k.id} className="grid grid-cols-[1.4fr_1.6fr_120px_160px_120px_140px_60px] gap-4 px-4 py-3 border-b border-[var(--border-default)] text-[13px] items-center">
            <div>
              <div className="text-[var(--text-primary)]">{k.name}</div>
              <div className="text-[11px] text-[var(--text-muted)]">by {k.createdBy}</div>
            </div>
            <div className="flex items-center gap-2">
              <code className="font-mono-tabular text-[12px] text-[var(--text-secondary)] truncate">{k.masked}</code>
              <button onClick={() => copy(k.prefix)} className="opacity-60 hover:opacity-100" title="Copy prefix">
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <div>
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider"
                style={{
                  background: k.env === "production" ? "rgba(249,115,22,0.12)" : k.env === "staging" ? "rgba(234,179,8,0.12)" : "rgba(148,163,184,0.12)",
                  color: k.env === "production" ? "#F97316" : k.env === "staging" ? "#EAB308" : "#94A3B8",
                }}>
                {k.env}
              </span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {k.scopes.map(s => (
                <span key={s} className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border"
                  style={{
                    borderColor: s === "admin" ? "rgba(239,68,68,0.4)" : "var(--border-default)",
                    color: s === "admin" ? "#EF4444" : "var(--text-secondary)",
                  }}>{s}</span>
              ))}
            </div>
            <div className="font-mono-tabular text-[var(--text-secondary)]">{k.requests7d.toLocaleString()}</div>
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <Clock className="h-3 w-3" />{fmtRel(k.lastUsedAt)}
            </div>
            <button onClick={() => setRevokeTarget(k)} className="opacity-60 hover:opacity-100 text-[#EF4444]" title="Revoke">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {keys.length === 0 && (
          <div className="px-4 py-12 text-center text-[13px] text-[var(--text-muted)]">No keys yet. Create one to grant programmatic access.</div>
        )}
      </div>

      <div className="mt-6 text-[11px] text-[var(--text-muted)] leading-relaxed max-w-2xl">
        Keys are shown once at creation and stored as a salted SHA-256 hash. Rotate every 90 days.
        Every request is recorded in the Audit Log with the key prefix, actor, and origin IP.
      </div>

      {/* Create modal */}
      {creating && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setCreating(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[440px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
            <div className="text-[16px] font-semibold mb-4">New API key</div>
            <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CI pipeline"
              className="w-full h-9 px-3 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px] outline-none focus:border-[var(--accent)]/50 mb-4" />
            <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Environment</label>
            <div className="flex gap-2 mb-4">
              {ENVS.map(e => (
                <button key={e} onClick={() => setEnv(e)}
                  className="flex-1 h-9 rounded-md border text-[12px] capitalize"
                  style={{
                    borderColor: env === e ? "var(--accent)" : "var(--border-default)",
                    color: env === e ? "var(--text-primary)" : "var(--text-secondary)",
                    background: env === e ? "rgba(199,199,204,0.05)" : "transparent",
                  }}>{e}</button>
              ))}
            </div>
            <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Scopes</label>
            <div className="flex gap-2 mb-6">
              {SCOPES.map(s => (
                <button key={s} onClick={() => toggleScope(s)}
                  className="flex-1 h-9 rounded-md border text-[12px] uppercase tracking-wider"
                  style={{
                    borderColor: scopes.includes(s) ? (s === "admin" ? "#EF4444" : "var(--accent)") : "var(--border-default)",
                    color: scopes.includes(s) ? (s === "admin" ? "#EF4444" : "var(--text-primary)") : "var(--text-secondary)",
                  }}>{s}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 h-9 rounded-md border border-[var(--border-default)] text-[13px]">Cancel</button>
              <button onClick={create} disabled={!name.trim()}
                className="flex-1 h-9 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium disabled:opacity-40">Create key</button>
            </div>
          </div>
        </>
      )}

      {/* Just-created reveal */}
      {justCreated && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-2 mb-1">
              <Check className="h-4 w-4 text-[#22C55E]" />
              <div className="text-[16px] font-semibold">Key created</div>
            </div>
            <div className="text-[12px] text-[var(--text-secondary)] mb-4">Copy this secret now. You won't be able to see it again.</div>
            <div className="rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] p-3 flex items-center justify-between gap-2 mb-4">
              <code className="font-mono-tabular text-[12px] break-all">{justCreated.secret}</code>
              <button onClick={() => copy(justCreated.secret)}
                className="shrink-0 inline-flex items-center gap-1 px-2 h-7 rounded border border-[var(--border-default)] text-[11px]">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button onClick={() => setJustCreated(null)}
              className="w-full h-9 rounded-md bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium">I've saved it</button>
          </div>
        </>
      )}

      {/* Revoke confirm */}
      {revokeTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setRevokeTarget(null)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
            <div className="text-[16px] font-semibold mb-2">Revoke {revokeTarget.name}?</div>
            <div className="text-[13px] text-[var(--text-secondary)] mb-6">
              This immediately invalidates <code className="font-mono-tabular">{revokeTarget.prefix}</code>. Any service using it will start receiving 401s.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRevokeTarget(null)} className="flex-1 h-9 rounded-md border border-[var(--border-default)] text-[13px]">Cancel</button>
              <button onClick={() => revoke(revokeTarget.id)}
                className="flex-1 h-9 rounded-md bg-[#EF4444] text-white text-[13px] font-medium">Revoke</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
        {icon}{label}
      </div>
      <div className="mt-2 text-[24px] font-semibold font-mono-tabular" style={{ color: accent ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
