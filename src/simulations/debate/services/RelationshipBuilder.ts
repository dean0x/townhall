/**
 * ARCHITECTURE: Debate-specific service for building argument relationships
 * Pattern: Pure business logic for debate relationship management using composition
 * Rationale: Complex relationship logic separated from entities
 *
 * LOCATION: simulations/debate/services/ because this service is inherently
 * debate-specific - it uses Rebuttal, Concession, ArgumentType which are
 * debate domain concepts.
 *
 * COMPOSITION: Implements IRelationshipBuilder interface from core/relationships
 * and delegates graph operations to RelationshipGraph.
 */

import { Result, ok, err, propagateError } from '../../../shared/result';
import { BusinessRuleError } from '../../../shared/errors';
import {
  IRelationshipBuilder,
  IRelationship,
  SingleTargetRelationship,
  RelationshipGraph,
} from '../../../core/relationships';
import type { ActionId } from '../../../core/simulation/IAction';
import { Argument } from '../entities/Argument';
import { Rebuttal } from '../entities/Rebuttal';
import { Concession } from '../entities/Concession';
import { ArgumentId } from '../value-objects/ArgumentId';

/**
 * Debate-specific relationship representation.
 * Uses single-target relationships (rebuttal -> argument).
 */
export interface ArgumentRelationship {
  readonly fromId: ArgumentId;
  readonly toId: ArgumentId;
  readonly type: RelationType;
  readonly strength?: number;
}

/**
 * Debate relationship types.
 */
export type RelationType = 'rebuts' | 'concedes_to' | 'supports' | 'elaborates';

/**
 * Debate-specific relationship chain.
 */
export interface RelationshipChain {
  readonly root: Argument;
  readonly relationships: ArgumentRelationship[];
  readonly depth: number;
}

/**
 * Source type for debate relationships (Argument, Rebuttal, or Concession).
 */
export type DebateActionSource = Argument | Rebuttal | Concession;

/**
 * Debate-specific relationship builder.
 *
 * Implements IRelationshipBuilder interface while providing debate-specific
 * convenience methods for creating rebuttal and concession relationships.
 * Delegates graph operations (cycle detection, depth calculation) to core
 * RelationshipGraph.
 *
 * @example
 * ```typescript
 * const builder = new RelationshipBuilder();
 *
 * // Create a rebuttal relationship
 * const result = builder.createRebuttalRelationship(rebuttal, targetArgument);
 *
 * // Or use the generic interface
 * const result = builder.createRelationship(rebuttal, targetArgument, 'rebuts');
 * ```
 */
export class RelationshipBuilder implements IRelationshipBuilder<DebateActionSource, Argument, RelationType> {
  private readonly graph: RelationshipGraph;

  constructor() {
    this.graph = new RelationshipGraph();
  }

  // ==========================================
  // IRelationshipBuilder Interface Methods
  // ==========================================

  /**
   * Create a relationship from source to target.
   * Implements IRelationshipBuilder interface.
   *
   * Routes to type-specific methods based on relationship type.
   */
  public createRelationship(
    source: DebateActionSource,
    target: Argument,
    type: RelationType
  ): Result<SingleTargetRelationship<RelationType>, BusinessRuleError> {
    // Route to specific method based on type
    let result: Result<ArgumentRelationship, BusinessRuleError>;

    switch (type) {
      case 'rebuts':
        if (!this.isRebuttal(source)) {
          return err(new BusinessRuleError('Rebuts relationship requires a Rebuttal source'));
        }
        result = this.createRebuttalRelationship(source, target);
        break;
      case 'concedes_to':
        if (!this.isConcession(source)) {
          return err(new BusinessRuleError('Concedes_to relationship requires a Concession source'));
        }
        result = this.createConcessionRelationship(source, target);
        break;
      case 'supports':
      case 'elaborates':
        // Generic support/elaboration relationships (future use)
        result = this.createGenericRelationship(source, target, type);
        break;
    }

    // Convert ArgumentRelationship to SingleTargetRelationship
    // ArgumentId is structurally compatible with ActionId (both are branded strings)
    return result.map(rel => ({
      fromId: rel.fromId as unknown as SingleTargetRelationship<RelationType>['fromId'],
      toId: rel.toId as unknown as SingleTargetRelationship<RelationType>['toId'],
      type: rel.type,
      ...(rel.strength !== undefined && { strength: rel.strength }),
    }));
  }

