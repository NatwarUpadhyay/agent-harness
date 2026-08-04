#!/usr/bin/env python3

# Loop Detection System

# Reads knowledge_graph.json and detects circular dependencies

import json
from datetime import datetime
from pathlib import Path

class LoopDetector:
    def __init__(self, graph_path: str):
        with open(graph_path, 'r') as f:
            self.graph = json.load(f)

    def detect_loops(self) -> list:
        """Detect circular dependencies using DFS"""
        visited = set()
        stack = set()
        loops = []

        def dfs(node, path):
            visited.add(node)
            stack.add(node)
            path.append(node)

            for neighbor in self.graph['nodes'][node]['imports']:
                if neighbor not in visited:
                    if not dfs(neighbor, path.copy()):
                        return False
                elif neighbor in stack:
                    loops.append(path[path.index(neighbor):] + [neighbor])

            path.pop()
            stack.remove(node)
            return True

        for node_id in self.graph['nodes']:
            dfs(node_id, [])

        return loops

if __name__ == '__main__':
    detector = LoopDetector('/Users/natwarupadhyay/Documents/Harness/context/knowledge_graph.json')
    loops = detector.detect_loops()

    with open('/Users/natwarupadhyay/Documents/Harness/context/loops/loop_report.json', 'w') as f:
        json.dump({
            'total_loops': len(loops),
            'loop_structures': loops,
            'timestamp': str(datetime.now())
        }, f, indent=2)

print(f'Found {len(loops)} loops. Report saved to context/loops/loop_report.json')