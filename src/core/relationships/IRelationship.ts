/**
 * ARCHITECTURE: Generic interface for relationships between actions
 * Pattern: Interface with type parameter for relationship type
 * Rationale: Enables different relationship types across simulations
 *
 * Examples of relationships:
 * - Debate: Rebuttal "rebuts" Argument, Concession "concedes_to" Argument
 * - Decision: Objection "objects_to" Proposal
 * - Brainstorm: Idea "builds_on" Idea, Categorization "groups" Ideas
 */

import type { ActionId } from '../simulation/IAction';

/**
 * Generic relationship between actions.
 *
 * @typeParam TType - String literal union of relationship types
 *
 * @example
 * ```typescript
 * // Debate relationships
 * type DebateRelationType = 'rebuts' | 'concedes_to' | 'supports';
 * const rebuttal: IRelationship<DebateRelationType> = {
 *   fromId: rebuttalId,
 *   toIds: [argumentId],
 *   type: 'rebuts',
 *   strength: 0.8,
 * };
 *
 * // Brainstorm relationships (can target multiple)
 * type BrainstormRelationType = 'builds_on' | 'combines';
 * const combination: IRelationship<BrainstormRelationType> = {
 *   fromId: newIdeaId,
 *   toIds: [idea1Id, idea2Id],
 *   type: 'combines',
 * };
 * ```
 */
export interface IRelationship<TType extends string = string> {
  /** ID of the source action (the one creating the relationship) */
  readonly fromId: ActionId;

  /**
   * IDs of target action(s).
   * Array to support relationships that target multiple actions
   * (e.g., combining multiple ideas into one).
   */
  readonly toIds: readonly ActionId[];

  /** Type of relationship */
  readonly type: TType;

  /**
   * Optional strength/weight of the relationship (0-1).
   * Interpretation depends on relationship type.
   */
  readonly strength?: number;

  /**
   * Optional metadata specific to this relationship.
   * Simulation types can store type-specific data here.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Simplified relationship for single-target cases.
 * Most relationships are single-target, so this is a convenience type.
 */
export interface SingleTargetRelationship<TType extends string = string> {
  readonly fromId: ActionId;
  readonly toId: ActionId;
  readonly type: TType;
  readonly strength?: number;
}

/**
 * Convert a single-target relationship to the standard format.
 */
export function toRelationship<TType extends string>(
  rel: SingleTargetRelationship<TType>
): IRelationship<TType> {
  return {
    fromId: rel.fromId,
    toIds: [rel.toId],
    type: rel.type,
    ...(rel.strength !== undefined && { strength: rel.strength }),
  };
}

/**
 * Type guard to check if an object is a relationship.
 * Validates both structure and content:
 * - fromId must be non-empty string
 * - toIds must be non-empty array of non-empty strings
 * - type must be non-empty string
 * - strength (if present) must be number between 0 and 1
 */
export function isRelationship(obj: unknown): obj is IRelationship {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const rel = obj as Record<string, unknown>;

  // Validate required fields are non-empty strings
  if (typeof rel.fromId !== 'string' || rel.fromId.length === 0) {
    return false;
  }
  if (typeof rel.type !== 'string' || rel.type.length === 0) {
    return false;
  }

  // Validate toIds is non-empty array of non-empty strings
  if (!Array.isArray(rel.toIds) || rel.toIds.length === 0) {
    return false;
  }
  if (!rel.toIds.every((id): id is string => typeof id === 'string' && id.length > 0)) {
    return false;
  }

  // Validate optional strength is in valid range
  if (rel.strength !== undefined) {
    if (typeof rel.strength !== 'number' || rel.strength < 0 || rel.strength > 1) {
      return false;
    }
  }

  return true;
}
