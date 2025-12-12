/**
 * ARCHITECTURE: Generic vote calculation service
 * Pattern: Pure functions operating on ballot collections
 * Rationale: Separates calculation logic from storage/entities
 *
 * This is a generic version that works with any BinaryBallot type.
 * The existing VoteCalculator in services/ will be updated to use this.
 */

import type { AgentId } from '../value-objects/AgentId';
import type { BinaryBallot } from './BaseBallot';
import type { VotingRules } from './VotingRules';
import type { VoteStatus, VotingSummary, VotingPatternAnalysis } from './VoteStatus';
import { DEFAULT_VOTING_RULES } from './VotingRules';

/**
 * Generic vote calculator that works with any binary ballot type.
 *
 * This class provides pure calculation functions that operate on
 * collections of ballots. It doesn't store state - that's the
 * responsibility of the simulation or voting mechanism.
 *
 * @example
 * ```typescript
 * const calculator = new GenericVoteCalculator();
 *
 * const status = calculator.calculateStatus(
 *   votes,           // CloseVote[] or ApprovalVote[]
 *   participantIds,  // AgentId[]
 *   rules           // VotingRules
 * );
 * ```
 */
export class GenericVoteCalculator {
  /**
   * Calculate voting status from a collection of ballots.
   *
   * @param ballots - Collection of binary votes
   * @param participantIds - All eligible voters
   * @param rules - Rules for consensus calculation
   * @returns Current voting status
   */
  calculateStatus<TBallot extends BinaryBallot>(
    ballots: readonly TBallot[],
    participantIds: readonly AgentId[],
    rules: VotingRules = DEFAULT_VOTING_RULES
  ): VoteStatus {
    const totalParticipants = participantIds.length;
    const yesVotes = ballots.filter(b => b.vote).length;
    const noVotes = ballots.filter(b => !b.vote).length;
    const totalVotes = ballots.length;

    const participationRate = totalParticipants > 0
      ? totalVotes / totalParticipants
      : 0;

    const meetsParticipation = participationRate >= rules.minimumParticipation;

    let hasConsensus = false;
    let thresholdMet = false;

    if (rules.requireUnanimity) {
      // Unanimity: everyone must vote yes
      hasConsensus = yesVotes === totalParticipants && totalVotes === totalParticipants;
      thresholdMet = hasConsensus;
    } else {
      // Majority: 50%+1 of participants must vote yes
      const majority = Math.floor(totalParticipants / 2) + 1;
      hasConsensus = yesVotes >= majority && meetsParticipation;
      thresholdMet = meetsParticipation;
    }

    return {
      total: totalVotes,
      required: totalParticipants,
      yesVotes,
      noVotes,
      abstentions: 0, // Binary ballots don't support abstention
      hasConsensus,
      thresholdMet,
      participationRate,
    };
  }

  /**
   * Get a summary suitable for display.
   *
   * @param ballots - Collection of binary votes
   * @param participantIds - All eligible voters
   * @returns Voting summary
   */
  getSummary<TBallot extends BinaryBallot>(
    ballots: readonly TBallot[],
    participantIds: readonly AgentId[]
  ): VotingSummary {
    const participants = participantIds.length;
    const voted = ballots.length;
    const yesVotes = ballots.filter(b => b.vote).length;
    const noVotes = ballots.filter(b => !b.vote).length;

    // Check consensus with default rules
    const status = this.calculateStatus(ballots, participantIds);

    return {
      participants,
      voted,
      pending: participants - voted,
      yesVotes,
      noVotes,
      consensusReached: status.hasConsensus,
    };
  }

  /**
   * Get agents who haven't voted yet.
   *
   * @param ballots - Collection of votes already cast
   * @param participantIds - All eligible voters
   * @returns Agent IDs who haven't voted
   */
  getPendingVoters<TBallot extends BinaryBallot>(
    ballots: readonly TBallot[],
    participantIds: readonly AgentId[]
  ): AgentId[] {
    const votedAgents = new Set(ballots.map(b => b.agentId));
    return participantIds.filter(id => !votedAgents.has(id));
  }

  /**
   * Calculate how many more yes votes are needed for consensus.
   *
   * @param ballots - Collection of votes already cast
   * @param participantIds - All eligible voters
   * @param rules - Voting rules
   * @returns Number of yes votes needed (0 if consensus reached, -1 if impossible)
   */
  calculateVotesNeeded<TBallot extends BinaryBallot>(
    ballots: readonly TBallot[],
    participantIds: readonly AgentId[],
    rules: VotingRules = DEFAULT_VOTING_RULES
  ): number {
    const status = this.calculateStatus(ballots, participantIds, rules);

    if (status.hasConsensus) {
      return 0;
    }

    // If unanimity required and there's a no vote, consensus is impossible
    if (rules.requireUnanimity && status.noVotes > 0) {
      return -1;
    }

    return Math.max(0, status.required - status.yesVotes);
  }

  /**
   * Analyze voting patterns over time.
   *
   * @param ballots - Collection of votes with timestamps
   * @returns Pattern analysis
   */
  analyzePattern<TBallot extends BinaryBallot>(
    ballots: readonly TBallot[]
  ): VotingPatternAnalysis {
    if (ballots.length === 0) {
      return {
        averageVoteTime: 0,
        quickestVote: 0,
        slowestVote: 0,
        voteDistribution: { yes: 0, no: 0, abstain: 0 },
      };
    }

    // Sort by timestamp
    const sorted = [...ballots].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate time between votes
    const voteTimes: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const current = new Date(sorted[i]!.timestamp).getTime();
      const previous = new Date(sorted[i - 1]!.timestamp).getTime();
      voteTimes.push(current - previous);
    }

    const averageVoteTime = voteTimes.length > 0
      ? voteTimes.reduce((sum, t) => sum + t, 0) / voteTimes.length
      : 0;

    return {
      averageVoteTime,
      quickestVote: voteTimes.length > 0 ? Math.min(...voteTimes) : 0,
      slowestVote: voteTimes.length > 0 ? Math.max(...voteTimes) : 0,
      voteDistribution: {
        yes: ballots.filter(b => b.vote).length,
        no: ballots.filter(b => !b.vote).length,
        abstain: 0,
      },
    };
  }

  /**
   * Check if an agent has already voted.
   *
   * @param agentId - Agent to check
   * @param ballots - Collection of votes
   * @returns true if agent has voted
   */
  hasVoted<TBallot extends BinaryBallot>(
    agentId: AgentId,
    ballots: readonly TBallot[]
  ): boolean {
    return ballots.some(b => b.agentId === agentId);
  }
}
