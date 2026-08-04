import { describe, expect, it } from "vitest";
import {
  buildClusters,
  buildEdges,
  detectLoops,
  estimateTokens,
  extractImports,
  findEntryPoints,
  nodeId,
  resolveImport,
  type GraphNode,
} from "@/lib/context/graph";

const node = (path: string, imports: string[]): GraphNode => ({
  id: nodeId(path),
  path,
  type: path.split(".").pop()!,
  tokens: 100,
  imports,
  entities: [],
  summary: "",
});

const table = (...nodes: GraphNode[]) =>
  Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<string, GraphNode>;

describe("node ids and tokens", () => {
  it("produces stable 12-char ids", () => {
    expect(nodeId("src/main.py")).toHaveLength(12);
    expect(nodeId("src/main.py")).toBe(nodeId("src/main.py"));
    expect(nodeId("src/main.py")).not.toBe(nodeId("src/other.py"));
  });

  it("estimates tokens from words plus characters", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("const a = 1;")).toBeGreaterThan(0);
    expect(estimateTokens("a ".repeat(100))).toBeGreaterThan(estimateTokens("a"));
  });
});

describe("import extraction", () => {
  it("reads ts/tsx import forms", () => {
    const imports = extractImports(
      "src/a.tsx",
      `import React from "react";\nimport { cn } from "@/lib/utils";\nimport "./styles.css";\nconst x = require("node:path");`,
    );
    expect(imports).toEqual(["react", "@/lib/utils", "./styles.css", "node:path"]);
  });

  it("reads python import forms", () => {
    expect(extractImports("context/x.py", "import json\nfrom pathlib import Path")).toEqual([
      "json",
      "pathlib",
    ]);
  });
});

describe("alias resolution", () => {
  const known = ["src/lib/utils.ts", "src/features/harness/index.tsx", "src/routes/login.tsx"];

  it("resolves @/ aliases to real files", () => {
    expect(resolveImport("@/lib/utils", "src/routes/login.tsx", known)).toBe("src/lib/utils.ts");
  });

  it("resolves directory index files", () => {
    expect(resolveImport("@/features/harness", "src/routes/login.tsx", known)).toBe(
      "src/features/harness/index.tsx",
    );
  });

  it("resolves relative paths", () => {
    expect(resolveImport("../lib/utils", "src/routes/login.tsx", known)).toBe("src/lib/utils.ts");
  });

  it("returns null for external packages", () => {
    expect(resolveImport("react", "src/routes/login.tsx", known)).toBeNull();
    expect(resolveImport("@tanstack/react-router", "src/routes/login.tsx", known)).toBeNull();
  });
});

describe("edges", () => {
  it("creates edges only for resolvable internal imports", () => {
    const nodes = table(
      node("src/index.ts", ["react", "./app", "@/lib/utils"]),
      node("src/app.ts", []),
      node("src/lib/utils.ts", []),
    );
    const edges = buildEdges(nodes);
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.type === "imports")).toBe(true);
  });

  it("deduplicates repeated imports of the same module", () => {
    const nodes = table(node("src/index.ts", ["./app", "./app.ts"]), node("src/app.ts", []));
    expect(buildEdges(nodes)).toHaveLength(1);
  });
});

describe("loop detection", () => {
  it("finds no cycle in an acyclic graph", () => {
    const nodes = table(
      node("src/index.ts", ["./app"]),
      node("src/app.ts", ["./utils"]),
      node("src/utils.ts", []),
    );
    expect(detectLoops(Object.keys(nodes), buildEdges(nodes))).toEqual([]);
  });

  it("finds a self loop", () => {
    const nodes = table(node("src/index.ts", ["./index"]));
    const loops = detectLoops(Object.keys(nodes), buildEdges(nodes));
    expect(loops).toHaveLength(1);
    expect(loops[0]).toEqual([nodeId("src/index.ts"), nodeId("src/index.ts")]);
  });

  it("finds a multi-node cycle and closes the path", () => {
    const nodes = table(
      node("src/index.ts", ["./app"]),
      node("src/app.ts", ["./routes"]),
      node("src/routes.ts", ["./index"]),
    );
    const loops = detectLoops(Object.keys(nodes), buildEdges(nodes));
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
    expect(loops[0]![0]).toBe(loops[0]![loops[0]!.length - 1]);
  });

  it("reports each cycle once regardless of traversal start", () => {
    const nodes = table(
      node("src/a.ts", ["./b"]),
      node("src/b.ts", ["./c"]),
      node("src/c.ts", ["./a", "./d"]),
      node("src/d.ts", []),
    );
    expect(detectLoops(Object.keys(nodes), buildEdges(nodes))).toHaveLength(1);
  });
});

describe("clusters and entry points", () => {
  it("groups by full directory, not the first path segment", () => {
    const nodes = table(
      node("src/components/Button.tsx", []),
      node("src/components/Input.tsx", []),
      node("src/pages/Home.tsx", []),
      node("README.md", []),
    );
    const clusters = buildClusters(nodes);
    expect(clusters["dir_src/components"]).toHaveLength(2);
    expect(clusters["dir_src/pages"]).toHaveLength(1);
    expect(clusters["dir_<root>"]).toHaveLength(1);
    expect(clusters["type_tsx"]).toHaveLength(3);
  });

  it("lists only nodes nothing imports", () => {
    const nodes = table(node("src/index.ts", ["./app"]), node("src/app.ts", []));
    const entries = findEntryPoints(Object.keys(nodes), buildEdges(nodes));
    expect(entries).toEqual([nodeId("src/index.ts")]);
  });
});
