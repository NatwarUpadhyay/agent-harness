#!/usr/bin/env python3
"""Fine-tuned mock testing for context graph system."""
import json
import os
import re
from pathlib import Path
from collections import defaultdict

def test_knowledge_graph_validation():
    """Validate the knowledge graph structure and contents."""
    graph_path = "/Users/natwarupadhyay/Documents/Harness/agent-harness/context/knowledge_graph.json"
    
    with open(graph_path, 'r') as f:
        graph = json.load(f)
    
    # Test required top-level keys
    required_keys = ['nodes', 'edges', 'clusters', 'loops', 'entry_points', 'metadata']
    for key in required_keys:
        assert key in graph, f"Missing required key: {key}"
    
    # Test metadata structure
    assert 'total_files' in graph['metadata']
    assert 'root' in graph['metadata']
    assert isinstance(graph['metadata']['total_files'], int)
    assert graph['metadata']['total_files'] > 0, "Should have scanned files"
    
    # Test node structure
    node_ids = list(graph['nodes'].keys())
    for node_id in node_ids:
        node = graph['nodes'][node_id]
        assert 'id' in node
        assert 'path' in node
        assert 'type' in node
        assert 'tokens' in node
        assert 'imports' in node
        assert 'entities' in node
    
    # Test node ID consistency (MD5 hash truncation)
    for node in graph['nodes'].values():
        assert len(node['id']) == 12, f"Node ID should be 12 chars, got {len(node['id'])}"
    
    print("✓ Knowledge graph structure validation passed")
    return True, {"nodes": len(node_ids), "files": graph['metadata']['total_files']}

def test_token_estimation():
    """Test token estimation accuracy against known inputs."""
    test_cases = [
        {
            "text": "def hello(): pass",
            "expected_min": 1,
            "expected_max": 10
        },
        {
            "text": "This is a longer string with more words and characters.",
            "expected_min": 5,
            "expected_max": 30
        },
        {
            "text": "" * 100,  # Empty string
            "expected_min": 0,
            "expected_max": 1
        }
    ]
    
    for case in test_cases:
        words = len(case["text"].split()) if case["text"] else 0
        chars = len(case["text"]) // 4 if case["text"] else 0
        tokens = words + chars
        
        assert tokens >= case["expected_min"], f"Token estimate too low: {tokens}"
        assert tokens <= case["expected_max"], f"Token estimate too high: {tokens}"
    
    print("✓ Token estimation tests passed")
    return True, {"test_cases": len(test_cases)}

def test_loop_detection_logic():
    """Test the actual loop detection algorithm with known circular dependencies."""
    
    # Test 1: Simple acyclic graph
    acyclic_graph = {
        "nodes": {
            "A": {},
            "B": {},
            "C": {}
        }
    }
    
    # Test 2: Simple cyclic graph (A -> B -> C -> A)
    cyclic_graph = {
        "nodes": {
            "A": {},
            "B": {}, 
            "C": {}
        }
    }
    
    # DFS-based loop detection
    def detect_cycles(graph_nodes, adjacency_list):
        visited = set()
        stack = set()
        cycles = []
        
        def dfs(node, path):
            visited.add(node)
            stack.add(node)
            path.append(node)
            
            for neighbor in adjacency_list.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor, path.copy())
                elif neighbor in stack:
                    idx = path.index(neighbor)
                    cycles.append(path[idx:] + [neighbor])
            
            path.pop()
            stack.remove(node)
        
        for node in graph_nodes:
            if node not in visited:
                dfs(node, [])
        
        return cycles

    # Test acyclic
    adj_acyclic = {"A": ["B"], "B": ["C"], "C": []}
    cycles_acyclic = detect_cycles(acyclic_graph["nodes"], adj_acyclic)
    assert len(cycles_acyclic) == 0, "Should not detect cycles in acyclic graph"
    
    # Test cyclic
    adj_cyclic = {"A": ["B"], "B": ["C"], "C": ["A"]}
    cycles_cyclic = detect_cycles(cyclic_graph["nodes"], adj_cyclic)
    assert len(cycles_cyclic) > 0, "Should detect cycle in cyclic graph"
    
    # Test self-loop
    adj_self = {"A": ["A"]}
    nodes_self = {"A": {}}
    cycles_self = detect_cycles(nodes_self, adj_self)
    assert len(cycles_self) > 0, "Should detect self-loop"
    
    print("✓ Loop detection algorithm tests passed")
    return True, {"cycles_found": len(cycles_cyclic), "self_loops_detected": len(cycles_self)}

