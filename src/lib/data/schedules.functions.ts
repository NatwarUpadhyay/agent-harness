import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nextRunAt, type Recurrence } from "./schedules";

const recurrenceEnum = z.enum(["every_15m", "hourly", "every_6h", "daily", "weekly"]);

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workflow_schedules")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to load schedules: ${error.message}`);
    return data ?? [];
  });

export const createSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        workflowId: z.string().uuid(),
        name: z.string().min(1).max(120),
        triggerKind: z.enum(["recurring", "webhook"]),
        recurrence: recurrenceEnum,
        input: z.string().max(4000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: workflow, error: wfError } = await context.supabase
      .from("workflows")
      .select("id, name")
      .eq("id", data.workflowId)
      .maybeSingle();
    if (wfError) throw new Error(`Failed to load workflow: ${wfError.message}`);
    if (!workflow) throw new Error("Workflow not found");

    const { data: row, error } = await context.supabase
      .from("workflow_schedules")
      .insert({
        user_id: context.userId,
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        name: data.name,
        trigger_kind: data.triggerKind,
        recurrence: data.recurrence,
        input: data.input,
        next_run_at: nextRunAt(data.recurrence as Recurrence).toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to create schedule: ${error.message}`);
    return row;
  });

export const toggleSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("workflow_schedules")
      .update({ enabled: data.enabled })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update schedule: ${error.message}`);
    return row;
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("workflow_schedules").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete schedule: ${error.message}`);
    return { id: data.id };
  });

/** Fires a schedule immediately, as the cron tick would. */
export const triggerScheduleNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("workflow_schedules")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(`Failed to load schedule: ${error.message}`);
    if (!row) throw new Error("Schedule not found");

    const { executeSchedule } = await import("./scheduler.server");
    return executeSchedule(row as never);
  });
