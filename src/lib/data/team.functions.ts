import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteInput = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

const revokeInput = z.object({
  id: z.string().uuid(),
});

const acceptInput = z.object({
  token: z.string().uuid(),
});

export interface TeamMember {
  id: string;
  email: string | null;
  role: string;
  status: "active";
  joined_at: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface TeamRoster {
  members: TeamMember[];
  invitations: TeamInvitation[];
}

/** Invite a new teammate by email. Idempotent per owner+email. */
export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inviteInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const email = data.email.toLowerCase().trim();

    // Prevent self-invite.
    const { data: me } = await supabase.auth.getUser();
    if (me?.user?.email?.toLowerCase() === email) {
      throw new Error("You cannot invite yourself.");
    }

    // Upsert invitation; refresh expiration if re-invited.
    const { error } = await supabase
      .from("team_invitations")
      .upsert(
        {
          owner_id: userId,
          email,
          role: data.role,
          status: "pending",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "owner_id,email" },
      );

    if (error) throw new Error(`Failed to invite member: ${error.message}`);

    return { ok: true, email };
  });

/** Revoke a pending invitation. */
export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => revokeInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("team_invitations")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", userId)
      .eq("status", "pending");

    if (error) throw new Error(`Failed to revoke invitation: ${error.message}`);
    return { ok: true };
  });

/** List active members and pending invitations for the owner's team. */
export const getTeamRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: members, error: membersError }, { data: invitations, error: invitesError }] = await Promise.all([
      supabase.from("team_members").select("id, email, role, created_at, user_id").eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("team_invitations").select("id, email, role, token, status, expires_at, created_at").eq("owner_id", userId).order("created_at", { ascending: false }),
    ]);

    if (membersError) throw new Error(`Failed to load members: ${membersError.message}`);
    if (invitesError) throw new Error(`Failed to load invitations: ${invitesError.message}`);

    return {
      members: (members ?? []).map((m) => ({
        id: m.id,
        email: m.email ?? null,
        role: m.role,
        status: "active" as const,
        joined_at: m.created_at,
      })),
      invitations: (invitations ?? []).map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        token: i.token,
        status: i.status,
        expires_at: i.expires_at,
        created_at: i.created_at,
      })),
    } satisfies TeamRoster;
  });

/** Accept a pending invitation by token (used by invitees after signing up). */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => acceptInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: invite, error } = await supabase
      .from("team_invitations")
      .select("owner_id, email, role, status, expires_at")
      .eq("token", data.token)
      .single();

    if (error || !invite) throw new Error("Invitation not found.");
    if (invite.status !== "pending") throw new Error(`Invitation is ${invite.status}.`);
    if (new Date(invite.expires_at) < new Date()) throw new Error("Invitation has expired.");

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.email || user.user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("This invitation was sent to a different email address.");
    }

    const { error: updateError } = await supabase
      .from("team_invitations")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("token", data.token);

    if (updateError) throw new Error(`Failed to accept invitation: ${updateError.message}`);

    const { error: memberError } = await supabase.from("team_members").insert({
      owner_id: invite.owner_id,
      user_id: userId,
      email: user.user.email,
      role: invite.role,
    });

    if (memberError) throw new Error(`Failed to join team: ${memberError.message}`);

    return { ok: true, owner_id: invite.owner_id };
  });

/** Auto-accept any pending invitations for the signed-in user (e.g. after OTP login). */
export const acceptPendingInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: user } = await supabase.auth.getUser();
    const email = user?.user?.email;
    if (!email) return { accepted: 0 };

    const { data: pending } = await supabase
      .from("team_invitations")
      .select("token")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .ilike("email", email);

    let accepted = 0;
    for (const invite of pending ?? []) {
      try {
        await supabase
          .from("team_invitations")
          .update({ status: "accepted", updated_at: new Date().toISOString() })
          .eq("token", invite.token);

        const { data: inv } = await supabase
          .from("team_invitations")
          .select("owner_id, role")
          .eq("token", invite.token)
          .single();

        if (inv) {
          await supabase.from("team_members").insert({
            owner_id: inv.owner_id,
            user_id: userId,
            email,
            role: inv.role,
          });
          accepted++;
        }
      } catch {
        // Continue accepting remaining invitations even if one fails.
      }
    }

    return { accepted };
  });
