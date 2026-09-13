import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type PromptVersion = {
  version: string;
  body: string;
  note?: string;
  createdAt: number;
};

export type WorkspacePrompt = Database["public"]["Tables"]["prompts"]["Row"] & {
  versions: PromptVersion[];
};

const versionSchema = z.object({
  version: z.string(),
  body: z.string(),
  note: z.string().optional(),
  createdAt: z.number(),
});

const createInput = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(100),
  tags: z.array(z.string()).default([]),
  body: z.string().min(1).max(20000),
});

const saveVersionInput = z.object({
  id: z.string().uuid(),
  body: z.string().min(1).max(20000),
  note: z.string().max(500).optional(),
});

const deleteInput = z.object({ id: z.string().uuid() });

function parseVersions(versions: unknown): PromptVersion[] {
  if (!Array.isArray(versions)) return [];
  return versions
    .map((v) => {
      const parsed = versionSchema.safeParse(v);
      return parsed.success ? parsed.data : null;
    })
    .filter(Boolean) as PromptVersion[];
}

function bumpVersion(prev?: string): string {
  if (!prev) return "v1.0";
  const m = /v(\d+)\.(\d+)/.exec(prev);
  if (!m) return "v1.0";
  return `v${m[1]}.${Number(m[2]) + 1}`;
}

/** List prompts visible to the current user's workspace. */
export const listWorkspacePrompts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prompts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`Failed to load prompts: ${error.message}`);
    return (data ?? []).map((p) => ({ ...p, versions: parseVersions(p.versions) }));
  });

/** Create or update a workspace-scoped prompt. Sharing the same name again appends a new version instead of creating a duplicate. */
export const createWorkspacePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: existing, error: findError } = await supabase
      .from("prompts")
      .select("id, versions")
      .eq("owner_id", userId)
      .ilike("name", data.name)
      .maybeSingle();
    if (findError) throw new Error(`Failed to look up prompt: ${findError.message}`);

    if (existing) {
      const versions = parseVersions(existing.versions);
      const last = versions[versions.length - 1];
      if (last && last.body === data.body) {
        return { id: existing.id, unchanged: true };
      }
      const nextVersion = bumpVersion(last?.version);
      const nextVersions: PromptVersion[] = [
        ...versions,
        { version: nextVersion, body: data.body, note: "Shared from prompt library", createdAt: Date.now() },
      ];
      const { error } = await supabase
        .from("prompts")
        .update({
          versions: nextVersions as unknown as import("@/integrations/supabase/types").Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(`Failed to update shared prompt: ${error.message}`);
      return { id: existing.id, version: nextVersion };
    }

    const { data: row, error } = await supabase
      .from("prompts")
      .insert({
        owner_id: userId,
        user_id: userId,
        name: data.name,
        category: data.category,
        tags: data.tags,
        versions: [{ version: "v1.0", body: data.body, note: "Shared from prompt library", createdAt: Date.now() }] as unknown as import("@/integrations/supabase/types").Json,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to create prompt: ${error.message}`);
    return { ...row, versions: parseVersions(row.versions) };
  });

/** Append a new version to a workspace prompt. */
export const saveWorkspacePromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveVersionInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: existing, error: readError } = await supabase
      .from("prompts")
      .select("versions")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(`Failed to load prompt: ${readError.message}`);

    const versions = parseVersions(existing.versions);
    const last = versions[versions.length - 1];
    if (last && last.body === data.body) {
      return { id: data.id, unchanged: true };
    }
    const nextVersion = bumpVersion(last?.version);
    const nextVersions: PromptVersion[] = [
      ...versions,
      { version: nextVersion, body: data.body, note: data.note, createdAt: Date.now() },
    ];

    const { error } = await supabase
      .from("prompts")
      .update({ versions: nextVersions as unknown as import("@/integrations/supabase/types").Json })
      .eq("id", data.id);
    if (error) throw new Error(`Failed to save version: ${error.message}`);
    return { id: data.id, version: nextVersion };
  });

/** Delete a workspace prompt. */
export const deleteWorkspacePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deleteInput.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("prompts").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete prompt: ${error.message}`);
    return { id: data.id };
  });
