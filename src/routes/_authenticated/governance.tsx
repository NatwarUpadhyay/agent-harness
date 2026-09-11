import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Gavel, Users, Plus, Trash2, ShieldCheck, KeyRound, Building2, Check, X,
  Clock, Lock, Globe, Download, Loader2,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { getOrgRoles, updateOrgRole, removeOrgRole, ensureOwnerRole, type AppRole, type OrgRole, CAPABILITIES } from "@/lib/data/rbac.functions";
import { inviteTeamMember } from "@/lib/data/team.functions";

type ReqStatus = "pending" | "approved" | "denied";
type RoleFilter = AppRole | "all";

interface AccessRequest {
  id: string;
  requester: string;
  resource: string;
  reason: string;
  requestedRole: AppRole;
  status: ReqStatus;
  created: string;
}

interface GovSettings {
  ssoEnforced: boolean;
  scimEnabled: boolean;
  mfaRequired: boolean;
  ipAllowlist: boolean;
  residency: "us" | "eu" | "in";
  retentionDays: number;
  approvalRequired: boolean;
}

const ROLES: AppRole[] = ["owner", "admin", "operator", "analyst", "viewer"];

const CAPABILITY_ROWS: { key: keyof typeof CAPABILITIES; label: string }[] = [
  { key: "view", label: "View dashboards & traces" },
  { key: "run", label: "Run harness simulations" },
  { key: "edit", label: "Edit workflows & prompts" },
  { key: "deploy", label: "Promote deployments" },
  { key: "keys", label: "Manage API keys & secrets" },
  { key: "budget", label: "Set budgets & spend caps" },
  { key: "members", label: "Invite & remove members" },
  { key: "billing", label: "Billing & org deletion" },
];

const SEED_REQUESTS: AccessRequest[] = [
  { id: "r1", requester: "Mei Tanaka",  resource: "Prompt library (prod)", reason: "Needs to ship eval prompts for the RAG rollout.", requestedRole: "operator", status: "pending", created: "12m ago" },
  { id: "r2", requester: "Omar Haddad", resource: "Usage & cost export",   reason: "Quarterly FinOps reconciliation.",               requestedRole: "analyst",  status: "pending", created: "2h ago" },
  { id: "r3", requester: "Dan Whitfield", resource: "API keys (staging)",  reason: "Rotating the support-bot key.",                   requestedRole: "admin",    status: "approved", created: "1d ago" },
];

const DEFAULTS: GovSettings = {
  ssoEnforced: true, scimEnabled: false, mfaRequired: true,
  ipAllowlist: false, residency: "us", retentionDays: 365, approvalRequired: true,
};

