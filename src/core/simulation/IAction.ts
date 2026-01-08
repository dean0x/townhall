/**
 * ARCHITECTURE: Generic interface for all action types across simulations
 * Pattern: Interface with discriminator for type-safe pattern matching
 * Rationale: Enables polymorphic handling of actions (Argument, Proposal, Idea, etc.)
 *
 * Each simulation type defines its own action types that implement this interface:
 * - Debate: Argument, Rebuttal, Concession
 * - Decision: Proposal, Evaluation, Objection
 * - Brainstorm: Idea, BuildOn, Categorize
 */

import type { Brand } from '../../shared/types';
import type { AgentId } from '../value-objects/AgentId';
import type { SimulationId } from '../value-objects/SimulationId';
import type { Timestamp } from '../value-objects/Timestamp';

/**
 * Content-addressed action ID (SHA-256 hash).
 * Branded type prevents accidental mixing with other string identifiers.
 * Specific simulations may create narrower subtypes (e.g., ArgumentId).
 */
export type ActionId = Brand<string, 'ActionId'>;

/**
 * Base interface that all actions must implement.
 *
 * Actions are the atomic units of participation in a simulation.
 * They are immutable, content-addressed, and linked to an agent.
 *
 * @typeParam TId - The specific action ID type (defaults to ActionId).
 *                  Allows simulation-specific narrower types like ArgumentId.
 *
 * @example
 * ```typescript
 * // Debate's Argument implements IAction with ArgumentId
 * class Argument implements IAction<ArgumentId> {
 *   readonly actionType = 'argument';
 *   // ... debate-specific fields
 * }
 *
 * // Decision's Proposal implements IAction with ProposalId
 * class Proposal implements IAction<ProposalId> {
 *   readonly actionType = 'proposal';
 *   // ... decision-specific fields
 * }
 * ```
 */
export interface IAction<TId extends string = ActionId> {
  /** Content-addressed unique identifier (SHA-256 hash) */
  readonly id: TId;

  /** Simulation this action belongs to */
  readonly simulationId: SimulationId;

  /** Agent who created this action */
  readonly agentId: AgentId;

  /** When the action was created */
  readonly timestamp: Timestamp;

  /**
   * Discriminator for type narrowing.
   * Each action type has a unique string value.
   *
   * @example 'argument' | 'rebuttal' | 'concession' for debate
   * @example 'proposal' | 'evaluation' | 'objection' for decision
   */
  readonly actionType: string;

  /**
   * Human-readable text content of the action.
   * The interpretation depends on the action type.
   * Named 'textContent' to allow simulation-specific 'content' fields
   * with richer structure (e.g., Argument's content: ArgumentContent).
   */
  readonly textContent: string;
}

/**
 * Type guard to check if an object implements IAction.
 * Validates both structure and content:
 * - id, simulationId, agentId, actionType must be non-empty strings
 * - timestamp must be a valid ISO date string
 * - content must be a string (can be empty for some action types)
 */
export function isAction(obj: unknown): obj is IAction {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const action = obj as Record<string, unknown>;

  // Validate required identifier fields are non-empty strings
  if (typeof action.id !== 'string' || action.id.length === 0) {
    return false;
  }
  if (typeof action.simulationId !== 'string' || action.simulationId.length === 0) {
    return false;
  }
  if (typeof action.agentId !== 'string' || action.agentId.length === 0) {
    return false;
  }
  if (typeof action.actionType !== 'string' || action.actionType.length === 0) {
    return false;
  }

  // Validate timestamp is a valid ISO date string
  if (typeof action.timestamp !== 'string' || action.timestamp.length === 0) {
    return false;
  }
  const parsedDate = Date.parse(action.timestamp);
  if (isNaN(parsedDate)) {
    return false;
  }

  // textContent must be a string (can be empty for some action types)
  if (typeof action.textContent !== 'string') {
    return false;
  }

  return true;
}

/**
 * Minimal action data for storage/transfer.
 * Used when full entity isn't needed.
 */
export interface ActionSummary {
  readonly id: ActionId;
  readonly actionType: string;
  readonly agentId: AgentId;
  readonly timestamp: Timestamp;
  readonly contentPreview: string; // First N characters
}
