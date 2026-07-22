import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlowProvider,
  type Node, type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Hexagon, ArrowLeft } from "lucide-react";
import { nodeTypes } from "@/features/harness/HarnessCanvas";

export const Route = createFileRoute("/share/$id")({
  head: () => ({
    meta: [
      { title: "Shared workflow — Harness" },
      { name: "description", content: "A public read-only view of a Harness workflow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedWorkflowView,
});

async function fetchShared(id: string) {
  const { data, error } = await supabase
    .from("workflows")
    .select("id,name,nodes,edges,updated_at,is_public")
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function SharedWorkflowView() {
  const { id } = useParams({ from: "/share/$id" });
  const { data, isLoading, isError } = useQuery({
    queryKey: ["shared-workflow", id],
    queryFn: () => fetchShared(id),
  });

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-[var(--border-subtle)]">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--accent-muted)] text-[var(--text-accent)]">
            <Hexagon className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <span className="font-semibold tracking-tight text-[15px]">Harness</span>
        </Link>
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
          <span className="hidden sm:inline">Read-only shared view</span>
          <Link to="/" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5">
            <ArrowLeft className="h-3.5 w-3.5" /> Open Harness
          </Link>
        </div>
      </header>

      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 grid place-items-center text-[13px] text-[var(--text-muted)]">
            Loading workflow…
          </div>
        )}
        {(isError || (!isLoading && !data)) && (
          <div className="absolute inset-0 grid place-items-center px-4">
            <div className="max-w-md text-center">
              <h1 className="text-xl font-semibold">Workflow not available</h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                This workflow is private, was unshared, or doesn't exist.
              </p>
              <Link to="/" className="mt-6 inline-flex rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-base)]">
                Back home
              </Link>
            </div>
          </div>
        )}
        {data && (
          <>
            <div className="absolute top-3 left-3 z-10 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)]/90 backdrop-blur px-3 py-1.5">
              <div className="text-[13px] font-medium truncate max-w-[60vw]">{data.name}</div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono-tabular">
                Updated {new Date(data.updated_at).toLocaleDateString()}
              </div>
            </div>
            <ReactFlowProvider>
              <ReactFlow
                nodes={(data.nodes as unknown as Node[]) ?? []}
                edges={(data.edges as unknown as Edge[]) ?? []}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border-subtle)" />
                <MiniMap pannable zoomable className="!bg-[var(--bg-surface)]" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </ReactFlowProvider>
          </>
        )}
      </div>
    </div>
  );
}
