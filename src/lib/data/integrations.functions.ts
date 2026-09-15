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

/** Connect a vendor by storing its API key server-side. Only the key's last 4 characters are ever returned. */
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
          api_key: data.apiKey,
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
    return mask(row as Record<string, unknown>);
  });

/** Disconnect (delete) a vendor connection. */
export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idInput.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("integrations").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to disconnect: ${error.message}`);
    return { id: data.id };
  });

/** Re-verify a stored connection — checks a key exists and refreshes its status/timestamp. */
export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error: readError } = await supabase
      .from("integrations")
      .select("id, api_key")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(`Failed to load integration: ${readError.message}`);
    const ok = typeof row.api_key === "string" && row.api_key.length >= 8;
    const status = ok ? "active" : "error";
    const { error } = await supabase
      .from("integrations")
      .update({ status, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(`Failed to update integration: ${error.message}`);
    return { id: data.id, status };
  });
