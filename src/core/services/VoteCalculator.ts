/**
 * ARCHITECTURE: Domain service for consensus voting calculations
 * Pattern: Pure business logic for voting mechanisms
 * Rationale: Complex voting rules separated from entities
 */

import { Result, ok, err } from '../../shared/result';
import { BusinessRuleError } from '../../shared/errors';
import { AgentId } from '../value-objects/AgentId';
import { DebateSimulation, CloseVote } from '../entities/DebateSimulation';

export interface VoteStatus {
  readonly total: number;
  readonly required: number;
  readonly yesVotes: number;
  readonly noVotes: number;
  readonly hasConsensus: boolean;
  readonly canClose: boolean;
  readonly participationRate: number;
}

export interface VotingRules {
  readonly requireUnanimity: boolean;
  readonly minimumParticipation: number; // 0-1, percentage of participants
  readonly allowAbstention: boolean;
}

export class VoteCalculator {
  private readonly defaultRules: VotingRules = {
    requireUnanimity: true,
    minimumParticipation: 1.0, // 100% participation required
    allowAbstention: false,
  };

  public calculateVoteStatus(
    simulation: DebateSimulation,
    rules: VotingRules = this.defaultRules
  ): VoteStatus {
    const totalParticipants = simulation.getParticipantCount();
    const votes = simulation.votesToClose;
    const yesVotes = votes.filter(v => v.vote).length;
    const noVotes = votes.filter(v => !v.vote).length;
    const totalVotes = votes.length;

    const participationRate = totalParticipants > 0 ? totalVotes / totalParticipants : 0;
    const meetsParticipation = participationRate >= rules.minimumParticipation;

    let hasConsensus = false;
    let canClose = false;

    if (rules.requireUnanimity) {
      hasConsensus = yesVotes === totalParticipants && totalVotes === totalParticipants;
      canClose = hasConsensus;
    } else {
      // Majority rule (not implemented in MVP, but prepared for future)
      const majority = Math.floor(totalParticipants / 2) + 1;
      hasConsensus = yesVotes >= majority && meetsParticipation;
      canClose = hasConsensus;
    }

    return {
      total: totalVotes,
      required: totalParticipants,
      yesVotes,
      noVotes,
      hasConsensus,
      canClose,
      participationRate,
    };
  }

  public validateVote(
    agentId: AgentId,
    simulation: DebateSimulation
  ): Result<void, BusinessRuleError> {
    // Check if agent is participant
    if (!simulation.isParticipant(agentId)) {
      return err(new BusinessRuleError('Only participants can vote'));
    }

    // Check if agent has already voted
    const hasVoted = simulation.votesToClose.some(vote => vote.agentId === agentId);
    if (hasVoted) {
      return err(new BusinessRuleError('Agent has already voted'));
    }

    // Check if voting is allowed in current state
    if (simulation.status === 'closed') {
      return err(new BusinessRuleError('Cannot vote on closed debate'));
    }

    return ok(undefined);
  }

  public calculateTimeToConsensus(
    simulation: DebateSimulation,
    rules: VotingRules = this.defaultRules
  ): number {
    const status = this.calculateVoteStatus(simulation, rules);

    if (status.hasConsensus) {
      return 0; // Already reached consensus
    }

    const remainingVotesNeeded = status.required - status.yesVotes;
    const remainingParticipants = status.required - status.total;

    // If more no votes than remaining participants, consensus impossible
    if (rules.requireUnanimity && status.noVotes > 0) {
      return -1; // Consensus impossible
    }

    return Math.max(0, remainingVotesNeeded);
  }

  public getVotingSummary(simulation: DebateSimulation): {
    readonly participants: number;
    readonly voted: number;
    readonly pending: number;
    readonly yesVotes: number;
    readonly noVotes: number;
    readonly consensusReached: boolean;
  } {
    const participants = simulation.getParticipantCount();
    const votes = simulation.votesToClose;
    const voted = votes.length;
    const yesVotes = votes.filter(v => v.vote).length;
    const noVotes = votes.filter(v => !v.vote).length;

    return {
      participants,
      voted,
      pending: participants - voted,
      yesVotes,
      noVotes,
      consensusReached: simulation.hasConsensusToClose(),
    };
  }

  public getPendingVoters(simulation: DebateSimulation): AgentId[] {
    const votedAgents = new Set(simulation.votesToClose.map(vote => vote.agentId));
    return simulation.participantIds.filter(agentId => !votedAgents.has(agentId));
  }

  public analyzeVotingPattern(votes: CloseVote[]): {
    readonly averageVoteTime: number;
    readonly quickestVote: number;
    readonly slowestVote: number;
    readonly voteDistribution: { yes: number; no: number };
  } {
    if (votes.length === 0) {
      return {
        averageVoteTime: 0,
        quickestVote: 0,
        slowestVote: 0,
        voteDistribution: { yes: 0, no: 0 },
      };
    }

    // Sort votes by timestamp
    const sortedVotes = [...votes].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const voteTimes: number[] = [];
    const firstVoteTime = new Date(sortedVotes[0]!.timestamp).getTime();

    for (let i = 1; i < sortedVotes.length; i++) {
      const currentTime = new Date(sortedVotes[i]!.timestamp).getTime();
      const previousTime = new Date(sortedVotes[i - 1]!.timestamp).getTime();
      voteTimes.push(currentTime - previousTime);
    }

    const averageVoteTime = voteTimes.length > 0 ?
      voteTimes.reduce((sum, time) => sum + time, 0) / voteTimes.length : 0;

    const yesVotes = votes.filter(v => v.vote).length;
    const noVotes = votes.filter(v => !v.vote).length;

    return {
      averageVoteTime,
      quickestVote: voteTimes.length > 0 ? Math.min(...voteTimes) : 0,
      slowestVote: voteTimes.length > 0 ? Math.max(...voteTimes) : 0,
      voteDistribution: { yes: yesVotes, no: noVotes },
    };
  }
}