  /**
   * Find all direct relationships involving an action.
   * Overloaded for backwards compatibility with ArgumentRelationship.
   */
  public findDirectRelationships(
    actionId: string,
    relationships: readonly ArgumentRelationship[]
  ): ArgumentRelationship[];
  public findDirectRelationships(
    actionId: string,
    relationships: readonly IRelationship<RelationType>[]
  ): IRelationship<RelationType>[];
  public findDirectRelationships(
    actionId: string,
    relationships: readonly (IRelationship<RelationType> | ArgumentRelationship)[]
  ): (IRelationship<RelationType> | ArgumentRelationship)[] {
    // Handle ArgumentRelationship format (single toId)
    if (relationships.length > 0 && 'toId' in relationships[0]!) {
      // Filter ArgumentRelationship directly
      return (relationships as readonly ArgumentRelationship[]).filter(
        r => r.fromId === actionId || r.toId === actionId
      );
    }
    // Handle IRelationship format (toIds array)
    return this.graph.findInvolving(actionId as ActionId, relationships as readonly IRelationship<RelationType>[]);
  }

  /**
   * Detect circular references in a relationship graph.
   * Implements IRelationshipBuilder interface.
   * Delegates to core RelationshipGraph.
   *
   * Accepts both IRelationship format (toIds array) and
   * ArgumentRelationship format (toId single value) for backwards compatibility.
   */
  public detectCircularReferences(
    relationships: readonly (IRelationship<RelationType> | ArgumentRelationship)[]
  ): Result<void, BusinessRuleError> {
    // Convert ArgumentRelationship to IRelationship if needed
    const normalized: IRelationship<RelationType>[] = relationships.map(rel => {
      if ('toIds' in rel) {
        return rel;
      }
      // Convert single toId to toIds array
      return {
        fromId: rel.fromId as unknown as ActionId,
        toIds: [rel.toId as unknown as ActionId],
        type: rel.type,
        ...(rel.strength !== undefined && { strength: rel.strength }),
      };
    });
    return this.graph.detectCycles(normalized);
  }

  // ==========================================
  // Debate-Specific Convenience Methods
  // ==========================================

  /**
   * Create a rebuttal relationship.
   * Debate-specific convenience method.
   */
  public createRebuttalRelationship(
    rebuttal: Rebuttal,
    targetArgument: Argument
  ): Result<ArgumentRelationship, BusinessRuleError> {
    // Validate business rules
    const validationResult = this.validateRebuttalRules(rebuttal, targetArgument);
    if (validationResult.isErr()) {
      return propagateError(validationResult);
    }

    return ok({
      fromId: rebuttal.id,
      toId: rebuttal.targetArgumentId,
      type: 'rebuts',
      strength: this.calculateRebuttalStrength(rebuttal, targetArgument),
    });
  }

  public createConcessionRelationship(
    concession: Concession,
    targetArgument: Argument
  ): Result<ArgumentRelationship, BusinessRuleError> {
    // Validate business rules
    const validationResult = this.validateConcessionRules(concession, targetArgument);
    if (validationResult.isErr()) {
      return propagateError(validationResult);
    }

    return ok({
      fromId: concession.id,
      toId: concession.targetArgumentId,
      type: 'concedes_to',
      strength: this.calculateConcessionStrength(concession),
    });
  }

  public buildChain(
    rootArgument: Argument,
    _allArguments: Argument[],
    relationships: ArgumentRelationship[]
  ): RelationshipChain {
    const chainRelationships = this.findRelationshipChain(rootArgument.id, relationships);

    return {
      root: rootArgument,
      relationships: chainRelationships,
      depth: this.calculateChainDepth(chainRelationships),
    };
  }

  public findRebuttalTargets(
    argumentId: ArgumentId,
    relationships: ArgumentRelationship[]
  ): ArgumentId[] {
    return relationships
      .filter(rel => rel.toId === argumentId && rel.type === 'rebuts')
      .map(rel => rel.fromId);
  }

  public findConcessionTargets(
    argumentId: ArgumentId,
    relationships: ArgumentRelationship[]
  ): ArgumentId[] {
    return relationships
      .filter(rel => rel.toId === argumentId && rel.type === 'concedes_to')
      .map(rel => rel.fromId);
  }

