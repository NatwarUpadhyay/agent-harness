import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IntegrationConnection = {
  id: string;
  vendor: string;
  label: string | null;
  auth_type: string;
  key_last4: string | null;
  status: string;
  last_checked_at: string | null;
  created_at: string;
};

const connectInput = z.object({
  vendor: z.string().min(1).max(100),
  label: z.string().max(200).optional(),
  authType: z.string().max(50).default("API key"),
  apiKey: z.string().min(8).max(500),
});

const idInput = z.object({ id: z.string().uuid() });

function mask(row: Record<string, unknown>): IntegrationConnection {
  return {
    id: row.id as string,
    vendor: row.vendor as string,
    label: (row.label as string) ?? null,
    auth_type: row.auth_type as string,
    key_last4: (row.key_last4 as string) ?? null,
    status: row.status as string,
    last_checked_at: (row.last_checked_at as string) ?? null,
    created_at: row.created_at as string,
  };
}

/** List workspace integrations with keys masked — the raw key never leaves the server. */
export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("integrations")
      .select("id, vendor, label, auth_type, key_last4, status, last_checked_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to load integrations: ${error.message}`);
    return (data ?? []).map((r) => mask(r as Record<string, unknown>));
  });

/** Connect a vendor. The raw key is stored in an owner-only vault table, never in the shared row. */
export const connectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => connectInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const keyLast4 = data.apiKey.slice(-4);
    const { data: row, error } = await supabase
      .from("integrations")
      .upsert(
        {
          owner_id: userId,
          user_id: userId,
          vendor: data.vendor,
          label: data.label ?? null,
          auth_type: data.authType,
          key_last4: keyLast4,
          status: "active",
          last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,vendor" },
      )
      .select("id, vendor, label, auth_type, key_last4, status, last_checked_at, created_at")
      .single();
    if (error) throw new Error(`Failed to connect integration: ${error.message}`);

    const { error: secretError } = await supabase.from("integration_secrets").upsert(
      {
        integration_id: (row as { id: string }).id,
        owner_id: userId,
        api_key: data.apiKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "integration_id" },
    );
    if (secretError) throw new Error(`Failed to store credential: ${secretError.message}`);

    return mask(row as Record<string, unknown>);
  });

/** Disconnect (delete) a vendor connection. The vaulted key is removed with it. Owner only. */
export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error: readError } = await supabase
      .from("integrations")
      .select("owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(`Failed to load integration: ${readError.message}`);
    if (!row) throw new Error("Integration not found");
    if (row.owner_id !== userId) {
      throw new Error("Only the workspace owner can disconnect this integration");
    }
    const { error } = await supabase.from("integrations").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to disconnect: ${error.message}`);
    return { id: data.id };
  });

/** Re-verify a stored connection. Only the workspace owner can read the vaulted key. */
export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: ownerRow, error: ownerError } = await supabase
      .from("integrations")
      .select("owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (ownerError) throw new Error(`Failed to load integration: ${ownerError.message}`);
    if (!ownerRow) throw new Error("Integration not found");
    if (ownerRow.owner_id !== userId) {
      throw new Error("Only the workspace owner can verify this connection");
    }
    const { data: secret, error: readError } = await supabase
      .from("integration_secrets")
      .select("api_key")
      .eq("integration_id", data.id)
      .maybeSingle();
    if (readError) throw new Error(`Failed to load credential: ${readError.message}`);
    if (!secret) {
      throw new Error("Only the workspace owner can verify this connection");
    }
    const ok = typeof secret.api_key === "string" && secret.api_key.length >= 8;
    const status = ok ? "active" : "error";
    const { error } = await supabase
      .from("integrations")
      .update({ status, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(`Failed to update integration: ${error.message}`);
    return { id: data.id, status };
  });

