import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppSupabaseClient = SupabaseClient<Database>;

export type AppRole = "owner" | "admin" | "operator" | "analyst" | "viewer";

/** Workspace-scoped role assigned to a user. */
export interface OrgRole {
  id: string;
  user_id: string;
  email: string | null;
  role: AppRole;
  created_at: string;
}

/** Capability keys used by the governance matrix and server-side enforcement. */
export const CAPABILITIES = {
  view: ["owner", "admin", "operator", "analyst", "viewer"] as AppRole[],
  run: ["owner", "admin", "operator", "analyst"] as AppRole[],
  edit: ["owner", "admin", "operator"] as AppRole[],
  deploy: ["owner", "admin"] as AppRole[],
  keys: ["owner", "admin"] as AppRole[],
  budget: ["owner", "admin"] as AppRole[],
  members: ["owner", "admin"] as AppRole[],
  billing: ["owner"] as AppRole[],
} as const;

export type Capability = keyof typeof CAPABILITIES;

const APP_ROLES: AppRole[] = ["owner", "admin", "operator", "analyst", "viewer"];

/** Map team invitation roles to governance roles. */
export function teamRoleToGovRole(teamRole: string): AppRole {
  if (teamRole === "admin") return "admin";
  if (teamRole === "viewer") return "viewer";
  return "operator";
}

/** Resolve the most privileged governance role a user holds in a workspace. */
export async function getEffectiveRole(
  supabase: AppSupabaseClient,
  userId: string,
  ownerId: string,
): Promise<AppRole> {
  if (userId === ownerId) return "owner";
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read role: ${error.message}`);
  return (data?.role as AppRole) ?? "viewer";
}

/** Throw if the caller lacks the required capability in the workspace. */
export async function requireCapability(
  supabase: AppSupabaseClient,
  userId: string,
  ownerId: string,
  capability: Capability,
): Promise<void> {
  const role = await getEffectiveRole(supabase, userId, ownerId);
  const allowed = CAPABILITIES[capability] ?? [];
  if (!allowed.includes(role)) {
    const minRole = allowed[0] ?? "owner";
    throw new Error(`You need ${minRole} permissions to ${capability}.`);
  }
}

/** Throw if the caller does not have one of the allowed roles in the workspace. */
export async function requireAnyRole(
  supabase: AppSupabaseClient,
  userId: string,
  ownerId: string,
  roles: AppRole[],
): Promise<void> {
  const role = await getEffectiveRole(supabase, userId, ownerId);
  if (!roles.includes(role)) {
    throw new Error(`You need ${roles.join(" or ")} permissions to perform this action.`);
  }
}

/** Ensure the authenticated user owns their personal workspace. */
export const ensureOwnerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_roles").upsert(
      { user_id: userId, owner_id: userId, role: "owner" },
      { onConflict: "user_id,owner_id" },
    );
    if (error) throw new Error(`Failed to seed owner role: ${error.message}`);
    return { ok: true };
  });

/** List governance roles for every member of the authenticated user's workspace. */
export const getOrgRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: members, error: membersError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("team_members").select("id, user_id, email, created_at").eq("owner_id", userId),
      supabase.from("user_roles").select("id, user_id, role, created_at").eq("owner_id", userId),
    ]);

    if (membersError) throw new Error(`Failed to load members: ${membersError.message}`);
    if (rolesError) throw new Error(`Failed to load roles: ${rolesError.message}`);

    const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r as { id: string; role: AppRole; created_at: string }]));

    const result: OrgRole[] = (members ?? []).map((m) => {
      const r = roleByUser.get(m.user_id);
      return {
        id: r?.id ?? m.id,
        user_id: m.user_id,
        email: m.email ?? null,
        role: r?.role ?? "viewer",
        created_at: r?.created_at ?? m.created_at,
      };
    });

    // Always include the owner themselves even if no team_members row exists yet.
    if (!result.some((r) => r.user_id === userId)) {
      const ownerRole = roleByUser.get(userId);
      result.push({
        id: ownerRole?.id ?? userId,
        user_id: userId,
        email: null,
        role: ownerRole?.role ?? "owner",
        created_at: ownerRole?.created_at ?? new Date().toISOString(),
      });
    }

    return result;
  });

const updateOrgRoleInput = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["owner", "admin", "operator", "analyst", "viewer"]),
});

/** Update a workspace member's governance role. Owner only. */
export const updateOrgRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateOrgRoleInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const targetUserId = data.user_id;

    // Owner-only via RLS, but double-check server side for clearer errors.
    const ownerRole = await getEffectiveRole(supabase, userId, userId);
    if (ownerRole !== "owner") throw new Error("Only the workspace owner can manage roles.");

    if (targetUserId === userId && data.role !== "owner") {
      throw new Error("You cannot downgrade yourself from owner.");
    }

    // Upsert because a member may not have a governance role row yet.
    const { error } = await supabase.from("user_roles").upsert(
      { user_id: targetUserId, owner_id: userId, role: data.role },
      { onConflict: "user_id,owner_id" },
    );
    if (error) throw new Error(`Failed to update role: ${error.message}`);
    return { ok: true };
  });

const removeOrgRoleInput = z.object({ user_id: z.string().uuid() });

/** Remove a workspace member's governance role. Owner only; cannot remove self. */
export const removeOrgRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => removeOrgRoleInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("You cannot remove your own owner role.");

    const ownerRole = await getEffectiveRole(supabase, userId, userId);
    if (ownerRole !== "owner") throw new Error("Only the workspace owner can remove members.");

    const { error } = await supabase.from("user_roles").delete().eq("user_id", data.user_id).eq("owner_id", userId);
    if (error) throw new Error(`Failed to remove role: ${error.message}`);
    return { ok: true };
  });

/** Server-side capability check for use by other server functions. */
export const checkCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      owner_id: z.string().uuid(),
      capability: z.enum(["view", "run", "edit", "deploy", "keys", "budget", "members", "billing"]),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await requireCapability(context.supabase, context.userId, data.owner_id, data.capability);
    return { allowed: true };
  });

export { APP_ROLES };