  private validateRebuttalRules(
    rebuttal: Rebuttal,
    targetArgument: Argument
  ): Result<void, BusinessRuleError> {
    // Cannot rebut own argument
    if (rebuttal.agentId === targetArgument.agentId) {
      return err(new BusinessRuleError('Agents cannot rebut their own arguments'));
    }

    // Must be in same simulation
    if (rebuttal.simulationId !== targetArgument.simulationId) {
      return err(new BusinessRuleError('Rebuttal must target argument in same simulation'));
    }

    return ok(undefined);
  }

  private validateConcessionRules(
    concession: Concession,
    targetArgument: Argument
  ): Result<void, BusinessRuleError> {
    // Cannot concede to own argument
    if (concession.agentId === targetArgument.agentId) {
      return err(new BusinessRuleError('Agents cannot concede to their own arguments'));
    }

    // Must be in same simulation
    if (concession.simulationId !== targetArgument.simulationId) {
      return err(new BusinessRuleError('Concession must target argument in same simulation'));
    }

    return ok(undefined);
  }

  private calculateRebuttalStrength(rebuttal: Rebuttal, targetArgument: Argument): number {
    // Basic strength calculation based on argument types and content
    let strength = 0.5; // Base strength

    // Type-specific strength adjustments
    if (rebuttal.rebuttalType === 'empirical' && targetArgument.type === 'empirical') {
      strength += 0.2; // Empirical vs empirical is stronger
    }

    if (rebuttal.rebuttalType === 'logical' && targetArgument.type === 'deductive') {
      strength += 0.2; // Logical rebuttal of deductive argument
    }

    // Content length factor (longer rebuttals might be more thorough)
    const contentRatio = Math.min(rebuttal.content.text.length / targetArgument.content.text.length, 2);
    strength += (contentRatio - 1) * 0.1;

    return Math.max(0, Math.min(1, strength));
  }

  private calculateConcessionStrength(concession: Concession): number {
    // Concession strength based on type
    switch (concession.concessionType) {
      case 'full':
        return 1.0;
      case 'partial':
        return 0.6;
      case 'conditional':
        return 0.4;
    }
  }

  private findRelationshipChain(
    rootId: ArgumentId,
    relationships: ArgumentRelationship[]
  ): ArgumentRelationship[] {
    const chain: ArgumentRelationship[] = [];
    const visited = new Set<ArgumentId>();

    this.buildChainRecursive(rootId, relationships, chain, visited);

    return chain;
  }

  private buildChainRecursive(
    currentId: ArgumentId,
    relationships: ArgumentRelationship[],
    chain: ArgumentRelationship[],
    visited: Set<ArgumentId>
  ): void {
    if (visited.has(currentId)) {
      return;
    }

    visited.add(currentId);

    const directRelationships = relationships.filter(rel => rel.fromId === currentId);

    for (const relationship of directRelationships) {
      chain.push(relationship);
      this.buildChainRecursive(relationship.toId, relationships, chain, visited);
    }
  }

  private calculateChainDepth(relationships: ArgumentRelationship[]): number {
    if (relationships.length === 0) {
      return 0;
    }

    // Find the longest path in the relationship graph
    const depthMap = new Map<ArgumentId, number>();

    for (const relationship of relationships) {
      const currentDepth = depthMap.get(relationship.fromId) ?? 0;
      const newDepth = currentDepth + 1;
      const existingDepth = depthMap.get(relationship.toId) ?? 0;

      if (newDepth > existingDepth) {
        depthMap.set(relationship.toId, newDepth);
      }
    }

    return Math.max(...Array.from(depthMap.values()));
  }

  // ==========================================
  // Type Guards for Interface Implementation
  // ==========================================

  /**
   * Type guard to check if source is a Rebuttal.
   */
  private isRebuttal(source: DebateActionSource): source is Rebuttal {
    return 'rebuttalType' in source && 'targetArgumentId' in source;
  }

  /**
   * Type guard to check if source is a Concession.
   */
  private isConcession(source: DebateActionSource): source is Concession {
    return 'concessionType' in source && 'targetArgumentId' in source;
  }

  /**
   * Create a generic relationship for future use (supports, elaborates).
   */
  private createGenericRelationship(
    source: DebateActionSource,
    target: Argument,
    type: RelationType
  ): Result<ArgumentRelationship, BusinessRuleError> {
    // Validate same simulation
    if (source.simulationId !== target.simulationId) {
      return err(new BusinessRuleError(`${type} relationship must target argument in same simulation`));
    }

    return ok({
      fromId: source.id,
      toId: target.id,
      type,
      strength: 0.5, // Default strength for generic relationships
    });
  }
}
