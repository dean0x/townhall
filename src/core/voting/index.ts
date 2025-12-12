/**
 * Generic voting mechanics for all simulation types.
 *
 * This module provides the shared foundation for voting:
 * - BaseBallot: Minimal interface all votes implement
 * - VotingRules: Configuration for consensus calculation
 * - VoteStatus: Current state of voting
 * - GenericVoteCalculator: Pure calculation functions
 *
 * Simulation types extend BaseBallot with type-specific fields
 * (e.g., CloseVote adds `reason`, ApprovalVote adds `confidence`).
 */

// Ballot types
export { BaseBallot, BinaryBallot, isBinaryBallot } from './BaseBallot';

// Rules and status
export {
  VotingRules,
  DEFAULT_VOTING_RULES,
  MAJORITY_VOTING_RULES,
  validateVotingRules,
} from './VotingRules';

export {
  VoteStatus,
  VotingSummary,
  VotingPatternAnalysis,
} from './VoteStatus';

// Interfaces
export {
  IVotingMechanism,
  IVoteValidator,
  VotingContext,
} from './IVotingMechanism';

// Calculator
export { GenericVoteCalculator } from './VoteCalculator';
