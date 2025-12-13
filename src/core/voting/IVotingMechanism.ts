/**
 * ARCHITECTURE: Generic interface for voting mechanisms
 * Pattern: Interface with type parameter for ballot type
 * Rationale: Enables different ballot types with same voting logic
 */

import type { Result } from '../../shared/result';
import type { BusinessRuleError } from '../../shared/errors';
import type { AgentId } from '../value-objects/AgentId';
import type { BaseBallot } from './BaseBallot';
import type { VotingRules } from './VotingRules';
import type { VoteStatus } from './VoteStatus';

/**
 * Interface for voting mechanisms that can work with any ballot type.
 *
 * Simulation types compose this interface with their ballot type:
 * - DebateSimulation uses IVotingMechanism<CloseVote>
 * - DecisionSimulation uses IVotingMechanism<ApprovalVote>
 *
 * @typeParam TBallot - The specific ballot type (must extend BaseBallot)
 *
 * @example
 * ```typescript
 * // In DebateSimulation
 * class DebateSimulation {
 *   private voting: IVotingMechanism<CloseVote>;
 *
 *   recordCloseVote(vote: CloseVote) {
 *     return this.voting.recordVote(vote);
 *   }
 * }
 * ```
 */
export interface IVotingMechanism<TBallot extends BaseBallot> {
  /**
   * Record a new vote.
   *
   * @param ballot - The vote to record
   * @returns Result with void on success, or error if vote is invalid
   */
  recordVote(ballot: TBallot): Result<void, BusinessRuleError>;

  /**
   * Check if consensus has been reached.
   *
   * @param rules - Voting rules to use for consensus calculation
   * @returns true if consensus reached according to rules
   */
  hasConsensus(rules: VotingRules): boolean;

  /**
   * Get current voting status.
   *
   * @param rules - Voting rules for status calculation
   * @returns Current vote status
   */
  getVoteStatus(rules: VotingRules): VoteStatus;

  /**
   * Get agents who haven't voted yet.
   *
   * @returns Array of agent IDs who still need to vote
   */
  getPendingVoters(): readonly AgentId[];

  /**
   * Get all recorded votes.
   *
   * @returns Array of all ballots cast
   */
  getVotes(): readonly TBallot[];

  /**
   * Check if an agent has already voted.
   *
   * @param agentId - Agent to check
   * @returns true if agent has voted
   */
  hasVoted(agentId: AgentId): boolean;
}

/**
 * Context needed for voting validation.
 * Passed to validators to check if a vote is allowed.
 */
export interface VotingContext {
  /** All participants eligible to vote */
  readonly participantIds: readonly AgentId[];

  /** Current status (may affect if voting is allowed) */
  readonly status: string;

  /** Whether voting is currently open */
  readonly votingOpen: boolean;
}

/**
 * Interface for vote validation logic.
 * Simulation types can provide custom validators.
 */
export interface IVoteValidator<TBallot extends BaseBallot> {
  /**
   * Validate that a vote can be recorded.
   *
   * @param ballot - The vote to validate
   * @param context - Current voting context
   * @returns Result with void on success, or error describing why vote is invalid
   */
  validate(ballot: TBallot, context: VotingContext): Result<void, BusinessRuleError>;
}
