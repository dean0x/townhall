/**
 * Tests for GenericVoteCalculator
 *
 * Tests the generic vote calculation functions that work with any ballot type.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { GenericVoteCalculator } from '../../../../src/core/voting/VoteCalculator';
import { BinaryBallot } from '../../../../src/core/voting/BaseBallot';
import { VotingRules, DEFAULT_VOTING_RULES, MAJORITY_VOTING_RULES } from '../../../../src/core/voting/VotingRules';
import type { AgentId } from '../../../../src/core/value-objects/AgentId';
import type { Timestamp } from '../../../../src/core/value-objects/Timestamp';

describe('GenericVoteCalculator', () => {
  let calculator: GenericVoteCalculator;

  // Helper to create test agent IDs
  const createAgentId = (index: number): AgentId => `agent-${index}` as AgentId;

  // Helper to create test timestamps
  const createTimestamp = (date: string): Timestamp => date as unknown as Timestamp;

  // Helper to create binary ballots
  const createBallot = (
    agentId: AgentId,
    vote: boolean,
    timestamp: string = '2025-01-01T10:00:00Z'
  ): BinaryBallot => ({
    agentId,
    vote,
    timestamp: createTimestamp(timestamp),
  });

  beforeEach(() => {
    calculator = new GenericVoteCalculator();
  });

  describe('calculateStatus', () => {
    it('should return zero counts with no ballots', () => {
      const ballots: BinaryBallot[] = [];
      const participants = [createAgentId(1), createAgentId(2)];

      const status = calculator.calculateStatus(ballots, participants);

      expect(status.total).toBe(0);
      expect(status.required).toBe(2);
      expect(status.yesVotes).toBe(0);
      expect(status.noVotes).toBe(0);
      expect(status.hasConsensus).toBe(false);
      expect(status.participationRate).toBe(0);
    });

    it('should calculate unanimous yes consensus', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const ballots = [
        createBallot(agent1, true),
        createBallot(agent2, true),
      ];
      const participants = [agent1, agent2];

      const status = calculator.calculateStatus(ballots, participants, DEFAULT_VOTING_RULES);

      expect(status.total).toBe(2);
      expect(status.required).toBe(2);
      expect(status.yesVotes).toBe(2);
      expect(status.noVotes).toBe(0);
      expect(status.hasConsensus).toBe(true);
      expect(status.participationRate).toBe(1.0);
    });

    it('should not have consensus with mixed votes (unanimity required)', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const ballots = [
        createBallot(agent1, true),
        createBallot(agent2, false),
      ];
      const participants = [agent1, agent2];

      const status = calculator.calculateStatus(ballots, participants, DEFAULT_VOTING_RULES);

      expect(status.yesVotes).toBe(1);
      expect(status.noVotes).toBe(1);
      expect(status.hasConsensus).toBe(false);
    });

    it('should handle majority voting rules', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const agent3 = createAgentId(3);
      const ballots = [
        createBallot(agent1, true),
        createBallot(agent2, true),
        createBallot(agent3, false),
      ];
      const participants = [agent1, agent2, agent3];

      // With majority rules, 2/3 yes should be consensus
      const status = calculator.calculateStatus(ballots, participants, MAJORITY_VOTING_RULES);

      expect(status.yesVotes).toBe(2);
      expect(status.noVotes).toBe(1);
      expect(status.hasConsensus).toBe(true);
    });

    it('should calculate partial participation rate', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const agent3 = createAgentId(3);
      const ballots = [createBallot(agent1, true)];
      const participants = [agent1, agent2, agent3];

      const status = calculator.calculateStatus(ballots, participants);

      expect(status.total).toBe(1);
      expect(status.required).toBe(3);
      expect(status.participationRate).toBeCloseTo(0.333, 2);
      expect(status.hasConsensus).toBe(false);
    });

    it('should handle custom minimum participation', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const agent3 = createAgentId(3);
      const ballots = [
        createBallot(agent1, true),
        createBallot(agent2, true),
      ];
      const participants = [agent1, agent2, agent3];

      // Custom rules: require 80% participation
      const customRules: VotingRules = {
        requireUnanimity: false,
        minimumParticipation: 0.8,
        allowAbstention: false,
      };

      const status = calculator.calculateStatus(ballots, participants, customRules);

      // 2/3 = 66% < 80% required
      expect(status.participationRate).toBeCloseTo(0.666, 2);
      expect(status.thresholdMet).toBe(false);
      expect(status.hasConsensus).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('should return correct summary structure', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const agent3 = createAgentId(3);
      const ballots = [
        createBallot(agent1, true),
        createBallot(agent2, false),
      ];
      const participants = [agent1, agent2, agent3];

      const summary = calculator.getSummary(ballots, participants);

      expect(summary.participants).toBe(3);
      expect(summary.voted).toBe(2);
      expect(summary.pending).toBe(1);
      expect(summary.yesVotes).toBe(1);
      expect(summary.noVotes).toBe(1);
      expect(summary.consensusReached).toBe(false);
    });

    it('should detect consensus reached', () => {
      const agent1 = createAgentId(1);
      const ballots = [createBallot(agent1, true)];
      const participants = [agent1];

      const summary = calculator.getSummary(ballots, participants);

      expect(summary.consensusReached).toBe(true);
    });
  });

  describe('getPendingVoters', () => {
    it('should return all participants when no votes', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const ballots: BinaryBallot[] = [];
      const participants = [agent1, agent2];

      const pending = calculator.getPendingVoters(ballots, participants);

      expect(pending).toHaveLength(2);
      expect(pending).toContain(agent1);
      expect(pending).toContain(agent2);
    });

    it('should exclude agents who voted', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const agent3 = createAgentId(3);
      const ballots = [createBallot(agent1, true)];
      const participants = [agent1, agent2, agent3];

      const pending = calculator.getPendingVoters(ballots, participants);

      expect(pending).toHaveLength(2);
      expect(pending).not.toContain(agent1);
      expect(pending).toContain(agent2);
      expect(pending).toContain(agent3);
    });

    it('should return empty array when all voted', () => {
      const agent1 = createAgentId(1);
      const ballots = [createBallot(agent1, true)];
      const participants = [agent1];

      const pending = calculator.getPendingVoters(ballots, participants);

      expect(pending).toHaveLength(0);
    });
  });

  describe('calculateVotesNeeded', () => {
    it('should return 0 when consensus reached', () => {
      const agent1 = createAgentId(1);
      const ballots = [createBallot(agent1, true)];
      const participants = [agent1];

      const needed = calculator.calculateVotesNeeded(ballots, participants);

      expect(needed).toBe(0);
    });

    it('should return remaining votes needed', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const agent3 = createAgentId(3);
      const ballots = [createBallot(agent1, true)];
      const participants = [agent1, agent2, agent3];

      const needed = calculator.calculateVotesNeeded(ballots, participants);

      expect(needed).toBe(2); // Need 2 more yes votes for unanimity
    });

    it('should return -1 when consensus impossible (no vote with unanimity)', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const ballots = [
        createBallot(agent1, true),
        createBallot(agent2, false),
      ];
      const participants = [agent1, agent2];

      const needed = calculator.calculateVotesNeeded(ballots, participants, DEFAULT_VOTING_RULES);

      expect(needed).toBe(-1); // Impossible due to no vote
    });
  });

  describe('hasVoted', () => {
    it('should return true if agent has voted', () => {
      const agent1 = createAgentId(1);
      const ballots = [createBallot(agent1, true)];

      expect(calculator.hasVoted(agent1, ballots)).toBe(true);
    });

    it('should return false if agent has not voted', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const ballots = [createBallot(agent1, true)];

      expect(calculator.hasVoted(agent2, ballots)).toBe(false);
    });
  });

  describe('analyzePattern', () => {
    it('should return zero values for empty ballots', () => {
      const pattern = calculator.analyzePattern([]);

      expect(pattern.averageVoteTime).toBe(0);
      expect(pattern.quickestVote).toBe(0);
      expect(pattern.slowestVote).toBe(0);
      expect(pattern.voteDistribution.yes).toBe(0);
      expect(pattern.voteDistribution.no).toBe(0);
    });

    it('should calculate vote distribution', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const agent3 = createAgentId(3);
      const ballots = [
        createBallot(agent1, true, '2025-01-01T10:00:00Z'),
        createBallot(agent2, true, '2025-01-01T10:01:00Z'),
        createBallot(agent3, false, '2025-01-01T10:02:00Z'),
      ];

      const pattern = calculator.analyzePattern(ballots);

      expect(pattern.voteDistribution.yes).toBe(2);
      expect(pattern.voteDistribution.no).toBe(1);
    });

    it('should calculate timing between sequential votes', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const agent3 = createAgentId(3);
      // Votes at 10:00:00, 10:00:10, 10:00:20
      const ballots = [
        createBallot(agent1, true, '2025-01-01T10:00:00.000Z'),
        createBallot(agent2, true, '2025-01-01T10:00:10.000Z'),
        createBallot(agent3, true, '2025-01-01T10:00:20.000Z'),
      ];

      const pattern = calculator.analyzePattern(ballots);

      // Time between votes: 10 seconds, 10 seconds
      expect(pattern.averageVoteTime).toBe(10000);
      expect(pattern.quickestVote).toBe(10000);
      expect(pattern.slowestVote).toBe(10000);
    });

    it('should handle varying vote times', () => {
      const agent1 = createAgentId(1);
      const agent2 = createAgentId(2);
      const agent3 = createAgentId(3);
      // Votes at 10:00:00, 10:00:05, 10:00:15
      const ballots = [
        createBallot(agent1, true, '2025-01-01T10:00:00.000Z'),
        createBallot(agent2, true, '2025-01-01T10:00:05.000Z'),
        createBallot(agent3, true, '2025-01-01T10:00:15.000Z'),
      ];

      const pattern = calculator.analyzePattern(ballots);

      // Time between votes: 5 seconds, 10 seconds
      expect(pattern.averageVoteTime).toBe(7500); // (5000 + 10000) / 2
      expect(pattern.quickestVote).toBe(5000);
      expect(pattern.slowestVote).toBe(10000);
    });
  });
});

// Import validateVotingRules for testing
import { validateVotingRules } from '../../../../src/core/voting/VotingRules';

describe('validateVotingRules', () => {
  it('should return null for valid default rules', () => {
    const error = validateVotingRules(DEFAULT_VOTING_RULES);
    expect(error).toBeNull();
  });

  it('should return null for valid majority rules', () => {
    const error = validateVotingRules(MAJORITY_VOTING_RULES);
    expect(error).toBeNull();
  });

  it('should return null for minimumParticipation at 0', () => {
    const rules: VotingRules = {
      requireUnanimity: false,
      minimumParticipation: 0,
      allowAbstention: false,
    };
    expect(validateVotingRules(rules)).toBeNull();
  });

  it('should return null for minimumParticipation at 1', () => {
    const rules: VotingRules = {
      requireUnanimity: true,
      minimumParticipation: 1,
      allowAbstention: false,
    };
    expect(validateVotingRules(rules)).toBeNull();
  });

  it('should return null for minimumParticipation at 0.5', () => {
    const rules: VotingRules = {
      requireUnanimity: false,
      minimumParticipation: 0.5,
      allowAbstention: true,
    };
    expect(validateVotingRules(rules)).toBeNull();
  });

  it('should return error for minimumParticipation below 0', () => {
    const rules: VotingRules = {
      requireUnanimity: false,
      minimumParticipation: -0.1,
      allowAbstention: false,
    };
    const error = validateVotingRules(rules);
    expect(error).not.toBeNull();
    expect(error).toContain('minimumParticipation');
  });

  it('should return error for minimumParticipation above 1', () => {
    const rules: VotingRules = {
      requireUnanimity: false,
      minimumParticipation: 1.1,
      allowAbstention: false,
    };
    const error = validateVotingRules(rules);
    expect(error).not.toBeNull();
    expect(error).toContain('minimumParticipation');
  });

  it('should return error for minimumParticipation significantly above 1', () => {
    const rules: VotingRules = {
      requireUnanimity: false,
      minimumParticipation: 2.0,
      allowAbstention: false,
    };
    const error = validateVotingRules(rules);
    expect(error).not.toBeNull();
  });

  it('should return error for negative minimumParticipation', () => {
    const rules: VotingRules = {
      requireUnanimity: false,
      minimumParticipation: -1,
      allowAbstention: false,
    };
    const error = validateVotingRules(rules);
    expect(error).not.toBeNull();
  });
});

// Import isBinaryBallot for testing
import { isBinaryBallot, BaseBallot } from '../../../../src/core/voting/BaseBallot';

describe('isBinaryBallot', () => {
  const createBaseBallot = (): BaseBallot => ({
    agentId: 'agent-1' as AgentId,
    timestamp: '2025-01-01T10:00:00Z' as unknown as Timestamp,
  });

  it('should return true for ballot with boolean vote=true', () => {
    const ballot = {
      ...createBaseBallot(),
      vote: true,
    };
    expect(isBinaryBallot(ballot)).toBe(true);
  });

  it('should return true for ballot with boolean vote=false', () => {
    const ballot = {
      ...createBaseBallot(),
      vote: false,
    };
    expect(isBinaryBallot(ballot)).toBe(true);
  });

  it('should return false for ballot without vote property', () => {
    const ballot = createBaseBallot();
    expect(isBinaryBallot(ballot)).toBe(false);
  });

  it('should return false for ballot with non-boolean vote', () => {
    const ballot = {
      ...createBaseBallot(),
      vote: 'yes', // string, not boolean
    };
    expect(isBinaryBallot(ballot as unknown as BaseBallot)).toBe(false);
  });

  it('should return false for ballot with numeric vote', () => {
    const ballot = {
      ...createBaseBallot(),
      vote: 1, // number, not boolean
    };
    expect(isBinaryBallot(ballot as unknown as BaseBallot)).toBe(false);
  });

  it('should return false for ballot with null vote', () => {
    const ballot = {
      ...createBaseBallot(),
      vote: null,
    };
    expect(isBinaryBallot(ballot as unknown as BaseBallot)).toBe(false);
  });

  it('should return false for ballot with undefined vote', () => {
    const ballot = {
      ...createBaseBallot(),
      vote: undefined,
    };
    expect(isBinaryBallot(ballot as unknown as BaseBallot)).toBe(false);
  });

  it('should return true for ballot with extra properties', () => {
    const ballot = {
      ...createBaseBallot(),
      vote: true,
      reason: 'I agree with the proposal',
      confidence: 0.9,
    };
    expect(isBinaryBallot(ballot)).toBe(true);
  });
});
