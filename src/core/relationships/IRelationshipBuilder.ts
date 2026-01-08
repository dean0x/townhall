/**
 * ARCHITECTURE: Generic interface for relationship building services
 * Pattern: Interface with type parameters for source, target, and relationship types
 * Rationale: Enables simulation-specific relationship builders with consistent API
 *
 * This interface defines the contract for building relationships between actions.
 * Unlike IRelationshipValidator (which only validates), this interface handles
 * the full lifecycle of relationship creation including strength calculation.
 *
 * @example
 * ```typescript
 * // Debate implementation
 * class DebateRelationshipBuilder implements IRelationshipBuilder<
 *   Argument | Rebuttal | Concession,  // TSource
 *   Argument,                           // TTarget
 *   DebateRelationType                  // TType
 * > {
 *   createRelationship(source, target, type) {
 *     // Validate, calculate strength, return relationship
 *   }
 * }
 * ```
 */

import type { Result } from '../../shared/result';
import type { BusinessRuleError } from '../../shared/errors';
import type { IRelationship, SingleTargetRelationship } from './IRelationship';

/**
 * Interface for building relationships between actions.
 *
 * @typeParam TSource - Type of the source action creating the relationship
 * @typeParam TTarget - Type of the target action being referenced
 * @typeParam TType - String literal union of relationship types
 */
export interface IRelationshipBuilder<
  TSource = unknown,
  TTarget = unknown,
  TType extends string = string
> {
  /**
   * Create a relationship from source to target.
   *
   * @param source - The action creating the relationship
   * @param target - The action being referenced
   * @param type - Type of relationship to create
   * @returns Result with the created relationship, or error if invalid
   */
  createRelationship(
    source: TSource,
    target: TTarget,
    type: TType
  ): Result<SingleTargetRelationship<TType>, BusinessRuleError>;

  /**
   * Find all direct relationships involving an action.
   *
   * @param actionId - ID of the action to find relationships for
   * @param relationships - Collection of relationships to search
   * @returns Relationships where the action is source or target
   */
  findDirectRelationships(
    actionId: string,
    relationships: readonly IRelationship<TType>[]
  ): IRelationship<TType>[];

  /**
   * Detect circular references in a relationship graph.
   *
   * @param relationships - Collection of relationships to check
   * @returns Result with void on success, or error if cycle detected
   */
  detectCircularReferences(
    relationships: readonly IRelationship<TType>[]
  ): Result<void, BusinessRuleError>;
}

/**
 * Configuration for relationship building.
 * Simulation types can customize these settings.
 */
export interface RelationshipBuilderConfig {
  /** Whether to allow self-referential relationships */
  readonly allowSelfReference: boolean;

  /** Whether to allow relationships across simulations */
  readonly allowCrossSimulation: boolean;

  /** Maximum depth for relationship chains */
  readonly maxChainDepth: number;
}

/**
 * Default configuration for relationship building.
 */
export const DEFAULT_RELATIONSHIP_CONFIG: RelationshipBuilderConfig = {
  allowSelfReference: false,
  allowCrossSimulation: false,
  maxChainDepth: 100,
};
