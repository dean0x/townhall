/**
 * ARCHITECTURE: Generic graph operations for action relationships
 * Pattern: Pure functions operating on relationship collections
 * Rationale: Separates graph algorithms from domain-specific validation
 *
 * This provides reusable graph operations like:
 * - Cycle detection
 * - Depth calculation
 * - Path finding
 * - Relationship queries
 */

import { Result, ok, err } from '../../shared/result';
import { BusinessRuleError } from '../../shared/errors';
import type { ActionId } from '../simulation/IAction';
import type { IRelationship } from './IRelationship';

/**
 * Maximum recursion depth for graph traversal operations.
 * Prevents stack overflow from deeply nested or malicious graphs.
 */
export const MAX_GRAPH_DEPTH = 1000;

/**
 * Adjacency index for efficient graph lookups.
 * Pre-computes outgoing edges for O(1) neighbor lookup.
 */
export interface AdjacencyIndex<TType extends string = string> {
  /** Map from action ID to outgoing relationships */
  readonly outgoing: ReadonlyMap<ActionId, readonly IRelationship<TType>[]>;
  /** Map from action ID to incoming relationships */
  readonly incoming: ReadonlyMap<ActionId, readonly IRelationship<TType>[]>;
  /** All unique action IDs in the graph */
  readonly allNodes: ReadonlySet<ActionId>;
}

/**
 * Result of traversing a relationship chain.
 */
export interface RelationshipChain<TType extends string = string> {
  /** ID of the root action */
  readonly rootId: ActionId;

  /** All relationships in the chain */
  readonly relationships: readonly IRelationship<TType>[];

  /** Maximum depth from root */
  readonly depth: number;
}

/**
 * Statistics about a relationship graph.
 */
export interface GraphStats {
  /** Total number of relationships */
  readonly relationshipCount: number;

  /** Number of unique actions involved */
  readonly actionCount: number;

  /** Maximum depth in the graph */
  readonly maxDepth: number;

  /** Number of root nodes (no incoming edges) */
  readonly rootCount: number;

  /** Number of leaf nodes (no outgoing edges) */
  readonly leafCount: number;
}

/**
 * Generic relationship graph operations.
 *
 * Provides pure functions for working with relationship collections.
 * Does not store state - operates on relationship arrays passed to methods.
 *
 * @example
 * ```typescript
 * const graph = new RelationshipGraph();
 *
 * // Check for cycles
 * const cycleResult = graph.detectCycles(relationships);
 * if (cycleResult.isErr()) {
 *   console.error('Circular reference detected!');
 * }
 *
 * // Find all relationships targeting an action
 * const targeting = graph.findTargeting(actionId, relationships);
 * ```
 */
export class RelationshipGraph {
  /**
   * Build an adjacency index for efficient graph operations.
   *
   * Pre-computes outgoing and incoming edges for O(1) neighbor lookup
   * instead of O(E) filtering on each query.
   *
   * @param relationships - All relationships to index
   * @returns Adjacency index for the graph
   */
  buildIndex<TType extends string>(
    relationships: readonly IRelationship<TType>[]
  ): AdjacencyIndex<TType> {
    const outgoing = new Map<ActionId, IRelationship<TType>[]>();
    const incoming = new Map<ActionId, IRelationship<TType>[]>();
    const allNodes = new Set<ActionId>();

    for (const rel of relationships) {
      // Track all nodes
      allNodes.add(rel.fromId);
      for (const toId of rel.toIds) {
        allNodes.add(toId);
      }

      // Build outgoing index
      const existingOutgoing = outgoing.get(rel.fromId) ?? [];
      existingOutgoing.push(rel);
      outgoing.set(rel.fromId, existingOutgoing);

      // Build incoming index
      for (const toId of rel.toIds) {
        const existingIncoming = incoming.get(toId) ?? [];
        existingIncoming.push(rel);
        incoming.set(toId, existingIncoming);
      }
    }

    return { outgoing, incoming, allNodes };
  }

  /**
   * Detect circular references in a relationship graph.
   *
   * Uses DFS to detect cycles. Returns error if cycle found.
   * Includes depth limiting to prevent stack overflow on malicious input.
   *
   * @param relationships - All relationships to check
   * @param maxDepth - Maximum recursion depth (default: MAX_GRAPH_DEPTH)
   * @returns Result with void if no cycles, or error describing the cycle
   */
  detectCycles<TType extends string>(
    relationships: readonly IRelationship<TType>[],
    maxDepth: number = MAX_GRAPH_DEPTH
  ): Result<void, BusinessRuleError> {
    const index = this.buildIndex(relationships);
    const visited = new Set<ActionId>();
    const recursionStack = new Set<ActionId>();

    for (const nodeId of index.allNodes) {
      if (!visited.has(nodeId)) {
        const result = this.hasCycleDFSWithIndex(
          nodeId,
          index,
          visited,
          recursionStack,
          0,
          maxDepth
        );

        if (result.isErr()) {
          return result;
        }
      }
    }

    return ok(undefined);
  }

