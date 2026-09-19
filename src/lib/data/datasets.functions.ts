import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StoredDataset = {
  id: string;
  name: string;
  kind: string;
  rows: number;
  columns: string[];
  sizeBytes: number;
  preview: Record<string, string>[];
  truncated: boolean;
  source: "seed" | "upload";
  createdAt: number;
  owner_id: string;
};

const saveInput = z.object({
  name: z.string().min(1).max(300),
  kind: z.string().min(1).max(20),
  rows: z.number().int().min(0),
  columns: z.array(z.string().max(200)).max(200),
  sizeBytes: z.number().int().min(0),
  preview: z.array(z.record(z.string(), z.string())).max(50),
  truncated: z.boolean(),
});

const idInput = z.object({ id: z.string().uuid() });

type SupabaseCtx = { supabase: { from: (t: string) => any } };

async function resolveOwnerId(supabase: SupabaseCtx["supabase"], userId: string): Promise<string> {
  const { data } = await supabase
    .from("team_members")
    .select("owner_id")
    .eq("user_id", userId)
    .neq("owner_id", userId)
    .limit(1);
  const row = Array.isArray(data) ? data[0] : null;
  return (row?.owner_id as string) ?? userId;
}

function normalize(row: Record<string, unknown>): StoredDataset {
  return {
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as string,
    rows: Number(row.row_count ?? 0),
    columns: Array.isArray(row.columns) ? (row.columns as string[]) : [],
    sizeBytes: Number(row.size_bytes ?? 0),
    preview: Array.isArray(row.preview) ? (row.preview as Record<string, string>[]) : [],
    truncated: Boolean(row.truncated),
    source: (row.source as "seed" | "upload") ?? "upload",
    createdAt: Date.parse(row.created_at as string),
    owner_id: row.owner_id as string,
  };
}

/** Dataset library shared across the workspace. */
export const listDatasets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("datasets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(`Failed to load datasets: ${error.message}`);
    return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
  });

/** Save a parsed dataset (metadata + up to 50 preview rows) to the workspace library. */
export const saveDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const ownerId = await resolveOwnerId(supabase, userId);
    const { data: row, error } = await supabase
      .from("datasets")
      .insert({
        owner_id: ownerId,
        user_id: userId,
        name: data.name,
        kind: data.kind,
        row_count: data.rows,
        columns: data.columns,
        size_bytes: data.sizeBytes,
        preview: data.preview,
        truncated: data.truncated,
        source: "upload",
      })
      .select("*")
      .single();
    if (error) throw new Error(`Failed to save dataset: ${error.message}`);
    return normalize(row as Record<string, unknown>);
  });

/** Delete a dataset (workspace owner only, enforced by row-level policy). */
export const deleteDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idInput.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("datasets").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete dataset: ${error.message}`);
    return { id: data.id };
  });
