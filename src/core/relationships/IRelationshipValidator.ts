/**
 * ARCHITECTURE: Interface for relationship validation
 * Pattern: Strategy pattern for simulation-specific validation
 * Rationale: Each simulation type defines its own relationship rules
 */

import type { Result } from '../../shared/result';
import type { ValidationError } from '../../shared/errors';
import type { IRelationship } from './IRelationship';

/**
 * Interface for validating relationships.
 *
 * Each simulation type implements this to enforce its rules:
 * - Debate: Can't rebut own argument, must be in same simulation
 * - Decision: Objections require justification
 * - Brainstorm: Builds-on must reference existing ideas
 *
 * @typeParam TSource - Type of the source action
 * @typeParam TTarget - Type of the target action(s)
 * @typeParam TType - Relationship type string literal union
 *
 * @example
 * ```typescript
 * class DebateRelationshipValidator
 *   implements IRelationshipValidator<Rebuttal, Argument, DebateRelationType> {
 *
 *   validate(
 *     source: Rebuttal,
 *     targets: Argument[],
 *     type: DebateRelationType
 *   ): Result<void, ValidationError> {
 *     // Can't rebut own argument
 *     if (source.agentId === targets[0].agentId) {
 *       return err(new ValidationError('Cannot rebut own argument'));
 *     }
 *     return ok(undefined);
 *   }
 * }
 * ```
 */
export interface IRelationshipValidator<
  TSource = unknown,
  TTarget = unknown,
  TType extends string = string
> {
  /**
   * Validate that a relationship can be created.
   *
   * @param source - The action creating the relationship
   * @param targets - The action(s) being targeted
   * @param type - Type of relationship being created
   * @returns Result with void on success, or ValidationError
   */
  validate(
    source: TSource,
    targets: readonly TTarget[],
    type: TType
  ): Result<void, ValidationError>;
}

/**
 * Context for relationship validation.
 * Provides additional information validators might need.
 */
export interface RelationshipValidationContext {
  /** ID of the simulation */
  readonly simulationId: string;

  /** All existing relationships in the simulation */
  readonly existingRelationships: readonly IRelationship[];

  /** Whether to allow relationships to closed/completed simulations */
  readonly allowClosedSimulation: boolean;
}

