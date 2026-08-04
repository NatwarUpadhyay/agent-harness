import { describe, it, expect, vi } from "vite-node/testing";
import { readFileSync } from "fs";
import { join } from "path";
import { LoopDetector } from "../context/loops/loop_detection";

describe("Loop Detection System", () => {
  it("should detect circular dependencies in knowledge graph", async () => {
    const graph_path = "/Users/natwarupadhyay/Documents/Harness/agent-harness/context/knowledge_graph.json";
    const detector = new LoopDetector(graph_path);
    
    const loops = detector.detect_loops();
    expect(loops).toBeArray();
    
    // Log results for inspection during test runs
    console.log(`Found ${loops.length} circular dependencies`);
    if (loops.length > 0) {
      console.log("Loop structures:", loops);
    }
  });
  
  it("should return empty array for acyclic graph", async () => {
    // Create a mock acyclic graph
    const mockGraph = {
      nodes: {
        "node1": { imports: ["node2"] },
        "node2": { imports: ["node3"] },
        "node3": { imports: [] }
      }
    };
    
    const detector = new LoopDetector(""); // Won't be used due to mocking
    vi.spyOn(detector, "graph", "get").mockReturnValue(mockGraph);
    
    const loops = detector.detect_loops();
    expect(loops).toEqual([]);
  });
  
  it("should handle self-loop detection", async () => {
    const mockGraph = {
      nodes: {
        "node1": { imports: ["node1"] } // Self-loop
      }
    };
    
    const detector = new LoopDetector("");
    vi.spyOn(detector, "graph", "get").mockReturnValue(mockGraph);
    
    const loops = detector.detect_loops();
    expect(loops).toHaveLength(1);
    expect(loops[0]).toEqual(["node1", "node1"]);
  });
  
  it("should handle complex nested loops", async () => {
    const mockGraph = {
      nodes: {
        "A": { imports: ["B"] },
        "B": { imports: ["C"] },
        "C": { imports: ["A", "D"] },
        "D": { imports: [] }
      }
    };
    
    const detector = new LoopDetector("");
    vi.spyOn(detector, "graph", "get").mockReturnValue(mockGraph);
    
    const loops = detector.detect_loops();
    expect(loops).toHaveLengthAtLeast(1);
    // Should find A->B->C->A cycle
  });
});