import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import ReactFlow, {
  Background, BackgroundVariant, Controls, MiniMap, Handle, Position,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type NodeProps, type Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Database, Search, Wrench, ShieldCheck, RefreshCcw, ArrowRightCircle,
  Plus, Layout, Download, Trash2, X,
} from "lucide-react";

interface NodeData {
  label: string;
  subtitle: string;
  color: string;
  typeName: string;
  iconKey: IconKey;
  index: number;
  model: string;
  temperature: number;
  maxTokens: number;
}

type IconKey = "planner" | "memory" | "retriever" | "tools" | "evaluator" | "reflection" | "output";

const iconMap: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  planner: Brain,
  memory: Database,
  retriever: Search,
  tools: Wrench,
  evaluator: ShieldCheck,
  reflection: RefreshCcw,
  output: ArrowRightCircle,
};

interface NodeTypeDef {
  typeName: string;
  label: string;
  subtitle: string;
  color: string;
  iconKey: IconKey;
}

const NODE_TYPES: NodeTypeDef[] = [
  { typeName: "Planner",    label: "Planner",    subtitle: "GPT-4o / 0.8s avg",     color: "#4F7AFF", iconKey: "planner" },
  { typeName: "Memory",     label: "Memory",     subtitle: "Qdrant / 12k vectors",  color: "#8B5CF6", iconKey: "memory" },
  { typeName: "Retriever",  label: "Retriever",  subtitle: "Hybrid / top-8",        color: "#14B8A6", iconKey: "retriever" },
  { typeName: "Tools",      label: "Tools",      subtitle: "12 registered",         color: "#F59E0B", iconKey: "tools" },
  { typeName: "Evaluator",  label: "Evaluator",  subtitle: "5 evals · pass-gate",   color: "#22C55E", iconKey: "evaluator" },
  { typeName: "Reflection", label: "Reflection", subtitle: "Claude 3.5 / 1.2s",     color: "#8B5CF6", iconKey: "reflection" },
  { typeName: "Output",     label: "Output",     subtitle: "Stream · JSON",         color: "rgba(255,255,255,0.4)", iconKey: "output" },
];

function HarnessNode({ data, selected }: NodeProps<NodeData>) {
  const Icon = iconMap[data.iconKey];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(data.index, 8) * 0.04, duration: 0.3, ease: [0.16, 1, 0.32, 1] }}
      className="relative rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-visible"
      style={{
        width: 180, height: 90,
        borderLeft: `5px solid ${data.color}`,
        boxShadow: selected ? `0 0 0 2px var(--accent)` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} />
      {/* Running dot */}
      <span className="absolute top-2 right-2 flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-70 animate-ping" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
      </span>
      <div className="h-full px-3 py-2 flex flex-col justify-center overflow-hidden">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-[14px] font-semibold truncate">{data.label}</span>
        </div>
        <div className="text-[12px] text-[var(--text-secondary)] mt-1 truncate">{data.subtitle}</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </motion.div>
  );
}

const nodeTypes = { harness: HarnessNode };

const MODELS = ["GPT-4o", "Claude 3.5", "Gemini 1.5"];

const initialNodes: Node<NodeData>[] = NODE_TYPES.map((n, i) => ({
  id: `n${i}`,
  type: "harness",
  position: { x: i * 220, y: 120 },
  data: {
    label: n.label, subtitle: n.subtitle, color: n.color, iconKey: n.iconKey,
    typeName: n.typeName, index: i, model: "GPT-4o", temperature: 0.7, maxTokens: 2048,
  },
}));

const initialEdges: Edge[] = initialNodes.slice(0, -1).map((_, i) => ({
  id: `e${i}`, source: `n${i}`, target: `n${i + 1}`, animated: true,
}));

export function HarnessCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addBtnRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(initialNodes.length);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true }, eds)),
    [setEdges],
  );

  const updateSelected = useCallback((patch: Partial<NodeData>) => {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  }, [selectedId, setNodes]);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }, [selectedId, setNodes, setEdges]);

  const addNode = useCallback((def: NodeTypeDef) => {
    const id = `n${idCounter.current++}`;
    const newNode: Node<NodeData> = {
      id, type: "harness",
      position: { x: 400 + Math.random() * 80, y: 240 + Math.random() * 60 },
      data: {
        label: def.label, subtitle: def.subtitle, color: def.color, iconKey: def.iconKey,
        typeName: def.typeName, index: idCounter.current, model: "GPT-4o",
        temperature: 0.7, maxTokens: 2048,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setAddMenuOpen(false);
  }, [setNodes]);

  // Close add menu on outside click
  useEffect(() => {
    if (!addMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!addBtnRef.current?.contains(e.target as Node)) setAddMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [addMenuOpen]);

  return (
    <div className="relative h-[calc(100vh-180px)] min-h-[520px] rounded-[10px] border border-[var(--border-default)] overflow-hidden">
      {/* Floating toolbar */}
      <div
        className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-2 py-1.5 rounded-full border border-[var(--border-default)]"
        style={{
          background: "rgba(14,15,24,0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div ref={addBtnRef} className="relative">
          <button
            onClick={() => setAddMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[var(--accent)] text-white text-[12px] font-medium hover:bg-[var(--accent-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add node
          </button>
          <AnimatePresence>
            {addMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute top-10 left-0 w-52 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 shadow-lg z-20"
              >
                {NODE_TYPES.map((t) => {
                  const Icon = iconMap[t.iconKey];
                  return (
                    <button
                      key={t.typeName}
                      onClick={() => addNode(t)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--text-primary)] hover:bg-white/5 text-left"
                    >
                      <span className="h-2 w-2 rounded-sm" style={{ background: t.color }} />
                      <Icon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      {t.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5">
          <ArrowRightCircle className="h-3.5 w-3.5" /> Add edge
        </button>
        <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5">
          <Layout className="h-3.5 w-3.5" /> Auto layout
        </button>
        <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedId(node.id)}
        onPaneClick={() => setSelectedId(null)}
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

      {/* Selection panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.aside
            key="panel"
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.32, 1] }}
            className="absolute top-0 right-0 h-full w-[280px] border-l border-[var(--border-default)] bg-[var(--bg-surface)] z-20 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--border-default)]">
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Node</span>
              <button
                onClick={() => setSelectedId(null)}
                className="p-1 rounded hover:bg-white/5 text-[var(--text-secondary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Name</label>
                <input
                  value={selectedNode.data.label}
                  onChange={(e) => updateSelected({ label: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Type</label>
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium"
                    style={{ background: `${selectedNode.data.color}22`, color: selectedNode.data.color, border: `1px solid ${selectedNode.data.color}55` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: selectedNode.data.color }} />
                    {selectedNode.data.typeName}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Model</label>
                <select
                  value={selectedNode.data.model}
                  onChange={(e) => updateSelected({ model: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Temperature</label>
                  <span className="text-[12px] text-[var(--text-secondary)] tabular-nums">
                    {selectedNode.data.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={selectedNode.data.temperature}
                  onChange={(e) => updateSelected({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-[var(--accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Max tokens</label>
                <input
                  type="number" min={1}
                  value={selectedNode.data.maxTokens}
                  onChange={(e) => updateSelected({ maxTokens: parseInt(e.target.value || "0", 10) })}
                  className="w-full h-9 px-2.5 rounded-md bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border-default)]">
              <button
                onClick={removeSelected}
                className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-md border border-red-500/40 bg-red-500/10 text-red-400 text-[13px] font-medium hover:bg-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove node
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
