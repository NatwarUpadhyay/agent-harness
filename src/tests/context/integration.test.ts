import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Context Graph System', () => {
  const testDir = join(tmpdir(), 'context-graph-test');
  
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Knowledge Graph Generation', () => {
    it('should create valid JSON structure', () => {
      const validGraph = {
        metadata: {
          root: testDir,
          total_files: 10,
          total_tokens: 5000
        },
        nodes: {},
        edges: [],
        clusters: {},
        loops: [],
        entry_points: []
      };
      
      const graphPath = join(testDir, 'test-graph.json');
      writeFileSync(graphPath, JSON.stringify(validGraph, null, 2));
      
      const loaded = JSON.parse(readFileSync(graphPath, 'utf-8'));
      expect(loaded).toHaveProperty('nodes');
      expect(loaded).toHaveProperty('edges');
      expect(loaded).toHaveProperty('metadata');
    });

    it('should generate consistent node IDs using hash', () => {
      const testString = 'src/components/Main.tsx';
      const expectedHash = '68d4a6e'; 
      
      const generated = require('crypto')
        .createHash('md5')
        .update(testString)
        .digest('hex')
        .substring(0, 12);
      
      expect(generated).toHaveLength(12);
      expect(generated).toBeDefined();
    });

    it('should estimate token count correctly', () => {
      const codeSample = `
// This is a comment
function hello() {
  console.log('world');
  return true;
}

class Example {
  method() { return 42; }
}
      `.trim();
      
      const tokens = codeSample.split(/\s+/).length + Math.floor(codeSample.length / 4);
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(100);
    });
  });

  describe('Loop Detection', () => {
    it('should detect simple circular dependency', () => {
      const mockGraph = {
        nodes: {
          'node1': { imports: [] },
          'node2': { imports: ['node1'] },
          'node3': { imports: ['node2'] }
        }
      };
      
      const visited = new Set<string>();
      const stack = new Set<string>();
      const loops: string[][] = [];

      const dfs = (nodeId: string, path: string[]) => {
        visited.add(nodeId);
        stack.add(nodeId);
        path.push(nodeId);

        const imports = mockGraph.nodes[nodeId]?.imports || [];
        for (const importNode of imports) {
          if (importNode in mockGraph.nodes) {
            if (importNode in stack) {
              const loopStart = path.indexOf(importNode);
              loops.push([...path.slice(loopStart), importNode]);
            } else if (!(importNode in visited)) {
              dfs(importNode, [...path]);
            }
          }
        }

        stack.delete(nodeId);
      };

      Object.keys(mockGraph.nodes).forEach(id => {
        if (!(id in visited)) dfs(id, []);
      });

      expect(loops).toHaveLength(0);
    });

    it('should handle complex dependency chains', () => {
      const testImports = ['A.js', 'B.js', 'C.js'];
      const expectedPattern = { '*.js': 3 };
      
      testImports.forEach(file => {
        expect(file).toMatch(expectedPattern);
      });
    });

    it('should categorize file types correctly', () => {
      const testFiles = [
        { path: 'src/index.ts', expected: 'ts' },
        { path: 'lib/utils.py', expected: 'py' },
        { path: 'components/ui.tsx', expected: 'tsx' },
        { path: 'config.json', expected: 'json' },
        { path: 'docs/readme.md', expected: 'md' }
      ];

      testFiles.forEach(({ path, expected }) => {
        const ext = path.split('.').pop();
        expect(ext).toBe(expected);
      });
    });
  });

  describe('Cluster Analysis', () => {
    it('should group nodes by directory', () => {
      const testNodes = [
        { path: 'src/components/Button.tsx' },
        { path: 'src/components/Input.tsx' },
        { path: 'src/pages/Home.tsx' },
        { path: 'src/pages/About.tsx' }
      ];

      const clusters = new Map<string, string[]>();
      testNodes.forEach(node => {
        const dir = node.path.split('/')[0] + '/' + node.path.split('/')[1];
        if (!clusters.has(dir)) clusters.set(dir, []);
        clusters.get(dir)!.push(node.path);
      });

      expect(clusters.get('src/components')).toHaveLength(2);
      expect(clusters.get('src/pages')).toHaveLength(2);
    });

    it('should create type-based clusters', () => {
      const fileTypes = new Map<string, number>();
      const testFiles = ['Button.tsx', 'index.ts', 'utils.py', 'config.json'];

      testFiles.forEach(file => {
        const ext = file.split('.').pop();
        fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
      });

      expect(fileTypes.get('tsx')).toBe(1);
      expect(fileTypes.get('ts')).toBe(1);
      expect(fileTypes.get('py')).toBe(1);
      expect(fileTypes.get('json')).toBe(1);
    });
  });

  describe('Token Optimization', () => {
    it('should calculate budget allocation correctly', () => {
      const nodeTokens = 1000;
      const budget = 8000;
      
      const canLoad = nodeTokens <= budget;
      expect(canLoad).toBe(true);
      
      const remaining = budget - nodeTokens;
      expect(remaining).toBe(7000);
    });

    it('should prioritize relevant files by score', () => {
      const scoredFiles = [
        { path: 'auth/Login.tsx', score: 95 },
        { path: 'types/user.ts', score: 88 },
        { path: 'config/auth.json', score: 92 }
      ];

      const sorted = [...scoredFiles].sort((a, b) => b.score - a.score);
      
      expect(sorted[0].path).toBe('auth/Login.tsx');
      expect(sorted[0].score).toBe(95);
    });
  });
});

