/**
 * ARCHITECTURE: Domain service for building argument relationships
 * Pattern: Pure business logic for relationship management
 * Rationale: Complex relationship logic separated from entities
 */

import { Result, ok, err } from '../../shared/result';
import { BusinessRuleError } from '../../shared/errors';
import { ArgumentId } from '../value-objects/ArgumentId';
import { AgentId } from '../value-objects/AgentId';
import { Argument } from '../entities/Argument';
import { Rebuttal } from '../entities/Rebuttal';
import { Concession } from '../entities/Concession';

export interface ArgumentRelationship {
  readonly fromId: ArgumentId;
  readonly toId: ArgumentId;
  readonly type: RelationType;
  readonly strength?: number;
}

export type RelationType = 'rebuts' | 'concedes_to' | 'supports' | 'elaborates';

export interface RelationshipChain {
  readonly root: Argument;
  readonly relationships: ArgumentRelationship[];
  readonly depth: number;
}

export class RelationshipBuilder {
  public createRebuttalRelationship(
    rebuttal: Rebuttal,
    targetArgument: Argument
  ): Result<ArgumentRelationship, BusinessRuleError> {
    // Validate business rules
    const validationResult = this.validateRebuttalRules(rebuttal, targetArgument);
    if (validationResult.isErr()) {
      return validationResult;
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
      return validationResult;
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
    allArguments: Argument[],
    relationships: ArgumentRelationship[]
  ): RelationshipChain {
    const chainRelationships = this.findRelationshipChain(rootArgument.id, relationships);

    return {
      root: rootArgument,
      relationships: chainRelationships,
      depth: this.calculateChainDepth(chainRelationships),
    };
  }

  public findDirectRelationships(
    argumentId: ArgumentId,
    relationships: ArgumentRelationship[]
  ): ArgumentRelationship[] {
    return relationships.filter(
      rel => rel.fromId === argumentId || rel.toId === argumentId
    );
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

  public detectCircularReferences(
    relationships: ArgumentRelationship[]
  ): Result<void, BusinessRuleError> {
    const visited = new Set<ArgumentId>();
    const recursionStack = new Set<ArgumentId>();

    for (const relationship of relationships) {
      if (!visited.has(relationship.fromId)) {
        const hasCircle = this.hasCycleDFS(
          relationship.fromId,
          relationships,
          visited,
          recursionStack
        );

        if (hasCircle) {
          return err(new BusinessRuleError('Circular reference detected in argument relationships'));
        }
      }
    }

    return ok(undefined);
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

  private hasCycleDFS(
    nodeId: ArgumentId,
    relationships: ArgumentRelationship[],
    visited: Set<ArgumentId>,
    recursionStack: Set<ArgumentId>
  ): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const adjacentNodes = relationships
      .filter(rel => rel.fromId === nodeId)
      .map(rel => rel.toId);

    for (const adjacentId of adjacentNodes) {
      if (!visited.has(adjacentId)) {
        if (this.hasCycleDFS(adjacentId, relationships, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(adjacentId)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }
}