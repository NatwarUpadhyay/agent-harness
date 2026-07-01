import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AgentRow = Database["public"]["Tables"]["agents"]["Row"];
export type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];
export type ToolRow = Database["public"]["Tables"]["tools"]["Row"];
export type ToolInsert = Database["public"]["Tables"]["tools"]["Insert"];
export type WorkflowRow = Database["public"]["Tables"]["workflows"]["Row"];
export type WorkflowInsert = Database["public"]["Tables"]["workflows"]["Insert"];
export type ExperimentRow = Database["public"]["Tables"]["experiments"]["Row"];

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

// ---------- AGENTS ----------
export const agentsKey = ["agents"] as const;

export function useAgents() {
  return useQuery({
    queryKey: agentsKey,
    queryFn: async (): Promise<AgentRow[]> => {
      const { data, error } = await supabase
        .from("agents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<AgentInsert, "user_id">) => {
      const user_id = await currentUserId();
      const { data, error } = await supabase
        .from("agents").insert({ ...input, user_id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: agentsKey }),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: agentsKey }),
  });
}

// ---------- TOOLS ----------
export const toolsKey = ["tools"] as const;

export function useTools() {
  return useQuery({
    queryKey: toolsKey,
    queryFn: async (): Promise<ToolRow[]> => {
      const { data, error } = await supabase
        .from("tools").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ToolInsert, "user_id">) => {
      const user_id = await currentUserId();
      const { data, error } = await supabase
        .from("tools").insert({ ...input, user_id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: toolsKey }),
  });
}

export function useDeleteTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: toolsKey }),
  });
}

// ---------- WORKFLOWS ----------
export const workflowsKey = ["workflows"] as const;

export function useWorkflows() {
  return useQuery({
    queryKey: workflowsKey,
    queryFn: async (): Promise<WorkflowRow[]> => {
      const { data, error } = await supabase
        .from("workflows").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<WorkflowInsert, "user_id">) => {
      const user_id = await currentUserId();
      const payload = { ...input, user_id };
      const { data, error } = input.id
        ? await supabase.from("workflows").update(payload).eq("id", input.id).select().single()
        : await supabase.from("workflows").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowsKey }),
  });
}

// ---------- EXPERIMENTS ----------
export const experimentsKey = ["experiments"] as const;

export function useExperiments() {
  return useQuery({
    queryKey: experimentsKey,
    queryFn: async (): Promise<ExperimentRow[]> => {
      const { data, error } = await supabase
        .from("experiments").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------- COUNTS (aggregated) ----------
export function useEntityCounts() {
  const a = useAgents();
  const t = useTools();
  const w = useWorkflows();
  const e = useExperiments();
  return {
    agents: a.data?.length ?? 0,
    tools: t.data?.length ?? 0,
    workflows: w.data?.length ?? 0,
    experiments: e.data?.length ?? 0,
    loading: a.isLoading || t.isLoading || w.isLoading || e.isLoading,
  };
}
