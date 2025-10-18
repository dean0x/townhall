/**
 * Tests for VoteCalculator
 * Following TDD approach
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { VoteCalculator } from '../../../../src/core/services/VoteCalculator';
import { ICryptoService } from '../../../../src/core/services/ICryptoService';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { expectOk } from '../../../helpers/result-assertions';
import { DebateSimulation } from '../../../../src/core/entities/DebateSimulation';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';

describe('VoteCalculator', () => {
  let calculator: VoteCalculator;
  let cryptoService: ICryptoService;

  beforeEach(() => {
    calculator = new VoteCalculator();
    cryptoService = new MockCryptoService();
  });

  describe('calculateVoteStatus', () => {
    it('should calculate status with no votes', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation.addParticipant(agentId);

      const status = calculator.calculateVoteStatus(simulation);

      expect(status.total).toBe(0);
      expect(status.required).toBe(1);
      expect(status.yesVotes).toBe(0);
      expect(status.noVotes).toBe(0);
      expect(status.hasConsensus).toBe(false);
      expect(status.canClose).toBe(false);
      expect(status.participationRate).toBe(0);
    });

    it('should calculate status with unanimous yes votes', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId1)
        .addParticipant(agentId2)
        .recordCloseVote(agentId1, true, 'Ready', TimestampGenerator.now())
        .recordCloseVote(agentId2, true, 'Ready', TimestampGenerator.now());

      const status = calculator.calculateVoteStatus(simulation);

      expect(status.total).toBe(2);
      expect(status.required).toBe(2);
      expect(status.yesVotes).toBe(2);
      expect(status.noVotes).toBe(0);
      expect(status.hasConsensus).toBe(true);
      expect(status.canClose).toBe(true);
      expect(status.participationRate).toBe(1.0);
    });

    it('should calculate status with mixed votes (no consensus)', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId1)
        .addParticipant(agentId2)
        .recordCloseVote(agentId1, true, 'Ready', TimestampGenerator.now())
        .recordCloseVote(agentId2, false, 'Not ready', TimestampGenerator.now());

      const status = calculator.calculateVoteStatus(simulation);

      expect(status.total).toBe(2);
      expect(status.required).toBe(2);
      expect(status.yesVotes).toBe(1);
      expect(status.noVotes).toBe(1);
      expect(status.hasConsensus).toBe(false);
      expect(status.canClose).toBe(false);
      expect(status.participationRate).toBe(1.0);
    });

    it('should calculate status with partial participation', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const agentId3 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId1)
        .addParticipant(agentId2)
        .addParticipant(agentId3)
        .recordCloseVote(agentId1, true, 'Ready', TimestampGenerator.now());

      const status = calculator.calculateVoteStatus(simulation);

      expect(status.total).toBe(1);
      expect(status.required).toBe(3);
      expect(status.yesVotes).toBe(1);
      expect(status.noVotes).toBe(0);
      expect(status.hasConsensus).toBe(false);
      expect(status.canClose).toBe(false);
      expect(status.participationRate).toBeCloseTo(0.333, 2);
    });
  });

  describe('validateVote', () => {
    it('should allow participant to vote', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation.addParticipant(agentId);

      const result = calculator.validateVote(agentId, simulation);

      expect(result.isOk()).toBe(true);
    });

    it('should reject vote from non-participant', () => {
      const participantId = AgentIdGenerator.generate(cryptoService);
      const nonParticipantId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation.addParticipant(participantId);

      const result = calculator.validateVote(nonParticipantId, simulation);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Only participants can vote');
      }
    });

    it('should reject duplicate vote from same agent', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId)
        .recordCloseVote(agentId, true, 'Ready', TimestampGenerator.now());

      const result = calculator.validateVote(agentId, simulation);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('already voted');
      }
    });

    it('should reject vote on closed debate', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId)
        .transitionTo('closed');

      const result = calculator.validateVote(agentId, simulation);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Cannot vote on closed debate');
      }
    });
  });

  describe('calculateTimeToConsensus', () => {
    it('should return 0 when consensus already reached', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId)
        .recordCloseVote(agentId, true, 'Ready', TimestampGenerator.now());

      const timeToConsensus = calculator.calculateTimeToConsensus(simulation);

      expect(timeToConsensus).toBe(0);
    });

    it('should return remaining votes needed for unanimity', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const agentId3 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId1)
        .addParticipant(agentId2)
        .addParticipant(agentId3)
        .recordCloseVote(agentId1, true, 'Ready', TimestampGenerator.now());

      const timeToConsensus = calculator.calculateTimeToConsensus(simulation);

      expect(timeToConsensus).toBe(2); // Need 2 more yes votes
    });

    it('should return -1 when consensus impossible (no vote exists)', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId1)
        .addParticipant(agentId2)
        .recordCloseVote(agentId1, true, 'Ready', TimestampGenerator.now())
        .recordCloseVote(agentId2, false, 'Not ready', TimestampGenerator.now());

      const timeToConsensus = calculator.calculateTimeToConsensus(simulation);

      expect(timeToConsensus).toBe(-1); // Impossible due to no vote
    });
  });

  describe('getVotingSummary', () => {
    it('should return summary with no votes', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation.addParticipant(agentId);

      const summary = calculator.getVotingSummary(simulation);

      expect(summary.participants).toBe(1);
      expect(summary.voted).toBe(0);
      expect(summary.pending).toBe(1);
      expect(summary.yesVotes).toBe(0);
      expect(summary.noVotes).toBe(0);
      expect(summary.consensusReached).toBe(false);
    });

    it('should return summary with all votes', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId1)
        .addParticipant(agentId2)
        .recordCloseVote(agentId1, true, 'Ready', TimestampGenerator.now())
        .recordCloseVote(agentId2, true, 'Ready', TimestampGenerator.now());

      const summary = calculator.getVotingSummary(simulation);

      expect(summary.participants).toBe(2);
      expect(summary.voted).toBe(2);
      expect(summary.pending).toBe(0);
      expect(summary.yesVotes).toBe(2);
      expect(summary.noVotes).toBe(0);
      expect(summary.consensusReached).toBe(true);
    });

    it('should return summary with mixed votes', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const agentId3 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId1)
        .addParticipant(agentId2)
        .addParticipant(agentId3)
        .recordCloseVote(agentId1, true, 'Ready', TimestampGenerator.now())
        .recordCloseVote(agentId2, false, 'Not ready', TimestampGenerator.now());

      const summary = calculator.getVotingSummary(simulation);

      expect(summary.participants).toBe(3);
      expect(summary.voted).toBe(2);
      expect(summary.pending).toBe(1);
      expect(summary.yesVotes).toBe(1);
      expect(summary.noVotes).toBe(1);
      expect(summary.consensusReached).toBe(false);
    });
  });

  describe('getPendingVoters', () => {
    it('should return all participants when no votes', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId1)
        .addParticipant(agentId2);

      const pending = calculator.getPendingVoters(simulation);

      expect(pending).toHaveLength(2);
      expect(pending).toContain(agentId1);
      expect(pending).toContain(agentId2);
    });

    it('should exclude agents who already voted', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const agentId3 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId1)
        .addParticipant(agentId2)
        .addParticipant(agentId3)
        .recordCloseVote(agentId1, true, 'Ready', TimestampGenerator.now());

      const pending = calculator.getPendingVoters(simulation);

      expect(pending).toHaveLength(2);
      expect(pending).not.toContain(agentId1);
      expect(pending).toContain(agentId2);
      expect(pending).toContain(agentId3);
    });

    it('should return empty when all voted', () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation
        .addParticipant(agentId)
        .recordCloseVote(agentId, true, 'Ready', TimestampGenerator.now());

      const pending = calculator.getPendingVoters(simulation);

      expect(pending).toHaveLength(0);
    });
  });

  describe('analyzeVotingPattern', () => {
    it('should return zero values for empty votes', () => {
      const pattern = calculator.analyzeVotingPattern([]);

      expect(pattern.averageVoteTime).toBe(0);
      expect(pattern.quickestVote).toBe(0);
      expect(pattern.slowestVote).toBe(0);
      expect(pattern.voteDistribution.yes).toBe(0);
      expect(pattern.voteDistribution.no).toBe(0);
    });

    it('should analyze vote distribution', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const agentId3 = AgentIdGenerator.generate(cryptoService);

      const votes = [
        { agentId: agentId1, vote: true, reason: 'Yes', timestamp: '2025-01-01T10:00:00Z' as any },
        { agentId: agentId2, vote: true, reason: 'Yes', timestamp: '2025-01-01T10:01:00Z' as any },
        { agentId: agentId3, vote: false, reason: 'No', timestamp: '2025-01-01T10:02:00Z' as any },
      ];

      const pattern = calculator.analyzeVotingPattern(votes);

      expect(pattern.voteDistribution.yes).toBe(2);
      expect(pattern.voteDistribution.no).toBe(1);
      expect(pattern.averageVoteTime).toBeGreaterThan(0);
      expect(pattern.quickestVote).toBeGreaterThan(0);
      expect(pattern.slowestVote).toBeGreaterThan(0);
    });

    it('should calculate timing correctly for sequential votes', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const agentId3 = AgentIdGenerator.generate(cryptoService);

      // Votes at 10:00:00, 10:00:10, 10:00:20
      const votes = [
        { agentId: agentId1, vote: true, reason: 'Yes', timestamp: '2025-01-01T10:00:00.000Z' as any },
        { agentId: agentId2, vote: true, reason: 'Yes', timestamp: '2025-01-01T10:00:10.000Z' as any },
        { agentId: agentId3, vote: true, reason: 'Yes', timestamp: '2025-01-01T10:00:20.000Z' as any },
      ];

      const pattern = calculator.analyzeVotingPattern(votes);

      // Time between votes: 10 seconds, 10 seconds
      expect(pattern.averageVoteTime).toBe(10000); // 10 seconds in ms
      expect(pattern.quickestVote).toBe(10000);
      expect(pattern.slowestVote).toBe(10000);
    });

    it('should handle varying vote times', () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);
      const agentId3 = AgentIdGenerator.generate(cryptoService);

      // Votes at 10:00:00, 10:00:05, 10:00:15
      const votes = [
        { agentId: agentId1, vote: true, reason: 'Yes', timestamp: '2025-01-01T10:00:00.000Z' as any },
        { agentId: agentId2, vote: true, reason: 'Yes', timestamp: '2025-01-01T10:00:05.000Z' as any },
        { agentId: agentId3, vote: true, reason: 'Yes', timestamp: '2025-01-01T10:00:15.000Z' as any },
      ];

      const pattern = calculator.analyzeVotingPattern(votes);

      // Time between votes: 5 seconds, 10 seconds
      expect(pattern.averageVoteTime).toBe(7500); // (5000 + 10000) / 2
      expect(pattern.quickestVote).toBe(5000);
      expect(pattern.slowestVote).toBe(10000);
    });
  });
});
