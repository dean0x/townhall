/**
 * ARCHITECTURE: Debate-specific service for consensus voting calculations
 * Pattern: Pure business logic for voting mechanisms using composition
 * Rationale: Complex voting rules separated from entities
 *
 * LOCATION: simulations/debate/services/ because this service uses
 * DebateSimulation and CloseVote which are debate-specific concepts.
 *
 * COMPOSITION: Delegates to GenericVoteCalculator for core calculations,
 * providing debate-specific API that takes DebateSimulation as parameter.
 */

import { Result, ok, err } from '../../../shared/result';
import { BusinessRuleError } from '../../../shared/errors';
import {
  GenericVoteCalculator,
  VotingRules as CoreVotingRules,
  VoteStatus as CoreVoteStatus,
} from '../../../core/voting';
import type { AgentId } from '../../../core/value-objects/AgentId';
import type { DebateSimulation } from '../DebateSimulation';
import type { CloseVote } from '../CloseVote';

/**
 * Debate-specific vote status extending core status.
 * Adds `canClose` for backward compatibility.
 */
export interface VoteStatus {
  readonly total: number;
  readonly required: number;
  readonly yesVotes: number;
  readonly noVotes: number;
  readonly hasConsensus: boolean;
  readonly canClose: boolean;
  readonly participationRate: number;
}

/**
 * Debate-specific voting rules.
 * Maps to core VotingRules for delegation.
 */
export interface VotingRules {
  readonly requireUnanimity: boolean;
  readonly minimumParticipation: number; // 0-1, percentage of participants
  readonly allowAbstention: boolean;
}

/**
 * Debate-specific vote calculator.
 *
 * Provides a high-level API that accepts DebateSimulation directly,
 * internally delegating to GenericVoteCalculator for core calculations.
 *
 * @example
 * ```typescript
 * const calculator = new VoteCalculator();
 * const status = calculator.calculateVoteStatus(simulation);
 * const pendingVoters = calculator.getPendingVoters(simulation);
 * ```
 */
export class VoteCalculator {
  private readonly genericCalculator: GenericVoteCalculator;
  private readonly defaultRules: VotingRules = {
    requireUnanimity: true,
    minimumParticipation: 1.0, // 100% participation required
    allowAbstention: false,
  };

  constructor() {
    this.genericCalculator = new GenericVoteCalculator();
  }

  /**
   * Convert debate-specific rules to core voting rules.
   */
  private toCoreRules(rules: VotingRules): CoreVotingRules {
    return {
      requireUnanimity: rules.requireUnanimity,
      minimumParticipation: rules.minimumParticipation,
      allowAbstention: rules.allowAbstention,
    };
  }

  /**
   * Convert core vote status to debate-specific status.
   */
  private fromCoreStatus(coreStatus: CoreVoteStatus): VoteStatus {
    return {
      total: coreStatus.total,
      required: coreStatus.required,
      yesVotes: coreStatus.yesVotes,
      noVotes: coreStatus.noVotes,
      hasConsensus: coreStatus.hasConsensus,
      canClose: coreStatus.hasConsensus, // In debate, canClose === hasConsensus
      participationRate: coreStatus.participationRate,
    };
  }

  public calculateVoteStatus(
    simulation: DebateSimulation,
    rules: VotingRules = this.defaultRules
  ): VoteStatus {
    const coreStatus = this.genericCalculator.calculateStatus(
      simulation.votesToClose,
      simulation.participantIds,
      this.toCoreRules(rules)
    );
    return this.fromCoreStatus(coreStatus);
  }

  /**
   * Validate that an agent can cast a vote.
   * Debate-specific validation rules.
   */
  public validateVote(
    agentId: AgentId,
    simulation: DebateSimulation
  ): Result<void, BusinessRuleError> {
    // Check if agent is participant
    if (!simulation.isParticipant(agentId)) {
      return err(new BusinessRuleError('Only participants can vote'));
    }

    // Delegate to generic calculator for has-voted check
    if (this.genericCalculator.hasVoted(agentId, simulation.votesToClose)) {
      return err(new BusinessRuleError('Agent has already voted'));
    }

    // Check if voting is allowed in current state
    if (simulation.status === 'closed') {
      return err(new BusinessRuleError('Cannot vote on closed debate'));
    }

    return ok(undefined);
  }

  /**
   * Calculate votes needed for consensus.
   * @returns 0 if consensus reached, -1 if impossible, positive number otherwise
   */
  public calculateTimeToConsensus(
    simulation: DebateSimulation,
    rules: VotingRules = this.defaultRules
  ): number {
    return this.genericCalculator.calculateVotesNeeded(
      simulation.votesToClose,
      simulation.participantIds,
      this.toCoreRules(rules)
    );
  }

  /**
   * Get a summary of voting progress.
   */
  public getVotingSummary(simulation: DebateSimulation): {
    readonly participants: number;
    readonly voted: number;
    readonly pending: number;
    readonly yesVotes: number;
    readonly noVotes: number;
    readonly consensusReached: boolean;
  } {
    const summary = this.genericCalculator.getSummary(
      simulation.votesToClose,
      simulation.participantIds
    );

    return {
      participants: summary.participants,
      voted: summary.voted,
      pending: summary.pending,
      yesVotes: summary.yesVotes,
      noVotes: summary.noVotes,
      consensusReached: summary.consensusReached,
    };
  }

  /**
   * Get agents who haven't voted yet.
   */
  public getPendingVoters(simulation: DebateSimulation): AgentId[] {
    return this.genericCalculator.getPendingVoters(
      simulation.votesToClose,
      simulation.participantIds
    );
  }

  /**
   * Analyze voting patterns over time.
   * Debate-specific return type with binary distribution.
   */
  public analyzeVotingPattern(votes: CloseVote[]): {
    readonly averageVoteTime: number;
    readonly quickestVote: number;
    readonly slowestVote: number;
    readonly voteDistribution: { yes: number; no: number };
  } {
    const analysis = this.genericCalculator.analyzePattern(votes);

    return {
      averageVoteTime: analysis.averageVoteTime,
      quickestVote: analysis.quickestVote,
      slowestVote: analysis.slowestVote,
      voteDistribution: {
        yes: analysis.voteDistribution.yes,
        no: analysis.voteDistribution.no,
      },
    };
  }
}
