/**
 * ARCHITECTURE: Debate-specific ballot type for close votes
 * Pattern: Extends BinaryBallot with optional reason field
 * Rationale: Allows agents to explain their vote to close a debate
 */

import type { BinaryBallot } from '../../core/voting/BaseBallot';
import type { AgentId } from '../../core/value-objects/AgentId';
import type { Timestamp } from '../../core/value-objects/Timestamp';

/**
 * Vote to close a debate.
 * Extends BinaryBallot with an optional reason for the vote.
 *
 * @example
 * ```typescript
 * const closeVote: CloseVote = {
 *   agentId: 'agent-123' as AgentId,
 *   timestamp: '2025-01-01T10:00:00Z' as Timestamp,
 *   vote: true,
 *   reason: 'All major points have been addressed',
 * };
 * ```
 */
export interface CloseVote extends BinaryBallot {
  /** Optional explanation for the vote */
  readonly reason?: string;
}

/**
 * Factory function to create a CloseVote.
 * Enforces immutability and proper structure.
 */
export function createCloseVote(params: {
  readonly agentId: AgentId;
  readonly vote: boolean;
  readonly timestamp: Timestamp;
  readonly reason?: string;
}): CloseVote {
  const vote: CloseVote = {
    agentId: params.agentId,
    vote: params.vote,
    timestamp: params.timestamp,
    ...(params.reason !== undefined && { reason: params.reason }),
  };
  return Object.freeze(vote);
}

/**
 * Type guard to check if a ballot is a CloseVote.
 * Validates structure and field types.
 */
export function isCloseVote(ballot: unknown): ballot is CloseVote {
  if (typeof ballot !== 'object' || ballot === null) {
    return false;
  }
  const b = ballot as Record<string, unknown>;

  // Required fields
  if (typeof b.agentId !== 'string' || b.agentId.length === 0) {
    return false;
  }
  if (typeof b.vote !== 'boolean') {
    return false;
  }
  if (typeof b.timestamp !== 'string' || b.timestamp.length === 0) {
    return false;
  }

  // Optional reason field
  if (b.reason !== undefined && typeof b.reason !== 'string') {
    return false;
  }

  return true;
}