  /**
   * Find all relationships where the given action is a target.
   *
   * @param actionId - The action being targeted
   * @param relationships - All relationships to search
   * @returns Relationships where actionId is in toIds
   */
  findTargeting<TType extends string>(
    actionId: ActionId,
    relationships: readonly IRelationship<TType>[]
  ): IRelationship<TType>[] {
    return relationships.filter(r => r.toIds.includes(actionId));
  }

  /**
   * Find all relationships from a given action.
   *
   * @param actionId - The source action
   * @param relationships - All relationships to search
   * @returns Relationships where actionId is fromId
   */
  findFrom<TType extends string>(
    actionId: ActionId,
    relationships: readonly IRelationship<TType>[]
  ): IRelationship<TType>[] {
    return relationships.filter(r => r.fromId === actionId);
  }

  /**
   * Find all relationships involving a given action (as source or target).
   *
   * @param actionId - The action to find relationships for
   * @param relationships - All relationships to search
   * @returns All relationships involving actionId
   */
  findInvolving<TType extends string>(
    actionId: ActionId,
    relationships: readonly IRelationship<TType>[]
  ): IRelationship<TType>[] {
    return relationships.filter(
      r => r.fromId === actionId || r.toIds.includes(actionId)
    );
  }

  /**
   * Find relationships of a specific type.
   *
   * @param type - The relationship type to find
   * @param relationships - All relationships to search
   * @returns Relationships of the specified type
   */
  findByType<TType extends string>(
    type: TType,
    relationships: readonly IRelationship<TType>[]
  ): IRelationship<TType>[] {
    return relationships.filter(r => r.type === type);
  }

  /**
   * Build a chain of relationships starting from a root action.
   *
   * Traverses the graph from rootId, collecting all reachable relationships.
   * Includes depth limiting to prevent stack overflow.
   *
   * @param rootId - Starting action ID
   * @param relationships - All relationships
   * @param maxDepth - Maximum traversal depth (default: MAX_GRAPH_DEPTH)
   * @returns Chain with all connected relationships and depth
   */
  buildChain<TType extends string>(
    rootId: ActionId,
    relationships: readonly IRelationship<TType>[],
    maxDepth: number = MAX_GRAPH_DEPTH
  ): RelationshipChain<TType> {
    const index = this.buildIndex(relationships);
    const chainRelationships: IRelationship<TType>[] = [];
    const visited = new Set<ActionId>();

    this.traverseChainWithIndex(rootId, index, chainRelationships, visited, 0, maxDepth);

    return {
      rootId,
      relationships: chainRelationships,
      depth: this.calculateDepth(chainRelationships),
    };
  }

  /**
   * Calculate the maximum depth of a relationship graph.
   *
   * Uses topological ordering to correctly compute longest path,
   * handling graphs where edges aren't in traversal order.
   *
   * @param relationships - Relationships to analyze
   * @returns Maximum depth (longest path from any root to any leaf)
   */
  calculateDepth<TType extends string>(
    relationships: readonly IRelationship<TType>[]
  ): number {
    if (relationships.length === 0) {
      return 0;
    }

    const index = this.buildIndex(relationships);
    const depthMap = new Map<ActionId, number>();

    // Find roots (nodes with no incoming edges)
    const roots: ActionId[] = [];
    for (const nodeId of index.allNodes) {
      if (!index.incoming.has(nodeId) || index.incoming.get(nodeId)!.length === 0) {
        roots.push(nodeId);
        depthMap.set(nodeId, 0);
      }
    }

    // If no roots found (all nodes have incoming edges = cycle), return 0
    if (roots.length === 0) {
      return 0;
    }

    // BFS from roots to compute depths correctly
    const queue: ActionId[] = [...roots];
    const processed = new Set<ActionId>();

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (processed.has(current)) {
        continue;
      }
      processed.add(current);

      const currentDepth = depthMap.get(current) ?? 0;
      const outgoingRels = index.outgoing.get(current) ?? [];

      for (const rel of outgoingRels) {
        for (const toId of rel.toIds) {
          const existingDepth = depthMap.get(toId) ?? -1;
          const newDepth = currentDepth + 1;

          if (newDepth > existingDepth) {
            depthMap.set(toId, newDepth);
          }

          // Only add to queue if not already processed
          if (!processed.has(toId)) {
            queue.push(toId);
          }
        }
      }
    }

