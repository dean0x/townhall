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
   * Detect circular references in a relationship graph.
   *
   * Uses DFS to detect cycles. Returns error if cycle found.
   *
   * @param relationships - All relationships to check
   * @returns Result with void if no cycles, or error describing the cycle
   */
  detectCycles<TType extends string>(
    relationships: readonly IRelationship<TType>[]
  ): Result<void, BusinessRuleError> {
    const visited = new Set<ActionId>();
    const recursionStack = new Set<ActionId>();

    // Get all unique "from" nodes
    const fromNodes = new Set(relationships.map(r => r.fromId));

    for (const nodeId of fromNodes) {
      if (!visited.has(nodeId)) {
        const hasCycle = this.hasCycleDFS(
          nodeId,
          relationships,
          visited,
          recursionStack
        );

        if (hasCycle) {
          return err(new BusinessRuleError('Circular reference detected in relationships'));
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
   *
   * @param rootId - Starting action ID
   * @param relationships - All relationships
   * @returns Chain with all connected relationships and depth
   */
  buildChain<TType extends string>(
    rootId: ActionId,
    relationships: readonly IRelationship<TType>[]
  ): RelationshipChain<TType> {
    const chainRelationships: IRelationship<TType>[] = [];
    const visited = new Set<ActionId>();

    this.traverseChain(rootId, relationships, chainRelationships, visited);

    return {
      rootId,
      relationships: chainRelationships,
      depth: this.calculateDepth(chainRelationships),
    };
  }

  /**
   * Calculate the maximum depth of a relationship graph.
   *
   * @param relationships - Relationships to analyze
   * @returns Maximum depth (longest path)
   */
  calculateDepth<TType extends string>(
    relationships: readonly IRelationship<TType>[]
  ): number {
    if (relationships.length === 0) {
      return 0;
    }

    const depthMap = new Map<ActionId, number>();

    for (const rel of relationships) {
      const currentDepth = depthMap.get(rel.fromId) ?? 0;
      const newDepth = currentDepth + 1;

      for (const toId of rel.toIds) {
        const existingDepth = depthMap.get(toId) ?? 0;
        if (newDepth > existingDepth) {
          depthMap.set(toId, newDepth);
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

  private hasCycleDFS<TType extends string>(
    nodeId: ActionId,
    relationships: readonly IRelationship<TType>[],
    visited: Set<ActionId>,
    recursionStack: Set<ActionId>
  ): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    // Find all adjacent nodes
    const adjacentNodes = relationships
      .filter(r => r.fromId === nodeId)
      .flatMap(r => r.toIds);

    for (const adjacentId of adjacentNodes) {
      if (!visited.has(adjacentId)) {
        if (this.hasCycleDFS(adjacentId, relationships, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(adjacentId)) {
        return true; // Found a cycle
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  private traverseChain<TType extends string>(
    currentId: ActionId,
    relationships: readonly IRelationship<TType>[],
    chain: IRelationship<TType>[],
    visited: Set<ActionId>
  ): void {
    if (visited.has(currentId)) {
      return;
    }

    visited.add(currentId);

    const outgoing = relationships.filter(r => r.fromId === currentId);

    for (const rel of outgoing) {
      chain.push(rel);
      for (const toId of rel.toIds) {
        this.traverseChain(toId, relationships, chain, visited);
      }
    }
  }
}
