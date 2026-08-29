import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type ActivityKind =
  | "budget_breach"
  | "remediation_applied"
  | "alert_escalated"
  | "slo_breach"
  | "run_completed"
  | "info"
  | "deploy"
  | "warning"
  | "success";

export interface ActivityEvent {
  id: string;
  user_id: string;
  kind: ActivityKind;
  title: string;
  body: string;
  metadata: Json;
  read: boolean;
  created_at: string;
  updated_at: string;
}

const kindSchema = z.enum([
  "budget_breach",
  "remediation_applied",
  "alert_escalated",
  "slo_breach",
  "run_completed",
  "info",
  "deploy",
  "warning",
  "success",
]);

const createSchema = z.object({
  kind: kindSchema,
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(500),
  metadata: z.record(z.unknown()).default({}),
});

const idSchema = z.object({ id: z.string().uuid() });

function toActivity(row: Record<string, unknown>): ActivityEvent {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    kind: String(row.kind) as ActivityKind,
    title: String(row.title),
    body: String(row.body),
    metadata: (row.metadata ?? {}) as Json,
    read: Boolean(row.read),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** List the authenticated user's activity events, newest first. */
export const listActivityEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("activity_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Failed to load activity: ${error.message}`);
    return (data ?? []).map(toActivity);
  });

/** Create a new activity event for the authenticated user. */
export const createActivityEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("activity_events")
      .insert({ ...data, metadata: data.metadata as Json, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(`Failed to create activity event: ${error.message}`);
    return toActivity(row);
  });

/** Mark a single activity event as read. */
export const markActivityRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("activity_events")
      .update({ read: true })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(`Failed to mark activity read: ${error.message}`);
    return toActivity(row);
  });

/** Mark all activity events as read for the authenticated user. */
export const markAllActivityRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("activity_events")
      .update({ read: true })
      .eq("user_id", context.userId)
      .eq("read", false);
    if (error) throw new Error(`Failed to mark all activity read: ${error.message}`);
    return { updated: true };
  });
