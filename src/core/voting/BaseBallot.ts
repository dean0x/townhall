/**
 * ARCHITECTURE: Base interface for all ballot/vote types
 * Pattern: Minimal interface that all votes must implement
 * Rationale: Enables generic voting calculations across simulation types
 */

import type { AgentId } from '../value-objects/AgentId';
import type { Timestamp } from '../value-objects/Timestamp';

/**
 * Minimal interface that all ballot types must implement.
 *
 * Different simulation types extend this with type-specific fields:
 * - Debate: CloseVote adds `vote: boolean` and `reason?: string`
 * - Decision: ApprovalVote adds `vote: boolean` and `confidence: number`
 * - Brainstorm: IdeaRating adds `ideaId: string` and `rating: 1-5`
 *
 * @example
 * ```typescript
 * // Debate's close vote
 * interface CloseVote extends BaseBallot {
 *   readonly vote: boolean;
 *   readonly reason?: string;
 * }
 *
 * // Decision's approval vote
 * interface ApprovalVote extends BaseBallot {
 *   readonly vote: boolean;
 *   readonly confidence: number;
 * }
 * ```
 */
export interface BaseBallot {
  /** Agent who cast this vote */
  readonly agentId: AgentId;

  /** When the vote was cast */
  readonly timestamp: Timestamp;
}

/**
 * Extended ballot interface for binary (yes/no) votes.
 * Most simulation types use binary voting for decisions.
 */
export interface BinaryBallot extends BaseBallot {
  /** The vote: true = yes/approve, false = no/reject */
  readonly vote: boolean;
}

/**
 * Type guard to check if a ballot is binary
 */
export function isBinaryBallot(ballot: BaseBallot): ballot is BinaryBallot {
  return 'vote' in ballot && typeof (ballot as BinaryBallot).vote === 'boolean';
}
