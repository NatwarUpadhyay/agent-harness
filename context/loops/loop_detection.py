#!/usr/bin/env python3
"""Loop Detection System.

Reads context/knowledge_graph.json and reports circular dependencies over
resolved edges (not raw import strings), writing context/loops/loop_report.json.
"""

import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class LoopDetector:
    def __init__(self, graph_path: str):
        self.graph_path = Path(graph_path)
        with open(self.graph_path, "r", encoding="utf-8") as f:
            self.graph = json.load(f)

    def _adjacency(self):
        adj = defaultdict(list)
        edges = self.graph.get("edges") or []
        if edges:
            for edge in edges:
                adj[edge["source"]].append(edge["target"])
        else:
            # Fallback: treat imports as ids when a pre-resolved graph is supplied.
            for nid, node in self.graph["nodes"].items():
                for imp in node.get("imports", []):
                    if imp in self.graph["nodes"]:
                        adj[nid].append(imp)
        return adj

    def detect_loops(self) -> list:
        """Detect circular dependencies with an iterative-safe DFS."""
        adj = self._adjacency()
        visited, on_stack, loops, signatures = set(), set(), [], set()

        def record(cycle):
            body = cycle[:-1]
            start = body.index(min(body))
            rotated = body[start:] + body[:start]
            signature = ">".join(rotated)
            if signature in signatures:
                return
            signatures.add(signature)
            loops.append(rotated + [rotated[0]])

        def dfs(node, path):
            visited.add(node)
            on_stack.add(node)
            path.append(node)
            for nxt in adj.get(node, []):
                if nxt in on_stack:
                    record(path[path.index(nxt):] + [nxt])
                elif nxt not in visited:
                    dfs(nxt, path)
            path.pop()
            on_stack.discard(node)

        for node_id in self.graph["nodes"]:
            if node_id not in visited:
                dfs(node_id, [])
        return loops

    def report(self, loops: list) -> dict:
        paths = {nid: node["path"] for nid, node in self.graph["nodes"].items()}
        return {
            "total_loops": len(loops),
            "loop_structures": loops,
            "loop_paths": [[paths.get(n, n) for n in loop] for loop in loops],
            "timestamp": str(datetime.now()),
        }


if __name__ == "__main__":
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO_ROOT
    detector = LoopDetector(root / "context" / "knowledge_graph.json")
    loops = detector.detect_loops()

    out = root / "context" / "loops" / "loop_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(detector.report(loops), f, indent=2)

    print(f"Found {len(loops)} loops. Report saved to {out}")