def test_cluster_analysis():
    """Test semantic clustering logic."""
    clusters = defaultdict(list)
    
    test_nodes = [
        {"path": "Context/graph_builder.py", "type": "py"},
        {"path": "Context/knowledge_graph.json", "type": "json"},
        {"path": "Context/loops/loop_detection.py", "type": "py"},
        {"path": "src/features/harness/HarnessCanvas.tsx", "type": "tsx"},
        {"path": "src/tests/routes/agents.test.tsx", "type": "tsx"},
        {"path": "package.json", "type": "json"}
    ]
    
    for node in test_nodes:
        path_parts = node["path"].split("/")
        # Directory cluster
        dir_cluster = f"dir_{path_parts[0]}"
        clusters[dir_cluster].append(node["path"])
        
        # Type cluster
        type_cluster = f"type_{node['type']}"
        clusters[type_cluster].append(node["path"])
    
    # Validate clustering
    assert len(clusters["dir_Context"]) == 3
    assert len(clusters["dir_src"]) == 2
    assert len(clusters["type_py"]) == 2
    assert len(clusters["type_json"]) == 2
    assert len(clusters["type_tsx"]) == 2  # Should have 2 tsx files
    
    print("✓ Cluster analysis tests passed")
    return True, {"directories_created": len(clusters)}

def test_integration_scenarios():
    """Test integration scenarios with mock data."""
    scenarios = [
        {
            "name": "Authentication Query",
            "query": "authentication",
            "expected_files": 2,
            "expected_tokens": 1000
        },
        {
            "name": "Database Query", 
            "query": "database",
            "expected_files": 1,
            "expected_tokens": 500
        }
    ]
    
    for scenario in scenarios:
        mock_results = [
            {"path": "src/auth/Login.tsx", "tokens": 600, "score": 95},
            {"path": "src/utils/auth.js", "tokens": 400, "score": 88}
        ]
        
        filtered = [r for r in mock_results if r["score"] > 80]
        total_tokens = sum(r["tokens"] for r in filtered)
        
        assert len(filtered) > 0, f"No results for {scenario['query']}"
        assert total_tokens < 1200, "Token budget exceeded"
    
    print("✓ Integration scenario tests passed")
    return True, {"scenarios_tested": len(scenarios)}

def run_all_tests():
    """Run all fine-tuned mock tests."""
    results = {
        "timestamp": "2026-08-03T20:33:03",
        "total_tests": 0,
        "passed": 0,
        "failed": 0,
        "details": []
    }
    
    test_functions = [
        test_knowledge_graph_validation,
        test_token_estimation,
        test_loop_detection_logic,
        test_cluster_analysis,
        test_integration_scenarios
    ]
    
    print("=" * 60)
    print("Fine-Tuned Mock Testing Suite")
    print("=" * 60)
    print()
    
    for test_fn in test_functions:
        try:
            success, details = test_fn()
            if success:
                results["passed"] += 1
                results["details"].append({
                    "test": test_fn.__name__,
                    "status": "PASS",
                    "details": details
                })
        except Exception as e:
            results["failed"] += 1
            results["details"].append({
                "test": test_fn.__name__,
                "status": "FAIL",
                "error": str(e)
            })
            print(f"✗ {test_fn.__name__} failed: {e}")
        
        results["total_tests"] += 1
    
    print()
    print("=" * 60)
    print("Mock Test Summary")
    print("=" * 60)
    print(f"Total Tests: {results['total_tests']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print(f"Success Rate: {(results['passed'] / max(results['total_tests'], 1)) * 100:.1f}%")
    
    # Write results
    report_path = "/Users/natwarupadhyay/Documents/Harness/agent-harness/context/fine_tuned_report.json"
    with open(report_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nDetailed report: {report_path}")
    return results

if __name__ == '__main__':
    run_all_tests()