const RK = "harness.governance.requests.v1";
const SK = "harness.governance.settings.v1";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function save(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

const roleColor: Record<AppRole, string> = {
  owner: "var(--danger)", admin: "var(--warning)", operator: "var(--accent)",
  analyst: "var(--teal)", viewer: "var(--text-secondary)",
};

export const Route = createFileRoute("/_authenticated/governance")({
  head: () => ({
    meta: [
      { title: "Governance — Roles, SSO & access approvals | Harness" },
      { name: "description", content: "Org-scoped governance for AI agents: role capability matrix, member roles, SSO/SCIM enforcement, data residency, retention, and access approvals." },
      { property: "og:title", content: "Governance — Harness" },
      { property: "og:description", content: "Role matrix, SSO/SCIM enforcement, data residency and access approvals for enterprise AI agent fleets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GovernancePage,
});

function GovernancePage() {
  const qc = useQueryClient();
  const fetchRoles = useServerFn(getOrgRoles);
  const setRoleFn = useServerFn(updateOrgRole);
  const removeRoleFn = useServerFn(removeOrgRole);
  const inviteFn = useServerFn(inviteTeamMember);
  const ensureOwner = useServerFn(ensureOwnerRole);

  const rolesQuery = useQuery({
    queryKey: ["org-roles"],
    queryFn: () => fetchRoles(),
  });
  const members = rolesQuery.data ?? [];

  useEffect(() => {
    ensureOwner().catch(() => {});
  }, [ensureOwner]);

  const [requests, setRequests] = useState<AccessRequest[]>(SEED_REQUESTS);
  const [settings, setSettings] = useState<GovSettings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", team: "Platform", role: "viewer" as AppRole });
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  useEffect(() => {
    setRequests(load(RK, SEED_REQUESTS));
    setSettings({ ...DEFAULTS, ...load(SK, DEFAULTS) });
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) save(RK, requests); }, [requests, hydrated]);
  useEffect(() => { if (hydrated) save(SK, settings); }, [settings, hydrated]);

  const pending = requests.filter((r) => r.status === "pending").length;
  const shown = useMemo(
    () => (roleFilter === "all" ? members : members.filter((m) => m.role === roleFilter)),
    [members, roleFilter],
  );
  const privileged = members.filter((m) => m.role === "owner" || m.role === "admin").length;

  const INVITABLE_ROLES: AppRole[] = ["admin", "operator", "analyst", "viewer"];

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!draft.email.trim()) throw new Error("Email is required");
      return inviteFn({ data: { email: draft.email, role: draft.role } });
    },
    onSuccess: () => {
      toast.success(`Invite sent to ${draft.email.trim()}`);
      setDraft({ name: "", email: "", team: "Platform", role: "viewer" });
      setInviteOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Invite failed"),
  });

  const addMember = () => {
    if (!draft.name.trim() || !draft.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    inviteMutation.mutate();
  };

  const roleMutation = useMutation({
    mutationFn: ({ user_id, role }: { user_id: string; role: AppRole }) => setRoleFn({ data: { user_id, role } }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["org-roles"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update role"),
  });

  const removeMutation = useMutation({
    mutationFn: (user_id: string) => removeRoleFn({ data: { user_id } }),
    onSuccess: () => {
      toast.message("Member governance role removed");
      qc.invalidateQueries({ queryKey: ["org-roles"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove member"),
  });

  const decide = (id: string, status: ReqStatus) => {
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    const r = requests.find((x) => x.id === id);
    toast[status === "approved" ? "success" : "message"](
      `${r?.resource ?? "Request"} ${status}`,
    );
  };

  const toggle = (key: keyof GovSettings, label: string) => {
    setSettings((s) => {
      const next = !s[key];
      toast[next ? "success" : "message"](`${label} ${next ? "enforced" : "relaxed"}`);
      return { ...s, [key]: next };
    });
  };

  const exportMatrix = () => {
    const header = ["capability", ...ROLES].join(",");
    const rows = CAPABILITY_ROWS.map((c) =>
      [c.label, ...ROLES.map((r) => (CAPABILITIES[c.key].includes(r) ? "allow" : "deny"))].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "harness-role-matrix.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Role matrix exported");
  };

  return (
    <>
      <PageHeader
        title="Governance"
        subtitle="Org-scoped access control — who can see, run, edit, deploy, and spend"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportMatrix}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[var(--border-default)] text-[13px] hover:bg-[var(--bg-elevated)]"
            >
              <Download className="h-3.5 w-3.5" /> Export matrix
            </button>
            <button
              onClick={() => setInviteOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Invite member
            </button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Members", value: String(members.length) },
          { icon: ShieldCheck, label: "Privileged", value: String(privileged) },
          { icon: Clock, label: "Pending approvals", value: String(pending) },
          { icon: Globe, label: "Data residency", value: settings.residency.toUpperCase() },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className="mt-2 text-[22px] font-medium tabular-nums">{k.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Invite form */}
      <AnimatePresence>
        {inviteOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Full name"
                className="h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px]"
              />
              <input
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="work@company.com"
                className="h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px]"
              />
              <input
                value={draft.team}
                onChange={(e) => setDraft({ ...draft, team: e.target.value })}
                placeholder="Team"
                className="h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px]"
              />
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as AppRole })}
                className="h-9 px-3 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px]"
              >
                {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                onClick={addMember}
                disabled={inviteMutation.isPending}
                className="h-9 px-3 rounded-[8px] bg-[var(--accent)] text-[var(--bg-base)] text-[13px] font-medium hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {inviteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Send invite
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capability matrix */}
      <SectionHeader title="Role capability matrix" />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-x-auto">
        <table className="w-full text-[13px] min-w-[560px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              <th className="text-left font-medium px-4 py-2.5">Capability</th>
              {ROLES.map((r) => (
                <th key={r} className="px-3 py-2.5 font-medium text-center">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {CAPABILITY_ROWS.map((c) => (
              <tr key={c.key} className="hover:bg-[var(--bg-elevated)]/40">
                <td className="px-4 py-2.5">{c.label}</td>
                {ROLES.map((r) => (
                  <td key={r} className="px-3 py-2.5 text-center">
                    {CAPABILITIES[c.key].includes(r) ? (
                      <Check className="h-3.5 w-3.5 mx-auto" style={{ color: "var(--teal)" }} />
                    ) : (
                      <X className="h-3.5 w-3.5 mx-auto text-[var(--text-secondary)]/40" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Members */}
      <SectionHeader
        title={`Members · ${shown.length}`}
        action={
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            aria-label="Filter by role"
            className="h-8 px-2 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[12px]"
          >
            <option value="all">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        }
      />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
        {rolesQuery.isLoading && (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" /> Loading members…
          </div>
        )}
        {!rolesQuery.isLoading && shown.map((m) => (
          <div key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div
              className="h-8 w-8 shrink-0 rounded-full grid place-items-center text-[11px] font-medium"
              style={{ background: `color-mix(in oklab, ${roleColor[m.role]} 18%, transparent)`, color: roleColor[m.role] }}
            >
              {(m.email ?? "?").split("@")[0]?.slice(0, 2).toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">{m.email ?? "Unknown member"}</div>
              <div className="text-[11px] text-[var(--text-secondary)] truncate">{m.user_id.slice(0, 8)} · added {new Date(m.created_at).toLocaleDateString()}</div>
            </div>
            <select
              value={m.role}
              onChange={(e) => roleMutation.mutate({ user_id: m.user_id, role: e.target.value as AppRole })}
              disabled={roleMutation.isPending}
              aria-label={`Role for ${m.email ?? m.user_id}`}
              className="h-8 px-2 rounded-[8px] bg-[var(--bg-base)] border border-[var(--border-default)] text-[12px] disabled:opacity-60"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={() => removeMutation.mutate(m.user_id)}
              disabled={removeMutation.isPending || m.role === "owner"}
              aria-label={`Remove ${m.email ?? m.user_id}`}
              className="h-8 w-8 grid place-items-center rounded-[8px] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!rolesQuery.isLoading && shown.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--text-secondary)]">No members with that role.</div>
        )}
      </div>

      {/* Access requests */}
      <SectionHeader title="Access requests" />
      <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <Gavel className="h-4 w-4 mt-0.5 text-[var(--text-secondary)]" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">
                {r.requester} → <span className="font-normal">{r.resource}</span>
                <span
                  className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                  style={{ background: `color-mix(in oklab, ${roleColor[r.requestedRole]} 14%, transparent)`, color: roleColor[r.requestedRole] }}
                >
                  {r.requestedRole}
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{r.reason} · {r.created}</div>
            </div>
            {r.status === "pending" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => decide(r.id, "approved")}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[8px] border border-[var(--border-default)] text-[12px] hover:bg-[var(--bg-elevated)]"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  onClick={() => decide(r.id, "denied")}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[8px] border border-[var(--border-default)] text-[12px] hover:bg-[var(--bg-elevated)]"
                >
                  <X className="h-3.5 w-3.5" /> Deny
                </button>
              </div>
            ) : (
              <span
                className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-sm"
                style={{
                  background: `color-mix(in oklab, ${r.status === "approved" ? "var(--teal)" : "var(--danger)"} 14%, transparent)`,
                  color: r.status === "approved" ? "var(--teal)" : "var(--danger)",
                }}
              >
                {r.status}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Org controls */}
      <SectionHeader title="Org controls" />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
          {([
            { key: "ssoEnforced", label: "Enforce SSO (SAML / OIDC)", icon: KeyRound, desc: "Block password logins; identity comes from your IdP." },
            { key: "scimEnabled", label: "SCIM provisioning", icon: Users, desc: "Auto-create and deactivate members from your directory." },
            { key: "mfaRequired", label: "Require MFA", icon: Lock, desc: "Second factor for every privileged action." },
            { key: "ipAllowlist", label: "IP allowlist", icon: Building2, desc: "Restrict access to corporate egress ranges." },
            { key: "approvalRequired", label: "Approval for elevation", icon: Gavel, desc: "Admin sign-off required before any role upgrade." },
          ] as { key: keyof GovSettings; label: string; icon: typeof KeyRound; desc: string }[]).map((c) => (
            <div key={String(c.key)} className="flex items-center gap-3 px-4 py-3">
              <c.icon className="h-4 w-4 text-[var(--text-secondary)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{c.label}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">{c.desc}</div>
              </div>
              <button
                role="switch"
                aria-checked={Boolean(settings[c.key])}
                aria-label={`Toggle ${c.label}`}
                onClick={() => toggle(c.key, c.label)}
                className="relative h-5 w-9 rounded-full transition-colors shrink-0"
                style={{ background: settings[c.key] ? "var(--accent)" : "var(--border-default)" }}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-[var(--bg-base)] transition-[left]"
                  style={{ left: settings[c.key] ? "18px" : "2px" }}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-5">
          <div>
            <div className="text-[13px] font-medium">Data residency</div>
            <div className="text-[11px] text-[var(--text-secondary)] mb-2">Region where traces, prompts, and datasets are stored.</div>
            <div className="flex gap-2">
              {(["us", "eu", "in"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => { setSettings((s) => ({ ...s, residency: r })); toast.success(`Residency set to ${r.toUpperCase()}`); }}
                  className="h-8 px-3 rounded-[8px] border text-[12px] uppercase tracking-wider"
                  style={{
                    borderColor: settings.residency === r ? "var(--accent)" : "var(--border-default)",
                    color: settings.residency === r ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[13px] font-medium">Trace retention</div>
            <div className="text-[11px] text-[var(--text-secondary)] mb-2">{settings.retentionDays} days before traces are purged.</div>
            <input
              type="range"
              min={30}
              max={730}
              step={30}
              value={settings.retentionDays}
              aria-label="Trace retention in days"
              onChange={(e) => setSettings((s) => ({ ...s, retentionDays: Number(e.target.value) }))}
              className="w-full accent-[var(--accent)]"
            />
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border-subtle)] pt-3">
            Governance roles are now enforced server-side in the database. Only the workspace owner can change roles; the capability matrix is evaluated by server functions before privileged actions are allowed.
          </div>
        </div>
      </div>
    </>
  );
}
