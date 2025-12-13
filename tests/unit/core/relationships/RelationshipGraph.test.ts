/**
 * Tests for RelationshipGraph
 *
 * Tests the generic graph operations for relationship collections.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph, MAX_GRAPH_DEPTH } from '../../../../src/core/relationships/RelationshipGraph';
import { IRelationship, toRelationship, isRelationship } from '../../../../src/core/relationships/IRelationship';
import type { ActionId } from '../../../../src/core/simulation/IAction';

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  // Helper to create action IDs
  const createActionId = (index: number): ActionId => `action-${index}`;

  // Define test relationship types
  type TestRelationType = 'rebuts' | 'supports' | 'builds_on';

  // Helper to create relationships
  const createRelationship = (
    fromIndex: number,
    toIndices: number[],
    type: TestRelationType
  ): IRelationship<TestRelationType> => ({
    fromId: createActionId(fromIndex),
    toIds: toIndices.map(createActionId),
    type,
  });

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  describe('detectCycles', () => {
    it('should return ok for empty relationships', () => {
      const result = graph.detectCycles([]);

      expect(result.isOk()).toBe(true);
    });

    it('should return ok for acyclic graph', () => {
      // A -> B -> C (linear chain)
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
        createRelationship(2, [3], 'rebuts'),
      ];

      const result = graph.detectCycles(relationships);

      expect(result.isOk()).toBe(true);
    });

    it('should return ok for tree structure', () => {
      //     A
      //    / \
      //   B   C
      //  / \
      // D   E
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2, 3], 'supports'),
        createRelationship(2, [4, 5], 'supports'),
      ];

      const result = graph.detectCycles(relationships);

      expect(result.isOk()).toBe(true);
    });

    it('should detect simple cycle', () => {
      // A -> B -> A (cycle)
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
        createRelationship(2, [1], 'rebuts'),
      ];

      const result = graph.detectCycles(relationships);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Circular reference');
      }
    });

    it('should detect longer cycle', () => {
      // A -> B -> C -> A (cycle)
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
        createRelationship(2, [3], 'rebuts'),
        createRelationship(3, [1], 'rebuts'),
      ];

      const result = graph.detectCycles(relationships);

      expect(result.isErr()).toBe(true);
    });

    it('should detect self-loop', () => {
      // A -> A (self-loop)
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [1], 'supports'),
      ];

      const result = graph.detectCycles(relationships);

      expect(result.isErr()).toBe(true);
    });
  });

  describe('findTargeting', () => {
    it('should return empty for no targeting relationships', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
      ];

      const targeting = graph.findTargeting(createActionId(1), relationships);

      expect(targeting).toHaveLength(0);
    });

    it('should find relationships targeting an action', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [3], 'rebuts'),
        createRelationship(2, [3], 'supports'),
        createRelationship(3, [4], 'builds_on'),
      ];

      const targeting = graph.findTargeting(createActionId(3), relationships);

      expect(targeting).toHaveLength(2);
      expect(targeting.map(r => r.fromId)).toContain(createActionId(1));
      expect(targeting.map(r => r.fromId)).toContain(createActionId(2));
    });

    it('should handle multi-target relationships', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2, 3, 4], 'supports'),
      ];

      expect(graph.findTargeting(createActionId(2), relationships)).toHaveLength(1);
      expect(graph.findTargeting(createActionId(3), relationships)).toHaveLength(1);
      expect(graph.findTargeting(createActionId(4), relationships)).toHaveLength(1);
      expect(graph.findTargeting(createActionId(5), relationships)).toHaveLength(0);
    });
  });

  describe('findFrom', () => {
    it('should return empty for no outgoing relationships', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
      ];

      const from = graph.findFrom(createActionId(2), relationships);

      expect(from).toHaveLength(0);
    });

    it('should find all relationships from an action', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
        createRelationship(1, [3], 'supports'),
        createRelationship(2, [3], 'builds_on'),
      ];

      const from = graph.findFrom(createActionId(1), relationships);

      expect(from).toHaveLength(2);
      expect(from.map(r => r.type)).toContain('rebuts');
      expect(from.map(r => r.type)).toContain('supports');
    });
  });

  describe('findInvolving', () => {
    it('should find all relationships involving an action', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),    // Action 2 is target
        createRelationship(2, [3], 'supports'),  // Action 2 is source
        createRelationship(3, [4], 'builds_on'), // Action 2 not involved
      ];

      const involving = graph.findInvolving(createActionId(2), relationships);

      expect(involving).toHaveLength(2);
    });

    it('should include multi-target relationships', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2, 3, 4], 'supports'),
      ];

      const involving = graph.findInvolving(createActionId(3), relationships);

      expect(involving).toHaveLength(1);
    });
  });

  describe('findByType', () => {
    it('should filter by relationship type', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
        createRelationship(2, [3], 'supports'),
        createRelationship(3, [4], 'rebuts'),
        createRelationship(4, [5], 'builds_on'),
      ];

      const rebuttals = graph.findByType('rebuts', relationships);
      const supports = graph.findByType('supports', relationships);
      const builds = graph.findByType('builds_on', relationships);

      expect(rebuttals).toHaveLength(2);
      expect(supports).toHaveLength(1);
      expect(builds).toHaveLength(1);
    });
  });

  describe('buildChain', () => {
    it('should build empty chain for isolated node', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(2, [3], 'rebuts'),
      ];

      const chain = graph.buildChain(createActionId(1), relationships);

      expect(chain.rootId).toBe(createActionId(1));
      expect(chain.relationships).toHaveLength(0);
      expect(chain.depth).toBe(0);
    });

    it('should build linear chain', () => {
      // 1 -> 2 -> 3
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
        createRelationship(2, [3], 'rebuts'),
      ];

      const chain = graph.buildChain(createActionId(1), relationships);

      expect(chain.rootId).toBe(createActionId(1));
      expect(chain.relationships).toHaveLength(2);
      expect(chain.depth).toBe(2);
    });

    it('should build branching chain', () => {
      //   1
      //  / \
      // 2   3
      //     |
      //     4
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2, 3], 'supports'),
        createRelationship(3, [4], 'builds_on'),
      ];

      const chain = graph.buildChain(createActionId(1), relationships);

      expect(chain.relationships).toHaveLength(2);
    });
  });

  describe('calculateDepth', () => {
    it('should return 0 for empty relationships', () => {
      const depth = graph.calculateDepth([]);

      expect(depth).toBe(0);
    });

    it('should calculate linear chain depth', () => {
      // 1 -> 2 -> 3 -> 4 (depth 3)
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
        createRelationship(2, [3], 'rebuts'),
        createRelationship(3, [4], 'rebuts'),
      ];

      const depth = graph.calculateDepth(relationships);

      expect(depth).toBe(3);
    });

    it('should find max depth in branching graph', () => {
      //   1        depth 0
      //  / \
      // 2   3      depth 1
      //     |
      //     4      depth 2
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2, 3], 'supports'),
        createRelationship(3, [4], 'builds_on'),
      ];

      const depth = graph.calculateDepth(relationships);

      expect(depth).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return stats for empty graph', () => {
      const stats = graph.getStats([]);

      expect(stats.relationshipCount).toBe(0);
      expect(stats.actionCount).toBe(0);
      expect(stats.maxDepth).toBe(0);
      expect(stats.rootCount).toBe(0);
      expect(stats.leafCount).toBe(0);
    });

    it('should calculate stats for simple graph', () => {
      // 1 -> 2 -> 3
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
        createRelationship(2, [3], 'rebuts'),
      ];

      const stats = graph.getStats(relationships);

      expect(stats.relationshipCount).toBe(2);
      expect(stats.actionCount).toBe(3);
      expect(stats.maxDepth).toBe(2);
      expect(stats.rootCount).toBe(1); // 1 is root
      expect(stats.leafCount).toBe(1); // 3 is leaf
    });

    it('should handle multiple roots and leaves', () => {
      // 1 -> 3
      // 2 -> 3
      // 3 -> 4
      // 3 -> 5
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [3], 'supports'),
        createRelationship(2, [3], 'supports'),
        createRelationship(3, [4], 'builds_on'),
        createRelationship(3, [5], 'builds_on'),
      ];

      const stats = graph.getStats(relationships);

      expect(stats.rootCount).toBe(2); // 1, 2 are roots
      expect(stats.leafCount).toBe(2); // 4, 5 are leaves
    });
  });

  describe('findRoots', () => {
    it('should find root nodes', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [3], 'supports'),
        createRelationship(2, [3], 'supports'),
        createRelationship(3, [4], 'builds_on'),
      ];

      const roots = graph.findRoots(relationships);

      expect(roots).toHaveLength(2);
      expect(roots).toContain(createActionId(1));
      expect(roots).toContain(createActionId(2));
    });
  });

  describe('findLeaves', () => {
    it('should find leaf nodes', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'supports'),
        createRelationship(2, [3], 'builds_on'),
        createRelationship(2, [4], 'builds_on'),
      ];

      const leaves = graph.findLeaves(relationships);

      expect(leaves).toHaveLength(2);
      expect(leaves).toContain(createActionId(3));
      expect(leaves).toContain(createActionId(4));
    });
  });

  describe('buildIndex', () => {
    it('should build empty index for empty relationships', () => {
      const index = graph.buildIndex([]);

      expect(index.outgoing.size).toBe(0);
      expect(index.incoming.size).toBe(0);
      expect(index.allNodes.size).toBe(0);
    });

    it('should track all nodes in the graph', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2, 3], 'supports'),
        createRelationship(2, [4], 'rebuts'),
      ];

      const index = graph.buildIndex(relationships);

      expect(index.allNodes.size).toBe(4);
      expect(index.allNodes.has(createActionId(1))).toBe(true);
      expect(index.allNodes.has(createActionId(2))).toBe(true);
      expect(index.allNodes.has(createActionId(3))).toBe(true);
      expect(index.allNodes.has(createActionId(4))).toBe(true);
    });

    it('should build correct outgoing index', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'supports'),
        createRelationship(1, [3], 'rebuts'),
        createRelationship(2, [4], 'builds_on'),
      ];

      const index = graph.buildIndex(relationships);

      // Node 1 has two outgoing relationships
      expect(index.outgoing.get(createActionId(1))).toHaveLength(2);
      // Node 2 has one outgoing relationship
      expect(index.outgoing.get(createActionId(2))).toHaveLength(1);
      // Node 3 has no outgoing relationships
      expect(index.outgoing.has(createActionId(3))).toBe(false);
    });

    it('should build correct incoming index', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [3], 'supports'),
        createRelationship(2, [3], 'rebuts'),
      ];

      const index = graph.buildIndex(relationships);

      // Node 3 has two incoming relationships
      expect(index.incoming.get(createActionId(3))).toHaveLength(2);
      // Node 1 has no incoming relationships
      expect(index.incoming.has(createActionId(1))).toBe(false);
    });
  });

  describe('depth limiting', () => {
    it('should detect cycle within depth limit', () => {
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'rebuts'),
        createRelationship(2, [1], 'rebuts'),
      ];

      const result = graph.detectCycles(relationships, 10);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Circular reference');
      }
    });

    it('should return error when depth limit exceeded', () => {
      // Create a very deep linear chain: 1 -> 2 -> 3 -> ... -> 15
      const relationships: IRelationship<TestRelationType>[] = [];
      for (let i = 1; i <= 14; i++) {
        relationships.push(createRelationship(i, [i + 1], 'supports'));
      }

      // With depth limit of 10, traversal should fail
      const result = graph.detectCycles(relationships, 10);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('exceeded maximum depth');
      }
    });

    it('should allow deep graphs within default depth limit', () => {
      // Create a chain within MAX_GRAPH_DEPTH
      const relationships: IRelationship<TestRelationType>[] = [];
      for (let i = 1; i <= 100; i++) {
        relationships.push(createRelationship(i, [i + 1], 'supports'));
      }

      const result = graph.detectCycles(relationships);

      expect(result.isOk()).toBe(true);
    });

    it('should respect custom depth limit in buildChain', () => {
      // Create chain: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
      const relationships: IRelationship<TestRelationType>[] = [
        createRelationship(1, [2], 'supports'),
        createRelationship(2, [3], 'supports'),
        createRelationship(3, [4], 'supports'),
        createRelationship(4, [5], 'supports'),
        createRelationship(5, [6], 'supports'),
        createRelationship(6, [7], 'supports'),
      ];

      // Full chain should have all 6 relationships
      const fullChain = graph.buildChain(createActionId(1), relationships);
      expect(fullChain.relationships).toHaveLength(6);

      // With depth limit of 2, traversal starts at depth 0 and stops when > 2
      // So we traverse: depth 0 (node 1), depth 1 (node 2), depth 2 (node 3)
      // and stop before depth 3, meaning 2 relationships collected
      const limitedChain = graph.buildChain(createActionId(1), relationships, 2);

      // With limit 2, should have fewer relationships than full chain
      expect(limitedChain.relationships.length).toBeLessThan(fullChain.relationships.length);
    });

    it('should use MAX_GRAPH_DEPTH as default limit', () => {
      // Verify the constant is exported and reasonable
      expect(MAX_GRAPH_DEPTH).toBe(1000);
    });
  });
});

describe('IRelationship utilities', () => {
  describe('toRelationship', () => {
    it('should convert single-target to standard format', () => {
      const single = {
        fromId: 'action-1',
        toId: 'action-2',
        type: 'rebuts' as const,
        strength: 0.8,
      };

      const result = toRelationship(single);

      expect(result.fromId).toBe('action-1');
      expect(result.toIds).toEqual(['action-2']);
      expect(result.type).toBe('rebuts');
      expect(result.strength).toBe(0.8);
    });
  });

  describe('isRelationship', () => {
    it('should return true for valid relationship', () => {
      const rel: IRelationship = {
        fromId: 'action-1',
        toIds: ['action-2'],
        type: 'rebuts',
      };

      expect(isRelationship(rel)).toBe(true);
    });

    it('should return true for relationship with valid strength', () => {
      const rel = {
        fromId: 'action-1',
        toIds: ['action-2'],
        type: 'rebuts',
        strength: 0.5,
      };

      expect(isRelationship(rel)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isRelationship(null)).toBe(false);
    });

    it('should return false for missing fromId', () => {
      expect(isRelationship({ toIds: ['a'], type: 'x' })).toBe(false);
    });

    it('should return false for empty fromId', () => {
      expect(isRelationship({ fromId: '', toIds: ['a'], type: 'x' })).toBe(false);
    });

    it('should return false for missing toIds', () => {
      expect(isRelationship({ fromId: 'a', type: 'x' })).toBe(false);
    });

    it('should return false for empty toIds array', () => {
      expect(isRelationship({ fromId: 'a', toIds: [], type: 'x' })).toBe(false);
    });

    it('should return false for non-array toIds', () => {
      expect(isRelationship({ fromId: 'a', toIds: 'b', type: 'x' })).toBe(false);
    });

    it('should return false for toIds containing non-strings', () => {
      expect(isRelationship({ fromId: 'a', toIds: [123], type: 'x' })).toBe(false);
    });

    it('should return false for toIds containing empty strings', () => {
      expect(isRelationship({ fromId: 'a', toIds: ['b', ''], type: 'x' })).toBe(false);
    });

    it('should return false for missing type', () => {
      expect(isRelationship({ fromId: 'a', toIds: ['b'] })).toBe(false);
    });

    it('should return false for empty type', () => {
      expect(isRelationship({ fromId: 'a', toIds: ['b'], type: '' })).toBe(false);
    });

    it('should return false for strength below 0', () => {
      expect(isRelationship({ fromId: 'a', toIds: ['b'], type: 'x', strength: -0.1 })).toBe(false);
    });

    it('should return false for strength above 1', () => {
      expect(isRelationship({ fromId: 'a', toIds: ['b'], type: 'x', strength: 1.1 })).toBe(false);
    });

    it('should return true for strength at boundaries (0 and 1)', () => {
      expect(isRelationship({ fromId: 'a', toIds: ['b'], type: 'x', strength: 0 })).toBe(true);
      expect(isRelationship({ fromId: 'a', toIds: ['b'], type: 'x', strength: 1 })).toBe(true);
    });
  });
});
