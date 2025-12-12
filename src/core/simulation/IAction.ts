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

import type { AgentId } from '../value-objects/AgentId';
import type { SimulationId } from '../value-objects/SimulationId';
import type { Timestamp } from '../value-objects/Timestamp';

/**
 * Content-addressed action ID (SHA-256 hash).
 * This is a type alias that can be used for any action type.
 * Specific simulations may brand this further (e.g., ArgumentId).
 */
export type ActionId = string;

/**
 * Base interface that all actions must implement.
 *
 * Actions are the atomic units of participation in a simulation.
 * They are immutable, content-addressed, and linked to an agent.
 *
 * @example
 * ```typescript
 * // Debate's Argument implements IAction
 * class Argument implements IAction {
 *   readonly actionType = 'argument';
 *   // ... debate-specific fields
 * }
 *
 * // Decision's Proposal implements IAction
 * class Proposal implements IAction {
 *   readonly actionType = 'proposal';
 *   // ... decision-specific fields
 * }
 * ```
 */
export interface IAction {
  /** Content-addressed unique identifier (SHA-256 hash) */
  readonly id: ActionId;

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
   * Human-readable content of the action.
   * The interpretation depends on the action type.
   */
  readonly content: string;
}

/**
 * Type guard to check if an object implements IAction
 */
export function isAction(obj: unknown): obj is IAction {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const action = obj as Record<string, unknown>;
  return (
    typeof action.id === 'string' &&
    typeof action.simulationId === 'string' &&
    typeof action.agentId === 'string' &&
    typeof action.timestamp === 'string' &&
    typeof action.actionType === 'string' &&
    typeof action.content === 'string'
  );
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
