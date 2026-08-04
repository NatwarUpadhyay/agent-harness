#!/usr/bin/env python3
"""Graph Builder for token‑efficient context mapping.

This script scans the project directory, extracts import relationships, estimates token counts, and writes a JSON graph.
"""

import os
import json
import hashlib
import re
from pathlib import Path
from collections import defaultdict

class ContextGraphBuilder:
    def __init__(self, root_path: str):
        self.root = Path(root_path)
        self.graph = {
            "nodes": {},
            "edges": [],
            "clusters": {},
            "loops": [],
            "entry_points": [],
            "metadata": {
                "root": str(root_path),
                "total_files": 0,
                "total_tokens": 0,
            },
        }
        self.node_id_map = {}
        self.adj = defaultdict(list)

    def _node_id(self, rel_path: str) -> str:
        return hashlib.md5(rel_path.encode()).hexdigest()[:12]

    def _estimate_tokens(self, text: str) -> int:
        return len(text.split()) + len(text) // 4

    def _extract_imports(self, path: Path, text: str):
        imports = []
        if path.suffix == ".py":
            imports += re.findall(r"^\s*import\s+(\S+)", text, re.MULTILINE)
            imports += re.findall(r"^\s*from\s+(\S+)\s+import", text, re.MULTILINE)
        elif path.suffix in {".js", ".ts", ".jsx", ".tsx"}:
            imports += re.findall(r"import\s+.*?\s+from\s+['\"](.+?)['\"]", text)
            imports += re.findall(r"require\(['\"](.+?)['\"]\)", text)
        return imports

    def _extract_entities(self, path: Path, text: str):
        entities = []
        if path.suffix == ".py":
            for m in re.finditer(r"^\s*class\s+(\w+)", text, re.MULTILINE):
                entities.append({"type": "class", "name": m.group(1)})
            for m in re.finditer(r"^\s*def\s+(\w+)", text, re.MULTILINE):
                entities.append({"type": "function", "name": m.group(1)})
        elif path.suffix in {".js", ".ts", ".jsx", ".tsx"}:
            for m in re.finditer(r"class\s+(\w+)", text):
                entities.append({"type": "class", "name": m.group(1)})
            for m in re.finditer(r"function\s+(\w+)", text):
                entities.append({"type": "function", "name": m.group(1)})
            for m in re.finditer(r"const\s+(\w+)\s*=\s*\(.*?\)\s*=>", text):
                entities.append({"type": "function", "name": m.group(1)})
        return entities

    def _summary(self, text: str, path: Path):
        lines = text.splitlines()[:50]
        comments = []
        for line in lines:
            l = line.strip()
            if path.suffix == ".py" and l.startswith("#"):
                comments.append(l)
            elif path.suffix in {".js", ".ts", ".jsx", ".tsx"} and l.startswith("//"):
                comments.append(l)
        return " ".join(comments[:5]) or "No summary"

    def scan(self, max_files=2000):
        ignore = {"node_modules", ".git", "__pycache__", "venv", "env", "dist", "build", "target"}
        count = 0
        for root, dirs, files in os.walk(self.root):
            dirs[:] = [d for d in dirs if d not in ignore]
            for f in files:
                if count >= max_files:
                    return
                p = Path(root) / f
                if p.suffix not in {".py", ".js", ".ts", ".jsx", ".tsx", ".json", ".md", ".yaml", ".yml", ".txt"}:
                    continue
                try:
                    rel = str(p.relative_to(self.root))
                    nid = self._node_id(rel)
                    txt = p.read_text(encoding="utf-8", errors="ignore")
                    imports = self._extract_imports(p, txt)
                    entities = self._extract_entities(p, txt)
                    tokens = self._estimate_tokens(txt)
                    self.graph["nodes"][nid] = {
                        "id": nid,
                        "path": rel,
                        "type": p.suffix[1:],
                        "size": p.stat().st_size,
                        "tokens": tokens,
                        "imports": imports,
                        "entities": entities,
                        "summary": self._summary(txt, p),
                    }
                    self.node_id_map[rel] = nid
                    for imp in imports:
                        self.adj[nid].append(imp)
                    count += 1
                except Exception as e:
                    print(f"Error reading {p}: {e}")
        self.graph["metadata"]["total_files"] = count
        self.graph["metadata"]["total_tokens"] = sum(n["tokens"] for n in self.graph["nodes"].values())

    def _detect_loops(self):
        visited = set()
        stack = set()
        loops = []

        def dfs(node, path):
            visited.add(node)
            stack.add(node)
            path.append(node)

            for nxt in self.adj.get(node, []):
                if nxt not in self.node_id_map.values():
                    continue
                if nxt not in visited:
                    dfs(nxt, path.copy())
                elif nxt in stack:
                    idx = path.index(nxt)
                    loops.append(path[idx:] + [nxt])

            path.pop()
            stack.remove(node)

        for n in self.graph["nodes"].keys():
            if n not in visited:
                dfs(n, [])

        self.graph["loops"] = loops

    def _clusters(self):
        clusters = defaultdict(list)
        for nid, node in self.graph["nodes"].items():
            clusters[f"dir_{Path(node['path']).parts[0]}"].append(nid)
            clusters[f"type_{node['type']}"].append(nid)
        self.graph["clusters"] = dict(clusters)

    def _entry_points(self):
        incoming = set()
        for src, targets in self.adj.items():
            for t in targets:
                if t in self.node_id_map.values():
                    incoming.add(t)
        self.graph["entry_points"] = [n for n in self.graph["nodes"] if n not in incoming][:20]

    def build(self):
        self._detect_loops()
        self._clusters()
        self._entry_points()

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.graph, f, indent=2)

if __name__ == "__main__":
    builder = ContextGraphBuilder("/Users/natwarupadhyay/Documents/Harness/agent-harness")
    builder.scan(max_files=2000)
    builder.build()
    out = Path("/Users/natwarupadhyay/Documents/Harness/agent-harness/context/knowledge_graph.json")
    builder.save(out)
    print(f"Graph written to {out}")
