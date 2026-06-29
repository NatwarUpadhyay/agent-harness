import { useMemo } from "react";
import ReactFlow, {
  Background, BackgroundVariant, Controls, MiniMap, Handle, Position,
  type Node, type Edge, type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion } from "framer-motion";
import { Brain, Database, Search, Wrench, ShieldCheck, RefreshCcw, ArrowRightCircle, Plus, Layout, Download } from "lucide-react";

interface NodeData {
  label: string;
  subtitle: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  index: number;
}

function HarnessNode({ data, selected }: NodeProps<NodeData>) {
  const Icon = data.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: data.index * 0.04, duration: 0.3, ease: [0.16, 1, 0.32, 1] }}
      className="rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-hidden"
      style={{
        width: 180, height: 90,
        borderLeft: `5px solid ${data.color}`,
        boxShadow: selected ? `0 0 0 2px var(--accent)` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="h-full px-3 py-2 flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-[14px] font-semibold">{data.label}</span>
        </div>
        <div className="text-[12px] text-[var(--text-secondary)] mt-1">{data.subtitle}</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </motion.div>
  );
}

const nodeTypes = { harness: HarnessNode };

const nodeDefs: Array<Omit<NodeData, "index"> & { x: number }> = [
  { label: "Planner",    subtitle: "GPT-4o / 0.8s avg",     color: "#4F7AFF", icon: Brain,            x: 0 },
  { label: "Memory",     subtitle: "Qdrant / 12k vectors",  color: "#8B5CF6", icon: Database,         x: 220 },
  { label: "Retriever",  subtitle: "Hybrid / top-8",        color: "#14B8A6", icon: Search,           x: 440 },
  { label: "Tools",      subtitle: "12 registered",          color: "#F59E0B", icon: Wrench,           x: 660 },
  { label: "Evaluator",  subtitle: "5 evals · pass-gate",    color: "#22C55E", icon: ShieldCheck,      x: 880 },
  { label: "Reflection", subtitle: "Claude 3.5 / 1.2s",      color: "#8B5CF6", icon: RefreshCcw,       x: 1100 },
  { label: "Output",     subtitle: "Stream · JSON",          color: "rgba(255,255,255,0.16)", icon: ArrowRightCircle, x: 1320 },
];

export function HarnessCanvas() {
  const { nodes, edges } = useMemo(() => {
    const ns: Node<NodeData>[] = nodeDefs.map((n, i) => ({
      id: String(i),
      type: "harness",
      position: { x: n.x, y: 120 },
      data: { ...n, index: i },
    }));
    const es: Edge[] = nodeDefs.slice(0, -1).map((_, i) => ({
      id: `e${i}`, source: String(i), target: String(i + 1), animated: true,
    }));
    return { nodes: ns, edges: es };
  }, []);

  return (
    <div className="relative h-[calc(100vh-180px)] min-h-[520px] rounded-[10px] border border-[var(--border-default)] overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--accent)] text-white text-[12px] font-medium hover:bg-[var(--accent-hover)]">
          <Plus className="h-3.5 w-3.5" /> Add node
        </button>
        <button className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowRightCircle className="h-3.5 w-3.5" /> Add edge
        </button>
        <button className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <Layout className="h-3.5 w-3.5" /> Auto layout
        </button>
        <button className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.07)" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap pannable zoomable maskColor="rgba(9,9,15,0.85)" nodeColor={() => "#4F7AFF"} style={{ width: 160, height: 100 }} />
      </ReactFlow>
    </div>
  );
}