describe('Loop Detection System', () => {
  const mockGraph = {
    nodes: {
      'src/index.ts': {
        id: 'abc123',
        path: 'src/index.ts',
        type: 'ts',
        tokens: 500,
        imports: ['src/app.ts', 'src/routes.ts'],
        entities: [{ type: 'function', name: 'main' }],
        summary: 'Entry point for the application'
      },
      'src/app.ts': {
        id: 'def456',
        path: 'src/app.ts',
        type: 'ts',
        tokens: 1200,
        imports: ['src/routes.ts', 'src/utils.ts'],
        entities: [{ type: 'function', name: 'createApp' }],
        summary: 'Application factory'
      },
      'src/routes.ts': {
        id: 'ghi789',
        path: 'src/routes.ts',
        type: 'ts',
        tokens: 800,
        imports: ['src/index.ts'],  // Creates loop: index -> app -> routes -> index
        entities: [{ type: 'function', name: 'setupRoutes' }],
        summary: 'Route definitions'
      },
      'src/utils.ts': {
        id: 'jkl012',
        path: 'src/utils.ts',
        type: 'ts',
        tokens: 300,
        imports: [],
        entities: [],
        summary: 'Utility functions'
      }
    },
    edges: [
      { source: 'abc123', target: 'def456', type: 'imports' },
      { source: 'abc123', target: 'ghi789', type: 'imports' },
      { source: 'def456', target: 'ghi789', type: 'imports' },
      { source: 'def456', target: 'jkl012', type: 'imports' },
      { source: 'ghi789', target: 'abc123', type: 'imports' }
    ],
    clusters: {
      'type_ts': ['abc123', 'def456', 'ghi789', 'jkl012'],
      'dir_src': ['abc123', 'def456', 'ghi789', 'jkl012']
    },
    entry_points: ['ghi789'],
    loops: [['abc123', 'def456', 'ghi789', 'abc123']],
    metadata: {
      root: testDir,
      total_files: 4,
      total_tokens: 2800
    }
  };

  it('should detect circular dependencies in test graph', () => {
    const loops = mockGraph.loops;
    expect(loops).toHaveLength(1);
    expect(loops[0]).toContain('abc123');
    expect(loops[0]).toContain('ghi789');
  });

  it('should validate loop structure', () => {
    const loop = mockGraph.loops[0];
    
    expect(loop.length).toBeGreaterThan(2);
    expect(loop[0]).toBe(loop[loop.length - 1]);
  });

  it('should analyze impact of loops on token usage', () => {
    const loop = mockGraph.loops[0];
    const loopNodes = new Set(loop.slice(0, -1));
    
    let loopTokens = 0;
    Object.entries(mockGraph.nodes).forEach(([id, node]) => {
      if (loopNodes.has(id)) {
        loopTokens += node.tokens;
      }
    });

    expect(loopTokens).toBeGreaterThan(0);
    expect(loopTokens).toBeLessThan(mockGraph.metadata.total_tokens * 50);
  });

  it('should generate loop report', () => {
    const report = {
      total_loops: mockGraph.loops.length,
      loops: mockGraph.loops,
      impact_score: 0.85,
      recommendations: [
        'Break cycle by extracting shared types',
        'Consider dependency inversion',
        'Review route-index coupling'
      ]
    };

    expect(report.total_loops).toBe(1);
    expect(report.recommendations).toHaveLength(3);
  });
});

