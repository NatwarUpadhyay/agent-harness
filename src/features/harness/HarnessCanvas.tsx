import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import ReactFlow, {
  Background, BackgroundVariant, Controls, MiniMap, Handle, Position,
  useNodesState, useEdgesState, addEdge, useReactFlow, ReactFlowProvider,
  type Node, type Edge, type NodeProps, type Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Database, Search, Wrench, ShieldCheck, RefreshCcw, ArrowRightCircle,
  Plus, Layout, Download, Upload, Trash2, X, Save, FolderOpen, Play, Square,
  Undo2, Redo2, Sparkles, AlertTriangle, GripVertical, Copy, Pencil, Star, Share2, Globe,
} from "lucide-react";
import {
  useWorkflows, useSaveWorkflow, useDeleteWorkflow, useDuplicateWorkflow,
  useRenameWorkflow, useToggleWorkflowFavorite, useToggleWorkflowPublic, type WorkflowRow,
} from "@/lib/hooks/use-entities";

import { toast } from "sonner";
import { UsagePanel } from "./UsagePanel";
import { estimateNodeCost, recordRun, formatCost } from "@/lib/data/harness-usage";
import { PresenceCursors, PresenceAvatars, usePresence } from "./PresenceOverlay";

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
  simState?: "idle" | "active" | "done";
  disconnected?: boolean;
}

type IconKey = "planner" | "memory" | "retriever" | "tools" | "evaluator" | "reflection" | "output";

const iconMap: Record<IconKey, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  planner: Brain, memory: Database, retriever: Search, tools: Wrench,
  evaluator: ShieldCheck, reflection: RefreshCcw, output: ArrowRightCircle,
};

interface NodeTypeDef {
  typeName: string;
  label: string;
  subtitle: string;
  color: string;
  iconKey: IconKey;
  canBeSource: boolean;
  canBeTarget: boolean;
  latencyMs: number;
}

const NODE_TYPES: NodeTypeDef[] = [
  { typeName: "Planner",    label: "Planner",    subtitle: "GPT-4o / entry",       color: "#C7C7CC", iconKey: "planner",    canBeSource: true,  canBeTarget: false, latencyMs: 800 },
  { typeName: "Memory",     label: "Memory",     subtitle: "Qdrant / 12k vectors", color: "#8B5CF6", iconKey: "memory",     canBeSource: true,  canBeTarget: true,  latencyMs: 120 },
  { typeName: "Retriever",  label: "Retriever",  subtitle: "Hybrid / top-8",       color: "#14B8A6", iconKey: "retriever",  canBeSource: true,  canBeTarget: true,  latencyMs: 240 },
  { typeName: "Tools",      label: "Tools",      subtitle: "12 registered",        color: "#F59E0B", iconKey: "tools",      canBeSource: true,  canBeTarget: true,  latencyMs: 450 },
  { typeName: "Evaluator",  label: "Evaluator",  subtitle: "5 evals · pass-gate",  color: "#22C55E", iconKey: "evaluator",  canBeSource: true,  canBeTarget: true,  latencyMs: 320 },
  { typeName: "Reflection", label: "Reflection", subtitle: "Claude 3.5 / 1.2s",    color: "#8B5CF6", iconKey: "reflection", canBeSource: true,  canBeTarget: true,  latencyMs: 1200 },
  { typeName: "Output",     label: "Output",     subtitle: "Stream · JSON",        color: "rgba(255,255,255,0.4)", iconKey: "output", canBeSource: false, canBeTarget: true, latencyMs: 60 },
];

const TYPE_BY_NAME = Object.fromEntries(NODE_TYPES.map(t => [t.typeName, t])) as Record<string, NodeTypeDef>;

