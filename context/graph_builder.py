#!/usr/bin/env python3
"""Graph Builder for token-efficient context mapping.

Scans the repo, extracts import relationships, resolves them to real files
(so edges and cycles are actually resolvable), estimates tokens and writes
context/knowledge_graph.json.

Mirrors src/lib/context/graph.ts, which the regression suite covers.
"""

import hashlib
import json
import os
import re
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

IGNORED_DIRS = {
    "node_modules", ".git", "__pycache__", "venv", "env", "dist", "build",
    "target", ".output", ".wrangler", ".vite", "coverage",
}
IGNORED_FILES = {"package-lock.json", "bun.lock", "knowledge_graph.json"}
SOURCE_EXTS = {".py", ".js", ".ts", ".jsx", ".tsx"}
DOC_EXTS = {".md", ".yaml", ".yml", ".txt"}
MAX_JSON_BYTES = 50_000


class ContextGraphBuilder:
    def __init__(self, root_path: str):
        self.root = Path(root_path)
        self.graph = {
            "nodes": {},
            "edges": [],
            "clusters": {},
            "loops": [],
            "entry_points": [],
            "metadata": {"root": str(root_path), "total_files": 0, "total_tokens": 0},
        }
        self.node_id_map = {}
        self.adj = defaultdict(list)

    # ---------- primitives ----------

    def _node_id(self, rel_path: str) -> str:
        return hashlib.md5(rel_path.encode()).hexdigest()[:12]

    def _estimate_tokens(self, text: str) -> int:
        if not text.strip():
            return 0
        return len(text.split()) + len(text) // 4

    def _extract_imports(self, path: Path, text: str):
        imports = []
        if path.suffix == ".py":
            imports += re.findall(r"^\s*import\s+(\S+)", text, re.MULTILINE)
            imports += re.findall(r"^\s*from\s+(\S+)\s+import", text, re.MULTILINE)
        elif path.suffix in {".js", ".ts", ".jsx", ".tsx"}:
            imports += re.findall(r"import\s+[^'\"]*?from\s+['\"](.+?)['\"]", text)
            imports += re.findall(r"import\s+['\"](.+?)['\"]", text)
            imports += re.findall(r"require\(['\"](.+?)['\"]\)", text)
        return list(dict.fromkeys(imports))

    def _resolve_import(self, specifier: str, from_path: str):
        """Resolve an import specifier to a repo-relative path, or None if external."""
        if specifier.startswith("@/"):
            base = "src/" + specifier[2:]
        elif specifier.startswith("./") or specifier.startswith("../"):
            base = os.path.normpath(os.path.join(os.path.dirname(from_path), specifier))
        elif specifier.startswith("src/") or specifier.startswith("context/"):
            base = os.path.normpath(specifier)
        else:
            return None
        base = base.replace(os.sep, "/")

        candidates = [base]
        candidates += [f"{base}{ext}" for ext in sorted(SOURCE_EXTS)]
        candidates += [f"{base}/index{ext}" for ext in sorted(SOURCE_EXTS)]
        for candidate in candidates:
            if candidate in self.node_id_map:
                return candidate
        return None

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
        comments = []
        for line in text.splitlines()[:50]:
            stripped = line.strip()
            if path.suffix == ".py" and stripped.startswith("#"):
                comments.append(stripped)
            elif path.suffix in {".js", ".ts", ".jsx", ".tsx"} and stripped.startswith("//"):
                comments.append(stripped)
        return " ".join(comments[:5]) or "No summary"

    def _should_skip(self, path: Path) -> bool:
        if path.name in IGNORED_FILES:
            return True
        if path.suffix in SOURCE_EXTS or path.suffix in DOC_EXTS:
            return False
        if path.suffix == ".json":
            try:
                return path.stat().st_size > MAX_JSON_BYTES
            except OSError:
                return True
        return True

    # ---------- pipeline ----------

    def scan(self, max_files=2000):
        count = 0
        for root, dirs, files in os.walk(self.root):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
            for f in sorted(files):
                if count >= max_files:
                    return
                p = Path(root) / f
                if self._should_skip(p):
                    continue
                try:
                    rel = str(p.relative_to(self.root)).replace(os.sep, "/")
                    nid = self._node_id(rel)
                    txt = p.read_text(encoding="utf-8", errors="ignore")
                    self.graph["nodes"][nid] = {
                        "id": nid,
                        "path": rel,
                        "type": p.suffix[1:],
                        "size": p.stat().st_size,
                        "tokens": self._estimate_tokens(txt),
                        "imports": self._extract_imports(p, txt),
                        "entities": self._extract_entities(p, txt),
                        "summary": self._summary(txt, p),
                    }
                    self.node_id_map[rel] = nid
                    count += 1
                except Exception as e:  # noqa: BLE001
                    print(f"Error reading {p}: {e}")
        self.graph["metadata"]["total_files"] = count
        self.graph["metadata"]["total_tokens"] = sum(
            n["tokens"] for n in self.graph["nodes"].values()
        )

    def _edges(self):
        edges = []
        seen = set()
        self.adj.clear()
        for node in self.graph["nodes"].values():
            for specifier in node["imports"]:
                target = self._resolve_import(specifier, node["path"])
                if target is None:
                    continue
                target_id = self.node_id_map[target]
                key = (node["id"], target_id)
                if key in seen:
                    continue
                seen.add(key)
                self.adj[node["id"]].append(target_id)
                edges.append({"source": node["id"], "target": target_id, "type": "imports"})
        self.graph["edges"] = edges

    def _detect_loops(self):
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
            for nxt in self.adj.get(node, []):
                if nxt in on_stack:
                    record(path[path.index(nxt):] + [nxt])
                elif nxt not in visited:
                    dfs(nxt, path)
            path.pop()
            on_stack.discard(node)

        for n in self.graph["nodes"]:
            if n not in visited:
                dfs(n, [])
        self.graph["loops"] = loops

    def _clusters(self):
        clusters = defaultdict(list)
        for nid, node in self.graph["nodes"].items():
            directory = str(Path(node["path"]).parent).replace(os.sep, "/")
            clusters[f"dir_{'<root>' if directory == '.' else directory}"].append(nid)
            clusters[f"type_{node['type']}"].append(nid)
        self.graph["clusters"] = dict(clusters)

    def _entry_points(self):
        incoming = {e["target"] for e in self.graph["edges"]}
        self.graph["entry_points"] = [n for n in self.graph["nodes"] if n not in incoming][:20]

    def build(self):
        self._edges()
        self._detect_loops()
        self._clusters()
        self._entry_points()

    def save(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.graph, f, indent=2)


if __name__ == "__main__":
    import sys

    root = sys.argv[1] if len(sys.argv) > 1 else str(REPO_ROOT)
    builder = ContextGraphBuilder(root)
    builder.scan(max_files=2000)
    builder.build()
    out = Path(root) / "context" / "knowledge_graph.json"
    builder.save(out)
    meta = builder.graph["metadata"]
    print(
        f"{meta['total_files']} files, {meta['total_tokens']} est. tokens, "
        f"{len(builder.graph['edges'])} edges, {len(builder.graph['loops'])} loops "
        f"-> {out}"
    )
