import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enterpriseAuthSchema, type EnterpriseAuth } from "./enterprise-auth";

export const getEnterpriseAuth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("org_settings")
      .select("config")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load org settings: ${error.message}`);
    }

    return enterpriseAuthSchema.parse(data?.config ?? {});
  });

export const saveEnterpriseAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => enterpriseAuthSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("org_settings")
      .upsert(
        {
          user_id: userId,
          config: data as unknown as import("@/integrations/supabase/types").Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (error) {
      throw new Error(`Failed to save org settings: ${error.message}`);
    }

    return data;
  });

export type { EnterpriseAuth } from "./enterprise-auth";
