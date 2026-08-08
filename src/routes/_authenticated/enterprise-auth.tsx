import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  KeyRound, Users, ShieldCheck, Globe, Copy, Check, RefreshCw, ExternalLink, TestTube, Lock, Unlock, Building2,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import {
  type EnterpriseAuth, type SsoProvider, type ScimConfig,
  loadEnterpriseAuth, saveEnterpriseAuth, defaultSsoProvider, makeScimEndpoint, isSsoEnforced,
} from "@/lib/data/enterprise-auth";

const PROVIDERS = [
  { id: "generic", label: "Generic SAML 2.0" },
  { id: "okta", label: "Okta" },
  { id: "entra", label: "Microsoft Entra ID" },
  { id: "google", label: "Google Workspace" },
  { id: "oneLogin", label: "OneLogin" },
] as const;

const ROLES = ["owner", "admin", "operator", "analyst", "viewer"] as const;

const AUDIT_KEY = "harness.enterprise-auth.audit.v1";

interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  details: string;
  timestamp: string;
}

export const Route = createFileRoute("/_authenticated/enterprise-auth")({
  head: () => ({
    meta: [
      { title: "Enterprise auth — SSO, SCIM & access | Harness" },
      { name: "description", content: "Configure SAML single sign-on, SCIM provisioning, and JIT access controls for your organization." },
      { property: "og:title", content: "Enterprise auth — Harness" },
      { property: "og:description", content: "SAML SSO, SCIM provisioning, and just-in-time access for enterprise agent teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EnterpriseAuthPage,
});

function loadAudit(): AuditEvent[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(AUDIT_KEY) || "[]"); } catch { return []; }
}
function appendAudit(action: string, details: string) {
  if (typeof window === "undefined") return;
  const events = loadAudit();
  events.unshift({
    id: `ev_${Date.now().toString(36)}`,
    actor: "admin@acme.io",
    action,
    details,
    timestamp: new Date().toISOString(),
  });
  window.localStorage.setItem(AUDIT_KEY, JSON.stringify(events.slice(0, 100)));
}

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch { return iso; }
}

function EnterpriseAuthPage() {
  const [config, setConfig] = useState<EnterpriseAuth>(() => loadEnterpriseAuth());
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<SsoProvider>(() => defaultSsoProvider());
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [baseUrl, setBaseUrl] = useState(() => (typeof window !== "undefined" ? window.location.origin : "https://harness-flow-control.lovable.app"));

  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => { if (hydrated) saveEnterpriseAuth(config); }, [config, hydrated]);

  const active = config.sso[0];
  const scimEndpoint = useMemo(() => makeScimEndpoint(baseUrl), [baseUrl]);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
      toast.success("Copied to clipboard");
    } catch { toast.error("Could not copy"); }
  };

  const addProvider = () => {
    if (!draft.name.trim() || !draft.domain.trim()) {
      toast.error("Provider name and domain are required");
      return;
    }
    const next = { ...draft, id: `sso_${Date.now().toString(36)}`, active: true };
    setConfig((c) => {
      const filtered = c.sso.filter((p) => p.domain !== next.domain);
      return { ...c, sso: [next, ...filtered] };
    });
    setDraft(defaultSsoProvider());
    appendAudit("SSO provider configured", `${next.name} (${next.domain})`);
    toast.success("SSO provider saved");
  };

  const removeProvider = (id: string) => {
    setConfig((c) => ({ ...c, sso: c.sso.filter((p) => p.id !== id) }));
    appendAudit("SSO provider removed", id);
    toast.message("SSO provider removed");
  };

  const updateScim = (patch: Partial<ScimConfig>) => {
    setConfig((c) => {
      const next = { ...c.scim, ...patch };
      appendAudit("SCIM config updated", Object.keys(patch).join(", "));
      return { ...c, scim: next };
    });
  };

  const rotateToken = () => {
    setConfig((c) => {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      appendAudit("SCIM token rotated", "New bearer token generated");
      return { ...c, scim: { ...c.scim, token } };
    });
    toast.success("SCIM token rotated — copy it now");
  };

  const testScim = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      const success = Math.random() > 0.25;
      setConfig((c) => ({
        ...c,
        scim: { ...c.scim, lastStatus: success ? "success" : "error", lastSyncedAt: new Date().toISOString() },
      }));
      appendAudit("SCIM test connection", success ? "Successful handshake" : "Simulated directory timeout");
      toast[success ? "success" : "error"](success ? "Directory handshake succeeded" : "Directory unreachable (simulated)");
    }, 1200);
  };

  const togglePasswordLogin = () => {
    setConfig((c) => {
      const next = !c.passwordLoginEnabled;
      appendAudit("Password login toggled", next ? "Enabled" : "Disabled");
      toast[next ? "message" : "success"](next ? "Password login enabled" : "SSO-only mode: password logins blocked");
      return { ...c, passwordLoginEnabled: next };
    });
  };

  const sampleSaml = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.acme.io">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.acme.io/saml/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;

  const audit = loadAudit();

  return (
    <>
      <PageHeader
        title="Enterprise auth"
        subtitle="SAML single sign-on, SCIM provisioning, and just-in-time access controls"
        actions={
          <Link
            to="/governance"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[var(--border-default)] text-[13px] hover:border-[var(--border-strong)]"
          >
            <Building2 className="h-3.5 w-3.5" /> Governance
          </Link>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { icon: ShieldCheck, label: "SSO status", value: active ? "Active" : "Not configured" },
          { icon: Users, label: "SCIM provisioning", value: config.scim.enabled ? "Enabled" : "Disabled" },
          { icon: Lock, label: "Password login", value: config.passwordLoginEnabled ? "Allowed" : "SSO-only" },
          { icon: Globe, label: "JIT access", value: config.scim.jitProvisioning ? "On" : "Off" },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className="mt-2 text-[18px] font-medium tabular-nums">{k.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* SSO configuration */}
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="SAML / OIDC providers" />
          <div className="space-y-4">
            {config.sso.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[var(--border-default)] p-6 text-center text-[13px] text-[var(--text-secondary)]">
                No SSO provider configured yet.
              </div>
            ) : (
              config.sso.map((p) => (
                <div key={p.id} className="rounded-[8px] border border-[var(--border-subtle)] p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[14px] font-semibold">{p.name}</div>
                      <div className="text-[11px] font-mono-tabular text-[var(--text-muted)]">{p.domain} · {p.protocol.toUpperCase()} · {PROVIDERS.find((x) => x.id === p.provider)?.label}</div>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm"
                        style={{
                          background: `color-mix(in oklab, ${p.enforce ? "var(--accent)" : "var(--text-secondary)"} 14%, transparent)`,
                          color: p.enforce ? "var(--accent)" : "var(--text-secondary)",
                        }}
                      >
                        {p.enforce ? "enforced" : "optional"}
                      </span>
                      <button
                        onClick={() => removeProvider(p.id)}
                        className="h-7 w-7 grid place-items-center rounded-[6px] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)]"
                        aria-label="Remove provider"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Default role: <span className="text-[var(--text-primary)] capitalize">{p.defaultRole}</span>
                  </div>
                </div>
              ))
            )}

            <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
              <div className="text-[13px] font-medium">Add provider</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Provider name"
                  className="h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px]"
                />
                <input
                  value={draft.domain}
                  onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
                  placeholder="company.com"
                  className="h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px]"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  value={draft.provider}
                  onChange={(e) => setDraft({ ...draft, provider: e.target.value as SsoProvider["provider"] })}
                  className="h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px]"
                >
                  {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <select
                  value={draft.protocol}
                  onChange={(e) => setDraft({ ...draft, protocol: e.target.value as SsoProvider["protocol"] })}
                  className="h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px]"
                >
                  <option value="saml">SAML 2.0</option>
                  <option value="oidc">OIDC</option>
                </select>
              </div>
              <input
                value={draft.metadataUrl || ""}
                onChange={(e) => setDraft({ ...draft, metadataUrl: e.target.value })}
                placeholder="IdP metadata URL (optional)"
                className="w-full h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px]"
              />
              <textarea
                value={draft.metadataXml || ""}
                onChange={(e) => setDraft({ ...draft, metadataXml: e.target.value })}
                placeholder={`Paste IdP metadata XML here, e.g.\n${sampleSaml.slice(0, 120)}…`}
                rows={4}
                className="w-full px-3 py-2 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[12px] font-mono leading-relaxed"
              />
              <div className="flex items-center gap-3">
                <label className="text-[12px] text-[var(--text-secondary)]">Default role</label>
                <select
                  value={draft.defaultRole}
                  onChange={(e) => setDraft({ ...draft, defaultRole: e.target.value as SsoProvider["defaultRole"] })}
                  className="h-8 px-2 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[12px]"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="enforce"
                  type="checkbox"
                  checked={draft.enforce}
                  onChange={(e) => setDraft({ ...draft, enforce: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                <label htmlFor="enforce" className="text-[12px] text-[var(--text-secondary)]">Enforce SSO for this domain (block password login)</label>
              </div>
              <button
                onClick={addProvider}
                className="w-full h-9 rounded-[8px] bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:opacity-90"
              >
                Save provider
              </button>
            </div>
          </div>
        </div>

        {/* SCIM configuration */}
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <SectionHeader title="SCIM provisioning" />
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium">Enable SCIM</div>
                <div className="text-[11px] text-[var(--text-secondary)]">Auto-create, update, and deactivate users from your directory.</div>
              </div>
              <button
                role="switch"
                aria-checked={config.scim.enabled}
                onClick={() => updateScim({ enabled: !config.scim.enabled })}
                className="relative h-5 w-9 rounded-full transition-colors"
                style={{ background: config.scim.enabled ? "var(--accent)" : "var(--border-default)" }}
              >
                <span className="absolute top-0.5 h-4 w-4 rounded-full bg-[var(--bg-base)] transition-[left]" style={{ left: config.scim.enabled ? "18px" : "2px" }} />
              </button>
            </div>

            <div>
              <div className="text-[13px] font-medium mb-1.5">SCIM endpoint</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[12px] font-mono-tabular flex items-center truncate">
                  {scimEndpoint}
                </div>
                <button
                  onClick={() => copy(scimEndpoint, "endpoint")}
                  className="h-9 w-9 grid place-items-center rounded-[8px] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)]"
                >
                  {copied === "endpoint" ? <Check className="h-3.5 w-3.5 text-[var(--accent)]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <div className="text-[13px] font-medium mb-1.5">Bearer token</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[12px] font-mono-tabular flex items-center truncate">
                  {config.scim.token}
                </div>
                <button
                  onClick={() => copy(config.scim.token, "token")}
                  className="h-9 w-9 grid place-items-center rounded-[8px] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)]"
                >
                  {copied === "token" ? <Check className="h-3.5 w-3.5 text-[var(--accent)]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={rotateToken}
                  className="h-9 w-9 grid place-items-center rounded-[8px] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)]"
                  aria-label="Rotate token"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1.5">Paste this into your IdP's SCIM provisioning settings.</div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-[12px] text-[var(--text-secondary)]">JIT default role</label>
              <select
                value={config.scim.defaultRole}
                onChange={(e) => updateScim({ defaultRole: e.target.value as ScimConfig["defaultRole"] })}
                className="h-8 px-2 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[12px]"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="jit"
                type="checkbox"
                checked={config.scim.jitProvisioning}
                onChange={(e) => updateScim({ jitProvisioning: e.target.checked })}
                className="accent-[var(--accent)]"
              />
              <label htmlFor="jit" className="text-[12px] text-[var(--text-secondary)]">Just-in-time provisioning on first SSO sign-in</label>
            </div>

            <button
              onClick={testScim}
              disabled={testing}
              className="w-full h-9 rounded-[8px] border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] inline-flex items-center justify-center gap-2"
            >
              {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
              Test directory connection
            </button>

            {config.scim.lastSyncedAt && (
              <div className="text-[11px] text-[var(--text-secondary)]">
                Last check: {formatTime(config.scim.lastSyncedAt)} · {" "}
                <span className={config.scim.lastStatus === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                  {config.scim.lastStatus}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Access mode */}
      <SectionHeader title="Access mode" />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-[var(--accent-muted)] text-[var(--text-accent)]">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[14px] font-semibold">Password login</div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                {config.passwordLoginEnabled
                  ? "Users can sign in with email and password alongside SSO."
                  : "SSO is required for every user; password login is disabled."}
              </div>
            </div>
          </div>
          <button
            onClick={togglePasswordLogin}
            className="h-9 px-4 rounded-[8px] border border-[var(--border-default)] text-[13px] hover:border-[var(--border-strong)] inline-flex items-center gap-2"
          >
            {config.passwordLoginEnabled ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {config.passwordLoginEnabled ? "Disable password login" : "Allow password login"}
          </button>
        </div>
      </div>

      {/* Audit trail */}
      <SectionHeader title="Recent auth events" />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
        {audit.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--text-secondary)]">No events recorded yet.</div>
        ) : (
          audit.slice(0, 8).map((ev) => (
            <div key={ev.id} className="px-4 py-3 flex flex-wrap gap-2 sm:items-center justify-between">
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{ev.action}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">{ev.details}</div>
              </div>
              <div className="text-[11px] font-mono-tabular text-[var(--text-muted)]">{ev.actor} · {formatTime(ev.timestamp)}</div>
            </div>
          ))
        )}
      </div>

      <div className="text-[11px] text-[var(--text-secondary)] mt-4 leading-relaxed">
        Note: The live SAML integration uses Supabase's{" "}
        <a href="https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml" target="_blank" rel="noreferrer" className="text-[var(--text-accent)] hover:underline inline-flex items-center gap-1">
          <code>signInWithSSO</code> <ExternalLink className="h-3 w-3" />
        </a>{" "}
        API. Configure the provider above, then users from the matched domain will see a "Sign in with SSO" option on the login page. SCIM endpoints are registered under <code>/api/public/scim/v2</code> for directory sync.
      </div>
    </>
  );
}
