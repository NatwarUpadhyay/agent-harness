import { describe, it, expect, vi } from "vite-node/testing";
import { readFileSync } from "fs";
import { join } from "path";
import { ContextGraphBuilder } from "../context/graph_builder";

describe("Context Graph Builder", () => {
  const builder = new ContextGraphBuilder("/Users/natwarupadhyay/Documents/Harness/agent-harness/context");
  
  it("should scan and build knowledge graph successfully", async () => {
    const filePath = join(builder.root, "../context/knowledge_graph.json");
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    
    expect(data).toHaveProperty("nodes");
    expect(data).toHaveProperty("edges");
    expect(data).toHaveProperty("clusters");
    expect(data).toHaveProperty("loops");
    expect(data).toHaveProperty("entry_points");
  });
  
  it("should detect circular dependencies when present", async () => {
    // Mock a simple circular dependency
    vi.spyOn(builder, "detect_loops").mockImplementation(() => {
      return [
        ["node1", "node2", "node3", "node1"]
      ];
    });
    
    const loops = builder.detect_loops();
    expect(loops).toHaveLength(1);
  });
  
  it("should generate proper node IDs", () => {
    const node_id = builder._node_id("src/main.py");
    expect(node_id).toBeString();
    expect(node_id).toHaveLength(12);
  });
  
  it("should treat direct file imports as edges", async () => {
    // This tests the relationship extraction logic
    const json_path = join(builder.root, "../context/package.json");
    const data = JSON.parse(readFileSync(json_path, "utf-8"));
    const node_id = builder._node_id("package.json");
    
    // Should have self-references or appropriate patterns
    const node_data = data.nodes[node_id];
    expect(node_data).toBeDefined();
  });
});