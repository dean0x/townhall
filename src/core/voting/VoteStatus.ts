/**
 * ARCHITECTURE: Status information for voting progress
 * Pattern: Value object for vote tallying results
 * Rationale: Encapsulates all voting state information
 */

/**
 * Current status of a voting session.
 * Returned by VoteCalculator to report voting progress.
 */
export interface VoteStatus {
  /** Total votes cast so far */
  readonly total: number;

  /** Number of participants required to vote */
  readonly required: number;

  /** Number of yes/approve votes */
  readonly yesVotes: number;

  /** Number of no/reject votes */
  readonly noVotes: number;

  /** Number of abstentions (if allowed) */
  readonly abstentions: number;

  /** Whether consensus has been reached */
  readonly hasConsensus: boolean;

  /** Whether the voting threshold has been met (may differ from consensus) */
  readonly thresholdMet: boolean;

  /** Percentage of participants who have voted (0-1) */
  readonly participationRate: number;
}

/**
 * Summary of voting for display purposes.
 */
export interface VotingSummary {
  /** Total number of participants eligible to vote */
  readonly participants: number;

  /** Number who have voted */
  readonly voted: number;

  /** Number still to vote */
  readonly pending: number;

  /** Number of yes votes */
  readonly yesVotes: number;

  /** Number of no votes */
  readonly noVotes: number;

  /** Whether consensus has been reached */
  readonly consensusReached: boolean;
}

/**
 * Analysis of voting patterns over time.
 */
export interface VotingPatternAnalysis {
  /** Average time between votes (ms) */
  readonly averageVoteTime: number;

  /** Shortest time between votes (ms) */
  readonly quickestVote: number;

  /** Longest time between votes (ms) */
  readonly slowestVote: number;

  /** Distribution of votes */
  readonly voteDistribution: {
    readonly yes: number;
    readonly no: number;
    readonly abstain: number;
  };
}
