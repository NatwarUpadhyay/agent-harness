import { createHash } from "node:crypto";

/**
 * Token-efficient context graph.
 *
 * Pure, dependency-free helpers shared by the Python builder in `context/`
 * and the regression suite. Import specifiers are resolved to real repo paths
 * before hashing, which is what makes edges (and therefore loops) resolvable.
 */

export type NodeType = string;

export interface GraphEntity {
  type: "class" | "function";
  name: string;
}

export interface GraphNode {
  id: string;
  path: string;
  type: NodeType;
  tokens: number;
  imports: string[];
  entities: GraphEntity[];
  summary: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "imports";
}

export interface KnowledgeGraph {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  clusters: Record<string, string[]>;
  loops: string[][];
  entry_points: string[];
  metadata: {
    root: string;
    total_files: number;
    total_tokens: number;
  };
}

/** Directories and files that are build output or otherwise pure noise. */
export const IGNORED_DIRS = [
  "node_modules",
  ".git",
  "__pycache__",
  "venv",
  "env",
  "dist",
  "build",
  "target",
  ".output",
  ".wrangler",
  ".vite",
  "coverage",
];

export const IGNORED_FILES = ["package-lock.json", "bun.lock", "knowledge_graph.json"];

export const SOURCE_EXTENSIONS = [".py", ".js", ".ts", ".jsx", ".tsx"];

export function nodeId(relPath: string): string {
  return createHash("md5").update(relPath).digest("hex").slice(0, 12);
}

export function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length + Math.floor(text.length / 4);
}

export function extractImports(relPath: string, text: string): string[] {
  const found: string[] = [];
  const push = (re: RegExp) => {
    for (const m of text.matchAll(re)) if (m[1]) found.push(m[1]);
  };

  if (relPath.endsWith(".py")) {
    push(/^\s*import\s+(\S+)/gm);
    push(/^\s*from\s+(\S+)\s+import/gm);
  } else {
    push(/import\s+[^'"]*?from\s+['"](.+?)['"]/g);
    push(/import\s+['"](.+?)['"]/g);
    push(/require\(['"](.+?)['"]\)/g);
  }
  return Array.from(new Set(found));
}

const dirname = (p: string) => {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
};

const normalize = (p: string): string => {
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
};

/**
 * Resolve an import specifier to a repo-relative file path.
 * Handles `@/…` aliases, relative paths, extension-less files and directory
 * index files. Returns null for bare package specifiers (external deps).
 */
export function resolveImport(
  specifier: string,
  fromPath: string,
  knownPaths: Iterable<string>,
): string | null {
  const known = knownPaths instanceof Set ? knownPaths : new Set(knownPaths);

  let base: string;
  if (specifier.startsWith("@/")) {
    base = `src/${specifier.slice(2)}`;
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = normalize(`${dirname(fromPath)}/${specifier}`);
  } else if (specifier.startsWith("src/") || specifier.startsWith("context/")) {
    base = normalize(specifier);
  } else {
    return null;
  }

  const candidates = [base, ...SOURCE_EXTENSIONS.map((e) => `${base}${e}`)];
  for (const ext of SOURCE_EXTENSIONS) candidates.push(`${base}/index${ext}`);
  for (const candidate of candidates) if (known.has(candidate)) return candidate;
  return null;
}

/** Build resolved edges from the node table. */
export function buildEdges(nodes: Record<string, GraphNode>): GraphEdge[] {
  const byPath = new Map<string, string>();
  for (const node of Object.values(nodes)) byPath.set(node.path, node.id);

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const node of Object.values(nodes)) {
    for (const specifier of node.imports) {
      const target = resolveImport(specifier, node.path, byPath.keys());
      if (!target) continue;
      const targetId = byPath.get(target)!;
      const key = `${node.id}->${targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: node.id, target: targetId, type: "imports" });
    }
  }
  return edges;
}

/** Iterative DFS cycle detection over resolved edges. Self-loops included. */
export function detectLoops(nodeIds: string[], edges: GraphEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of edges) adjacency.get(edge.source)?.push(edge.target);

  const visited = new Set<string>();
  const onStack = new Set<string>();
  const loops: string[][] = [];
  const signatures = new Set<string>();

  const record = (cycle: string[]) => {
    const body = cycle.slice(0, -1);
    const min = body.indexOf([...body].sort()[0]!);
    const rotated = [...body.slice(min), ...body.slice(0, min)];
    const signature = rotated.join(">");
    if (signatures.has(signature)) return;
    signatures.add(signature);
    loops.push([...rotated, rotated[0]!]);
  };

  const walk = (id: string, path: string[]) => {
    visited.add(id);
    onStack.add(id);
    path.push(id);
    for (const next of adjacency.get(id) ?? []) {
      if (onStack.has(next)) record([...path.slice(path.indexOf(next)), next]);
      else if (!visited.has(next)) walk(next, path);
    }
    path.pop();
    onStack.delete(id);
  };

  for (const id of nodeIds) if (!visited.has(id)) walk(id, []);
  return loops;
}

/** Group nodes by real directory (not just the first path segment) and by type. */
export function buildClusters(nodes: Record<string, GraphNode>): Record<string, string[]> {
  const clusters: Record<string, string[]> = {};
  const add = (key: string, id: string) => {
    (clusters[key] ??= []).push(id);
  };
  for (const node of Object.values(nodes)) {
    const dir = dirname(node.path);
    add(`dir_${dir || "<root>"}`, node.id);
    add(`type_${node.type}`, node.id);
  }
  return clusters;
}

/** Nodes nothing else imports — the roots of the dependency forest. */
export function findEntryPoints(nodeIds: string[], edges: GraphEdge[], limit = 20): string[] {
  const incoming = new Set(edges.map((e) => e.target));
  return nodeIds.filter((id) => !incoming.has(id)).slice(0, limit);
}