    return depthMap.size > 0 ? Math.max(...Array.from(depthMap.values())) : 0;
  }

  /**
   * Get statistics about a relationship graph.
   *
   * @param relationships - Relationships to analyze
   * @returns Graph statistics
   */
  getStats<TType extends string>(
    relationships: readonly IRelationship<TType>[]
  ): GraphStats {
    const fromIds = new Set(relationships.map(r => r.fromId));
    const toIds = new Set(relationships.flatMap(r => r.toIds));
    const allIds = new Set([...fromIds, ...toIds]);

    // Roots: have outgoing but no incoming
    const rootCount = [...fromIds].filter(id => !toIds.has(id)).length;

    // Leaves: have incoming but no outgoing
    const leafCount = [...toIds].filter(id => !fromIds.has(id)).length;

    return {
      relationshipCount: relationships.length,
      actionCount: allIds.size,
      maxDepth: this.calculateDepth(relationships),
      rootCount,
      leafCount,
    };
  }

  /**
   * Find all root actions (actions with no incoming relationships).
   *
   * @param relationships - All relationships
   * @returns Action IDs that are roots
   */
  findRoots<TType extends string>(
    relationships: readonly IRelationship<TType>[]
  ): ActionId[] {
    const fromIds = new Set(relationships.map(r => r.fromId));
    const toIds = new Set(relationships.flatMap(r => r.toIds));

    return [...fromIds].filter(id => !toIds.has(id));
  }

  /**
   * Find all leaf actions (actions with no outgoing relationships).
   *
   * @param relationships - All relationships
   * @returns Action IDs that are leaves
   */
  findLeaves<TType extends string>(
    relationships: readonly IRelationship<TType>[]
  ): ActionId[] {
    const fromIds = new Set(relationships.map(r => r.fromId));
    const toIds = new Set(relationships.flatMap(r => r.toIds));

    return [...toIds].filter(id => !fromIds.has(id));
  }

  // Private helper methods

  /**
   * DFS cycle detection using adjacency index with depth limiting.
   */
  private hasCycleDFSWithIndex<TType extends string>(
    nodeId: ActionId,
    index: AdjacencyIndex<TType>,
    visited: Set<ActionId>,
    recursionStack: Set<ActionId>,
    currentDepth: number,
    maxDepth: number
  ): Result<void, BusinessRuleError> {
    // Check depth limit
    if (currentDepth > maxDepth) {
      return err(new BusinessRuleError(
        `Graph traversal exceeded maximum depth of ${maxDepth}. ` +
        `This may indicate a very deep graph or potential security issue.`
      ));
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    // Get adjacent nodes from index (O(1) instead of O(E))
    const outgoingRels = index.outgoing.get(nodeId) ?? [];
    const adjacentNodes = outgoingRels.flatMap(r => r.toIds);

    for (const adjacentId of adjacentNodes) {
      if (!visited.has(adjacentId)) {
        const result = this.hasCycleDFSWithIndex(
          adjacentId,
          index,
          visited,
          recursionStack,
          currentDepth + 1,
          maxDepth
        );
        if (result.isErr()) {
          return result;
        }
      } else if (recursionStack.has(adjacentId)) {
        return err(new BusinessRuleError('Circular reference detected in relationships'));
      }
    }

    recursionStack.delete(nodeId);
    return ok(undefined);
  }

  /**
   * Chain traversal using adjacency index with depth limiting.
   */
  private traverseChainWithIndex<TType extends string>(
    currentId: ActionId,
    index: AdjacencyIndex<TType>,
    chain: IRelationship<TType>[],
    visited: Set<ActionId>,
    currentDepth: number,
    maxDepth: number
  ): void {
    // Check depth limit - silently stop if exceeded
    if (currentDepth > maxDepth || visited.has(currentId)) {
      return;
    }

    visited.add(currentId);

    const outgoingRels = index.outgoing.get(currentId) ?? [];

    for (const rel of outgoingRels) {
      chain.push(rel);
      for (const toId of rel.toIds) {
        this.traverseChainWithIndex(toId, index, chain, visited, currentDepth + 1, maxDepth);
      }
    }
  }
}