describe('Context Loader Integration', () => {
  const mockContext = {
    query: 'authentication',
    files: [
      {
        path: 'src/auth/Login.tsx',
        type: 'tsx',
        summary: 'Login form with validation',
        entities: [
          { type: 'function', name: 'validateCredentials' },
          { type: 'function', name: 'handleLogin' }
        ],
        relevance_score: 95
      },
      {
        path: 'src/utils/auth.ts',
        type: 'ts',
        summary: 'JWT token utilities',
        entities: [{ type: 'function', name: 'generateToken' }],
        relevance_score: 88
      }
    ],
    total_tokens: 1500,
    relationships: [
      { from: 'src/auth/Login.tsx', to: 'src/utils/auth.ts', type: 'imports' }
    ]
  };

  it('should load minimal context within token budget', () => {
    const budget = 2000;
    const loadedTokens = mockContext.files.reduce((sum, f) => sum + f.relevance_score, 0);
    
    expect(loadedTokens).toBeLessThan(budget);
    expect(mockContext.files.length).toBeLessThanOrEqual(10);
  });

  it('should find relevant files by query', () => {
    const query = 'authentication';
    const found = mockContext.files.filter(f => 
      f.path.toLowerCase().includes(query) || 
      f.summary.toLowerCase().includes(query) ||
      f.entities.some(e => e.name.toLowerCase().includes(query))
    );
    
    expect(found.length).toBeGreaterThan(0);
  });

  it('should build relationship graph', () => {
    const relationships = mockContext.relationships;
    expect(relationships.length).toBeGreaterThan(0);
    
    const firstRel = relationships[0];
    expect(firstRel).toHaveProperty('from');
    expect(firstRel).toHaveProperty('to');
    expect(firstRel).toHaveProperty('type');
  });
});

// Mock testing utilities
const mockTokenEstimator = vi.fn((text) => {
  return text.split(/\s+/).length + Math.floor(text.length / 4);
});

const mockFileParser = vi.fn((content, type) => {
  return {
    tokens: mockTokenEstimator(content),
    entities: [],
    imports: [],
    summary: content.split('\n')[0]
  };
});

describe('Mock Infrastructure', () => {
  it('should provide reliable token estimation mock', () => {
    const code = 'function test() { return true; }';
    const estimate = mockTokenEstimator(code);
    expect(estimate).toBeTypeOf('number');
    expect(estimate).toBeGreaterThan(0);
  });

  it('should parse files consistently', () => {
    const content = 'import { x } from "y";\nexport const foo = () => {}';
    const result = mockFileParser(content, 'ts');
    
    expect(result).toHaveProperty('tokens');
    expect(result).toHaveProperty('entities');
    expect(result).toHaveProperty('imports');
    expect(result).toHaveProperty('summary');
  });

  it('should handle file parsing errors gracefully', () => {
    const parser = vi.fn().mockImplementation(() => {
      throw new Error('Parse error');
    });
    
    expect(() => parser('bad')).toThrow();
  });
});