function HarnessNode({ data, selected }: NodeProps<NodeData>) {
  const Icon = iconMap[data.iconKey];
  const isActive = data.simState === "active";
  const isDone = data.simState === "done";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: isActive ? 1.04 : 1 }}
      transition={{ delay: Math.min(data.index, 8) * 0.04, duration: 0.3, ease: [0.16, 1, 0.32, 1] }}
      className="relative rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-default)] overflow-visible"
      style={{
        width: 180, height: 90,
        borderLeft: `5px solid ${data.color}`,
        boxShadow: selected
          ? `0 0 0 2px var(--accent)`
          : isActive ? `0 0 0 2px ${data.color}, 0 0 24px ${data.color}66`
          : isDone ? `0 0 0 1px ${data.color}55` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} />
      {data.disconnected && (
        <span className="absolute -top-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--danger,#ef4444)] text-white" title="Disconnected">
          <AlertTriangle className="h-2.5 w-2.5" />
        </span>
      )}
      <span className="absolute top-2 right-2 flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full rounded-full ${isActive ? "bg-[var(--accent)]" : "bg-[#22C55E]"} opacity-70 animate-ping`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? "bg-[var(--accent)]" : "bg-[#22C55E]"}`} />
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

function makeNode(def: NodeTypeDef, index: number, x: number, y: number): Node<NodeData> {
  return {
    id: `n${Math.random().toString(36).slice(2, 9)}`,
    type: "harness",
    position: { x, y },
    data: {
      label: def.label, subtitle: def.subtitle, color: def.color, iconKey: def.iconKey,
      typeName: def.typeName, index, model: "GPT-4o", temperature: 0.7, maxTokens: 2048,
      simState: "idle",
    },
  };
}

const initialNodes: Node<NodeData>[] = NODE_TYPES.map((n, i) => makeNode(n, i, i * 220, 120));
const initialEdges: Edge[] = initialNodes.slice(0, -1).map((n, i) => ({
  id: `e${i}`, source: n.id, target: initialNodes[i + 1].id, animated: true,
}));

// ---------- Templates ----------
function buildTemplate(sequence: string[]): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes = sequence.map((t, i) => makeNode(TYPE_BY_NAME[t], i, 80 + i * 220, 180));
  const edges = nodes.slice(0, -1).map((n, i) => ({
    id: `e${i}-${n.id}`, source: n.id, target: nodes[i + 1].id, animated: true,
  }));
  return { nodes, edges };
}

const TEMPLATES: Record<string, { label: string; description: string; build: () => { nodes: Node<NodeData>[]; edges: Edge[] } }> = {
  rag: { label: "RAG Pipeline", description: "Planner → Retriever → Memory → Output",
    build: () => buildTemplate(["Planner", "Retriever", "Memory", "Output"]) },
  research: { label: "Multi-Agent Research", description: "Planner → Retriever → Tools → Reflection → Output",
    build: () => buildTemplate(["Planner", "Retriever", "Tools", "Reflection", "Output"]) },
  eval: { label: "Eval Loop", description: "Planner → Tools → Evaluator → Reflection → Output",
    build: () => buildTemplate(["Planner", "Tools", "Evaluator", "Reflection", "Output"]) },
};

export function HarnessCanvas() {
  return (
    <ReactFlowProvider>
      <HarnessCanvasInner />
    </ReactFlowProvider>
  );
}

function HarnessCanvasInner() {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadMenuOpen, setLoadMenuOpen] = useState(false);
  const [loadQuery, setLoadQuery] = useState("");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState<string>("Untitled workflow");
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && !window.localStorage.getItem("harness.onboarded.v1")) {
        setShowOnboarding(true);
      }
    } catch { /* ignore */ }
  }, []);
  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    try { window.localStorage.setItem("harness.onboarded.v1", "1"); } catch { /* ignore */ }
  }, []);
  const [simulating, setSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simLatency, setSimLatency] = useState(0);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const peers = usePresence(liveEnabled);
  const loadBtnRef = useRef<HTMLDivElement>(null);
  const templateBtnRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: savedWorkflows = [] } = useWorkflows();
  const saveWorkflow = useSaveWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const duplicateWorkflow = useDuplicateWorkflow();
  const renameWorkflow = useRenameWorkflow();
  const toggleFavorite = useToggleWorkflowFavorite();
  const togglePublic = useToggleWorkflowPublic();


  // ---------- Undo / redo history ----------
  const historyRef = useRef<{ nodes: Node<NodeData>[]; edges: Edge[] }[]>([{ nodes: initialNodes, edges: initialEdges }]);
  const historyIdxRef = useRef(0);
  const [, forceRender] = useState(0);
  const pushHistory = useCallback((n: Node<NodeData>[], e: Edge[]) => {
    const stack = historyRef.current.slice(0, historyIdxRef.current + 1);
    stack.push({ nodes: n, edges: e });
    if (stack.length > 40) stack.shift();
    historyRef.current = stack;
    historyIdxRef.current = stack.length - 1;
    forceRender(x => x + 1);
  }, []);
  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const s = historyRef.current[historyIdxRef.current];
    setNodes(s.nodes); setEdges(s.edges);
    forceRender(x => x + 1);
  }, [setNodes, setEdges]);
  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const s = historyRef.current[historyIdxRef.current];
    setNodes(s.nodes); setEdges(s.edges);
    forceRender(x => x + 1);
  }, [setNodes, setEdges]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedId) ?? null, [nodes, selectedId]);

  // ---------- Connection validation ----------
  const isValidConnection = useCallback((c: Connection | Edge): boolean => {
    if (!c.source || !c.target) return false;
    if (c.source === c.target) return false;
    const src = nodes.find(n => n.id === c.source);
    const tgt = nodes.find(n => n.id === c.target);
    if (!src || !tgt) return false;
    const srcDef = TYPE_BY_NAME[src.data.typeName];
    const tgtDef = TYPE_BY_NAME[tgt.data.typeName];
    if (!srcDef?.canBeSource || !tgtDef?.canBeTarget) return false;
    if (edges.some(e => e.source === c.source && e.target === c.target)) return false;
    return true;
  }, [nodes, edges]);

  const onConnect = useCallback((c: Connection) => {
    if (!isValidConnection(c)) {
      const src = nodes.find(n => n.id === c.source);
      const tgt = nodes.find(n => n.id === c.target);
      const reason = src && !TYPE_BY_NAME[src.data.typeName]?.canBeSource ? `${src.data.typeName} cannot be a source`
        : tgt && !TYPE_BY_NAME[tgt.data.typeName]?.canBeTarget ? `${tgt.data.typeName} cannot be a target`
        : "Invalid connection";
      toast.error(reason);
      return;
    }
    setEdges(eds => {
      const next = addEdge({ ...c, animated: true }, eds);
      pushHistory(nodes, next);
      return next;
    });
  }, [isValidConnection, setEdges, nodes, pushHistory]);

  const updateSelected = useCallback((patch: Partial<NodeData>) => {
    if (!selectedId) return;
    setNodes(nds => {
      const next = nds.map(n => n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n);
      pushHistory(next, edges);
      return next;
    });
  }, [selectedId, setNodes, edges, pushHistory]);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    const nextNodes = nodes.filter(n => n.id !== selectedId);
    const nextEdges = edges.filter(e => e.source !== selectedId && e.target !== selectedId);
    setNodes(nextNodes); setEdges(nextEdges);
    pushHistory(nextNodes, nextEdges);
    setSelectedId(null);
  }, [selectedId, nodes, edges, setNodes, setEdges, pushHistory]);

  // ---------- Node library drag & drop ----------
  const onDragStart = (ev: React.DragEvent, typeName: string) => {
    ev.dataTransfer.setData("application/harness-node", typeName);
    ev.dataTransfer.effectAllowed = "move";
  };
  const onDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    const typeName = ev.dataTransfer.getData("application/harness-node");
    const def = TYPE_BY_NAME[typeName];
    if (!def) return;
    // Convert screen coords -> flow coords so panning/zooming don't offset the drop.
    const position = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
    // Center the 180x90 node under the cursor.
    const newNode = makeNode(def, nodes.length, position.x - 90, position.y - 45);
    const next = [...nodes, newNode];
    setNodes(next);
    pushHistory(next, edges);
  }, [nodes, edges, setNodes, pushHistory, screenToFlowPosition]);
  const onDragOver = (ev: React.DragEvent) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; };

  // ---------- Close popovers ----------
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as unknown as globalThis.Node;
      if (loadMenuOpen && !loadBtnRef.current?.contains(t)) setLoadMenuOpen(false);
      if (templateMenuOpen && !templateBtnRef.current?.contains(t)) setTemplateMenuOpen(false);
    };
    if (loadMenuOpen || templateMenuOpen) {
      window.addEventListener("mousedown", onClick);
      return () => window.removeEventListener("mousedown", onClick);
    }
  }, [loadMenuOpen, templateMenuOpen]);

  // ---------- Save / load / export / import / template ----------
  const handleSave = useCallback(async () => {
    const name = prompt("Workflow name", workflowName) ?? workflowName;
    try {
      const result = await saveWorkflow.mutateAsync({
        id: currentWorkflowId ?? undefined,
        name,
        nodes: nodes as unknown as WorkflowRow["nodes"],
        edges: edges as unknown as WorkflowRow["edges"],
      });
      setCurrentWorkflowId(result.id);
      setWorkflowName(result.name);
      toast.success(`Workflow “${name}” saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }, [saveWorkflow, currentWorkflowId, workflowName, nodes, edges]);

  const handleLoad = useCallback((wf: WorkflowRow) => {
    const loadedNodes = (wf.nodes as unknown as Node<NodeData>[]) ?? [];
    const loadedEdges = (wf.edges as unknown as Edge[]) ?? [];
    setNodes(loadedNodes); setEdges(loadedEdges);
    setCurrentWorkflowId(wf.id); setWorkflowName(wf.name);
    setLoadMenuOpen(false);
    pushHistory(loadedNodes, loadedEdges);
    toast.success(`Loaded “${wf.name}”`);
  }, [setNodes, setEdges, pushHistory]);

  const applyTemplate = useCallback((key: keyof typeof TEMPLATES) => {
    const { nodes: n, edges: e } = TEMPLATES[key].build();
    setNodes(n); setEdges(e);
    setCurrentWorkflowId(null);
    setWorkflowName(TEMPLATES[key].label);
    setTemplateMenuOpen(false);
    pushHistory(n, e);
    toast.success(`Loaded template: ${TEMPLATES[key].label}`);
  }, [setNodes, setEdges, pushHistory]);

  const handleExport = useCallback(() => {
    const json = JSON.stringify({ name: workflowName, nodes, edges }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${workflowName.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [workflowName, nodes, edges]);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error("Invalid file");
        setNodes(parsed.nodes); setEdges(parsed.edges);
        setWorkflowName(parsed.name ?? "Imported workflow");
        setCurrentWorkflowId(null);
        pushHistory(parsed.nodes, parsed.edges);
        toast.success("Workflow imported");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    };
    reader.readAsText(file);
  }, [setNodes, setEdges, pushHistory]);

  // ---------- Disconnected node warnings ----------
  const disconnectedIds = useMemo(() => {
    if (nodes.length <= 1) return new Set<string>();
    const connected = new Set<string>();
    edges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    return new Set(nodes.filter(n => !connected.has(n.id)).map(n => n.id));
  }, [nodes, edges]);

  const nodesWithFlags = useMemo(() => nodes.map(n => ({
    ...n, data: { ...n.data, disconnected: disconnectedIds.has(n.id) },
  })), [nodes, disconnectedIds]);

  // ---------- Simulation ----------
  const stopSim = useCallback(() => {
    if (simTimerRef.current) { clearTimeout(simTimerRef.current); simTimerRef.current = null; }
    setSimulating(false); setSimStep(0);
    setEdges(eds => eds.map(e => ({ ...e, animated: true, style: undefined })));
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, simState: "idle" as const } })));
  }, [setEdges, setNodes]);

  const runSim = useCallback(() => {
    // Topological-ish order: BFS from source nodes (no incoming edges)
    const incoming = new Map<string, number>();
    nodes.forEach(n => incoming.set(n.id, 0));
    edges.forEach(e => incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1));
    const order: string[] = [];
    const queue = nodes.filter(n => (incoming.get(n.id) ?? 0) === 0).map(n => n.id);
    const remaining = new Map(incoming);
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      edges.filter(e => e.source === id).forEach(e => {
        remaining.set(e.target, (remaining.get(e.target) ?? 0) - 1);
        if ((remaining.get(e.target) ?? 0) === 0) queue.push(e.target);
      });
    }
    if (order.length === 0) { toast.error("Nothing to simulate"); return; }

    setSimulating(true); setSimStep(0); setSimLatency(0);
    let cumulative = 0;
    const perNode: { typeName: string; latencyMs: number; tokens: number; cost: number }[] = [];
    const step = (idx: number) => {
      if (idx >= order.length) {
        const totalTokens = perNode.reduce((s, n) => s + n.tokens, 0);
        const totalCost = perNode.reduce((s, n) => s + n.cost, 0);
        recordRun({
          workflowName, totalLatencyMs: cumulative, totalTokens, totalCost,
          nodeCount: nodes.length, edgeCount: edges.length, perNode,
        });
        toast.success(`Simulation complete · ${cumulative}ms · ${totalTokens.toLocaleString()} tok · ${formatCost(totalCost)}`);
        simTimerRef.current = setTimeout(() => {
          setSimulating(false); setSimStep(0);
          setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, simState: "idle" as const } })));
        }, 800);
        return;
      }
      const currentId = order[idx];
      const nodeDef = nodes.find(n => n.id === currentId);
      const typeName = nodeDef?.data.typeName ?? "Unknown";
      const lat = nodeDef ? TYPE_BY_NAME[typeName]?.latencyMs ?? 300 : 300;
      const { tokens, cost } = estimateNodeCost(typeName, lat);
      perNode.push({ typeName, latencyMs: lat, tokens, cost });
      cumulative += lat;
      setSimStep(idx + 1); setSimLatency(cumulative);
      setNodes(nds => nds.map(n => ({
        ...n,
        data: {
          ...n.data,
          simState: n.id === currentId ? "active" : order.slice(0, idx).includes(n.id) ? "done" : "idle",
        },
      })));
      setEdges(eds => eds.map(e => ({
        ...e,
        animated: true,
        style: e.target === currentId ? { stroke: "var(--accent)", strokeWidth: 2.5 } : undefined,
      })));
      // scale to something watchable
      const wait = Math.max(400, Math.min(1400, lat));
      simTimerRef.current = setTimeout(() => step(idx + 1), wait);
    };
    step(0);
  }, [nodes, edges, setNodes, setEdges, workflowName]);

  useEffect(() => () => { if (simTimerRef.current) clearTimeout(simTimerRef.current); }, []);

  // ---------- Auto layout (layered by topological rank) ----------
  const autoLayout = useCallback(() => {
    if (nodes.length === 0) { toast.error("Nothing to lay out"); return; }
    const incoming = new Map<string, number>();
    nodes.forEach(n => incoming.set(n.id, 0));
    edges.forEach(e => incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1));
    const rank = new Map<string, number>();
    const queue: string[] = nodes.filter(n => (incoming.get(n.id) ?? 0) === 0).map(n => n.id);
    queue.forEach(id => rank.set(id, 0));
    const remaining = new Map(incoming);
    while (queue.length) {
      const id = queue.shift()!;
      const r = rank.get(id) ?? 0;
      edges.filter(e => e.source === id).forEach(e => {
        rank.set(e.target, Math.max(rank.get(e.target) ?? 0, r + 1));
        remaining.set(e.target, (remaining.get(e.target) ?? 0) - 1);
        if ((remaining.get(e.target) ?? 0) === 0) queue.push(e.target);
      });
    }
    // Any leftover (cycles) get rank 0
    nodes.forEach(n => { if (!rank.has(n.id)) rank.set(n.id, 0); });
    const byRank = new Map<number, string[]>();
    nodes.forEach(n => {
      const r = rank.get(n.id) ?? 0;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(n.id);
    });
    const COL_W = 240, ROW_H = 130, X0 = 60, Y0 = 80;
    const next = nodes.map(n => {
      const r = rank.get(n.id) ?? 0;
      const col = byRank.get(r)!;
      const idxInCol = col.indexOf(n.id);
      const colHeight = (col.length - 1) * ROW_H;
      return { ...n, position: { x: X0 + r * COL_W, y: Y0 + idxInCol * ROW_H - colHeight / 2 + 240 } };
    });
    setNodes(next);
    pushHistory(next, edges);
    toast.success("Auto layout applied");
  }, [nodes, edges, setNodes, pushHistory]);

  const canUndo = historyIdxRef.current > 0;
  const canRedo = historyIdxRef.current < historyRef.current.length - 1;


  return (
    <div className="relative h-[calc(100vh-180px)] min-h-[560px] rounded-[10px] border border-[var(--border-default)] overflow-hidden flex">
      {/* Left node library rail */}
      <aside className="w-[200px] shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-surface)] flex flex-col">
        <div className="h-11 px-3 flex items-center border-b border-[var(--border-default)]">
          <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Node library</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {NODE_TYPES.map((t) => {
            const Icon = iconMap[t.iconKey];
            return (
              <div
                key={t.typeName}
                draggable
                onDragStart={(e) => onDragStart(e, t.typeName)}
                className="group flex items-center gap-2 px-2 py-2 rounded-md border border-transparent hover:border-[var(--border-default)] hover:bg-white/5 cursor-grab active:cursor-grabbing"
                style={{ borderLeft: `3px solid ${t.color}` }}
                title={t.subtitle}
              >
                <GripVertical className="h-3 w-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                <Icon className="h-3.5 w-3.5" style={{ color: t.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-[var(--text-primary)] truncate">{t.label}</div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">{t.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-2 border-t border-[var(--border-default)] text-[10px] text-[var(--text-muted)] leading-relaxed">
          Drag onto canvas.<br />Planner = entry · Output = sink.
        </div>
      </aside>

      {/* Canvas + toolbar */}
      <div className="relative flex-1" onDrop={onDrop} onDragOver={onDragOver}>
        {/* Floating toolbar */}
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1.5 rounded-full border border-[var(--border-default)]"
          style={{ background: "rgba(14,15,24,0.85)", backdropFilter: "blur(12px)" }}
        >
          <div ref={templateBtnRef} className="relative">
            <button
              onClick={() => setTemplateMenuOpen(v => !v)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[var(--accent)] text-[var(--bg-base)] text-[12px] font-medium hover:bg-[var(--accent-hover)]"
            >
              <Sparkles className="h-3.5 w-3.5" /> Templates
            </button>
            <AnimatePresence>
              {templateMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-10 left-0 w-64 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 shadow-lg z-20"
                >
                  {(Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>).map((k) => (
                    <button
                      key={k}
                      onClick={() => applyTemplate(k)}
                      className="w-full flex flex-col items-start gap-0.5 px-3 py-2 hover:bg-white/5 text-left"
                    >
                      <span className="text-[13px] text-[var(--text-primary)]">{TEMPLATES[k].label}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono-tabular">{TEMPLATES[k].description}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mx-1 h-4 w-px bg-[var(--border-default)]" />

          <button
            onClick={simulating ? stopSim : runSim}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium ${
              simulating ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-[#22C55E]/15 text-[#22C55E] hover:bg-[#22C55E]/25"
            }`}
          >
            {simulating ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {simulating ? `Stop · ${simStep}/${nodes.length} · ${simLatency}ms` : "Simulate"}
          </button>

          <div className="mx-1 h-4 w-px bg-[var(--border-default)]" />

          <button
            onClick={undo} disabled={!canUndo}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo (⌘Z)"
          ><Undo2 className="h-3.5 w-3.5" /></button>
          <button
            onClick={redo} disabled={!canRedo}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo (⇧⌘Z)"
          ><Redo2 className="h-3.5 w-3.5" /></button>

          <div className="mx-1 h-4 w-px bg-[var(--border-default)]" />

          <div className="flex items-center gap-1.5 px-2 text-[11px] text-[var(--text-muted)] font-mono-tabular max-w-[160px] truncate">
            {workflowName}
          </div>

          <div className="mx-1 h-4 w-px bg-[var(--border-default)]" />

          <button
            onClick={handleSave} disabled={saveWorkflow.isPending}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <div ref={loadBtnRef} className="relative">
            <button
              onClick={() => setLoadMenuOpen(v => !v)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
            >
              <FolderOpen className="h-3.5 w-3.5" /> Load
            </button>
            <AnimatePresence>
              {loadMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-10 right-0 w-72 max-h-96 flex flex-col rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg z-20"
                >
                  <div className="p-2 border-b border-[var(--border-default)]">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-muted)]" />
                      <input
                        value={loadQuery}
                        onChange={(e) => setLoadQuery(e.target.value)}
                        placeholder="Search workflows…"
                        className="w-full h-7 pl-7 pr-2 rounded bg-white/5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:bg-white/10"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto py-1">
                  {(() => {
                    const q = loadQuery.trim().toLowerCase();
                    const filtered = q
                      ? savedWorkflows.filter((wf) => wf.name.toLowerCase().includes(q))
                      : savedWorkflows;
                    const favs = filtered.filter((wf) => wf.is_favorite);
                    const rest = filtered.filter((wf) => !wf.is_favorite);
                    const renderRow = (wf: WorkflowRow) => (
                    <div key={wf.id} className="group flex items-center gap-1 pr-1 hover:bg-white/5">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await toggleFavorite.mutateAsync({ id: wf.id, is_favorite: !wf.is_favorite });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to update");
                          }
                        }}
                        title={wf.is_favorite ? "Unstar" : "Star"}
                        className={`pl-2 pr-1 py-2 ${wf.is_favorite ? "text-amber-400" : "text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-amber-400"}`}
                      >
                        <Star className="h-3 w-3" fill={wf.is_favorite ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => handleLoad(wf)}
                        className="flex-1 flex flex-col items-start gap-0.5 py-2 pr-1 text-left min-w-0"
                      >
                        <span className="text-[13px] text-[var(--text-primary)] truncate w-full">{wf.name}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono-tabular">
                          {Array.isArray(wf.nodes) ? wf.nodes.length : 0} nodes · {new Date(wf.updated_at).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const name = prompt("Rename workflow", wf.name)?.trim();
                          if (!name || name === wf.name) return;
                          try {
                            const updated = await renameWorkflow.mutateAsync({ id: wf.id, name });
                            if (currentWorkflowId === wf.id) setWorkflowName(updated.name);
                            toast.success(`Renamed to “${name}”`);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Rename failed");
                          }
                        }}
                        title="Rename"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await duplicateWorkflow.mutateAsync(wf);
                            toast.success(`Duplicated “${wf.name}”`);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Duplicate failed");
                          }
                        }}
                        title="Duplicate"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Delete workflow "${wf.name}"?`)) return;
                          try {
                            await deleteWorkflow.mutateAsync(wf.id);
                            if (currentWorkflowId === wf.id) {
                              setCurrentWorkflowId(null);
                              setWorkflowName("Untitled workflow");
                            }
                            toast.success(`Deleted “${wf.name}”`);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Delete failed");
                          }
                        }}
                        title="Delete"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-muted)] hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    );
                    if (savedWorkflows.length === 0) {
                      return <div className="px-3 py-4 text-center text-[12px] text-[var(--text-muted)]">No saved workflows yet</div>;
                    }
                    if (filtered.length === 0) {
                      return <div className="px-3 py-4 text-center text-[12px] text-[var(--text-muted)]">No matches for “{loadQuery}”</div>;
                    }
                    return (
                      <>
                        {favs.length > 0 && (
                          <>
                            <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Favorites</div>
                            {favs.map(renderRow)}
                            {rest.length > 0 && <div className="px-3 pt-2 pb-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">All</div>}
                          </>
                        )}
                        {rest.map(renderRow)}
                      </>
                    );
                  })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          <input
            ref={fileInputRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }}
          />
          <button
            onClick={autoLayout}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
          >
            <Layout className="h-3.5 w-3.5" /> Auto layout
          </button>
          <button
            onClick={async () => {
              if (!currentWorkflowId) {
                toast.error("Save the workflow first to share it");
                return;
              }
              const current = savedWorkflows.find(w => w.id === currentWorkflowId);
              const nextPublic = !(current?.is_public ?? false);
              try {
                await togglePublic.mutateAsync({ id: currentWorkflowId, is_public: nextPublic });
                if (nextPublic) {
                  const url = `${window.location.origin}/share/${currentWorkflowId}`;
                  try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
                  toast.success("Share link copied to clipboard", { description: url });
                } else {
                  toast.success("Sharing disabled");
                }
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to update sharing");
              }
            }}
            disabled={togglePublic.isPending}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-50"
          >
            {(savedWorkflows.find(w => w.id === currentWorkflowId)?.is_public) ? (
              <><Globe className="h-3.5 w-3.5 text-[var(--accent)]" /> Shared</>
            ) : (
              <><Share2 className="h-3.5 w-3.5" /> Share</>
            )}
          </button>

        </div>

        {/* Warnings pill */}
        {disconnectedIds.size > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--danger,#ef4444)]/40 bg-[var(--danger,#ef4444)]/10 text-[11px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {disconnectedIds.size} disconnected node{disconnectedIds.size > 1 ? "s" : ""}
          </div>
        )}

        <UsagePanel />

        {/* First-visit onboarding hint */}
        <AnimatePresence>
          {showOnboarding && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="absolute top-20 right-4 z-10 w-[280px] rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)]/95 backdrop-blur p-4 shadow-lg"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Try the harness</span>
                <button onClick={dismissOnboarding} className="p-0.5 -mr-1 -mt-0.5 rounded hover:bg-white/5 text-[var(--text-muted)]" aria-label="Dismiss">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ol className="space-y-1.5 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                <li><span className="text-[var(--accent)] font-mono-tabular mr-1.5">01</span>Drag a node from the left rail onto the canvas</li>
                <li><span className="text-[var(--accent)] font-mono-tabular mr-1.5">02</span>Connect handles by dragging Planner → next node</li>
                <li><span className="text-[var(--accent)] font-mono-tabular mr-1.5">03</span>Hit <span className="text-[#22C55E]">Simulate</span> to watch it flow</li>
              </ol>
              <div className="mt-3 pt-3 border-t border-[var(--border-default)] text-[10px] text-[var(--text-muted)]">
                Or start from a <span className="text-[var(--text-secondary)]">Template</span> above. Everything is undoable (⌘Z).
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ReactFlow
          nodes={nodesWithFlags}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
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
          <MiniMap pannable zoomable maskColor="rgba(10,10,11,0.85)" nodeColor={() => "#C7C7CC"} style={{ width: 160, height: 100 }} />
        </ReactFlow>

        {/* Selection panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.aside
              key="panel"
              initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.32, 1] }}
              className="absolute top-0 right-0 h-full w-[280px] border-l border-[var(--border-default)] bg-[var(--bg-surface)] z-20 flex flex-col"
            >
              <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--border-default)]">
                <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Node</span>
                <button onClick={() => setSelectedId(null)} className="p-1 rounded hover:bg-white/5 text-[var(--text-secondary)]">
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
                    <span className="text-[12px] text-[var(--text-secondary)] tabular-nums">{selectedNode.data.temperature.toFixed(2)}</span>
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
                <div className="pt-2 border-t border-[var(--border-default)] text-[11px] text-[var(--text-muted)] space-y-1">
                  <div>Simulated latency: <span className="text-[var(--text-secondary)] tabular-nums">{TYPE_BY_NAME[selectedNode.data.typeName]?.latencyMs ?? 0}ms</span></div>
                  <div>Source: <span className="text-[var(--text-secondary)]">{TYPE_BY_NAME[selectedNode.data.typeName]?.canBeSource ? "yes" : "no"}</span></div>
                  <div>Target: <span className="text-[var(--text-secondary)]">{TYPE_BY_NAME[selectedNode.data.typeName]?.canBeTarget ? "yes" : "no"}</span></div>
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
    </div>
  );
}
