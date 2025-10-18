/**
 * Tests for VoteToCloseHandler
 * Following TDD approach
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoteToCloseHandler } from '../../../../src/application/handlers/VoteToCloseHandler';
import { VoteToCloseCommand } from '../../../../src/application/commands/VoteToCloseCommand';
import { ISimulationRepository } from '../../../../src/core/repositories/ISimulationRepository';
import { IAgentRepository } from '../../../../src/core/repositories/IAgentRepository';
import { VoteCalculator } from '../../../../src/core/services/VoteCalculator';
import { ITimestampService } from '../../../../src/core/services/ITimestampService';
import { ICryptoService } from '../../../../src/core/services/ICryptoService';
import { ok, err } from '../../../../src/shared/result';
import { NotFoundError, StorageError, ConflictError } from '../../../../src/shared/errors';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { expectOk } from '../../../helpers/result-assertions';
import { DebateSimulation } from '../../../../src/core/entities/DebateSimulation';
import { Agent } from '../../../../src/core/entities/Agent';
import { Argument } from '../../../../src/core/entities/Argument';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';

describe('VoteToCloseHandler', () => {
  let handler: VoteToCloseHandler;
  let mockSimulationRepo: ISimulationRepository;
  let mockAgentRepo: IAgentRepository;
  let voteCalculator: VoteCalculator;
  let mockTimestampService: ITimestampService;
  let cryptoService: ICryptoService;

  beforeEach(() => {
    cryptoService = new MockCryptoService();

    mockSimulationRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      getActive: vi.fn(),
      setActive: vi.fn(),
      switchActive: vi.fn(),
      hasActive: vi.fn(),
      clearActive: vi.fn(),
      listAll: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
    };

    mockAgentRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
      loadFromFile: vi.fn(),
      refreshCache: vi.fn(),
    };

    voteCalculator = new VoteCalculator();

    mockTimestampService = {
      now: vi.fn().mockReturnValue(TimestampGenerator.now()),
    };

    handler = new VoteToCloseHandler(
      mockSimulationRepo,
      mockAgentRepo,
      voteCalculator,
      mockTimestampService
    );
  });

  describe('Successful voting', () => {
    it('should accept vote without reaching threshold', async () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      // Add 2 participants
      simulation = simulation.addParticipant(agentId1).addParticipant(agentId2);

      const agent = Agent.create({
        id: agentId1,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const command: VoteToCloseCommand = {
        agentId: agentId1,
        vote: true,
        reason: 'All points addressed',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.voteAccepted).toBe(true);
        expect(result.value.totalVotes).toBe(1);
        expect(result.value.votesNeeded).toBe(2);
        expect(result.value.debateClosed).toBe(false); // Not unanimous yet
      }
      expect(mockSimulationRepo.save).toHaveBeenCalled();
    });

    it('should accept vote and close debate when threshold reached', async () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      // Add 2 participants
      simulation = simulation.addParticipant(agentId1).addParticipant(agentId2);

      // Agent 1 already voted
      simulation = simulation.recordCloseVote(agentId1, true, 'Ready', TimestampGenerator.now());

      // Transition to voting
      simulation = simulation.transitionTo('voting');

      const agent = Agent.create({
        id: agentId2,
        name: 'Test Agent 2',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent2.md',
      });

      const command: VoteToCloseCommand = {
        agentId: agentId2,
        vote: true,
        reason: 'Consensus reached',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockSimulationRepo.clearActive).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.voteAccepted).toBe(true);
        expect(result.value.debateClosed).toBe(true); // Unanimous!
        expect(result.value.reason).toBeDefined();
        expect(result.value.reason).toContain('Debate closed with consensus');
      }
      expect(mockSimulationRepo.clearActive).toHaveBeenCalled();
      expect(mockSimulationRepo.save).toHaveBeenCalled();
    });

    it('should transition from active to voting on first vote', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation.addParticipant(agentId);

      const agent = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const command: VoteToCloseCommand = {
        agentId,
        vote: true,
      };

      let savedSimulation: any;
      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockSimulationRepo.clearActive).mockResolvedValue(ok(undefined)); // Single participant reaches consensus
      vi.mocked(mockSimulationRepo.save).mockImplementation(async (sim) => {
        savedSimulation = sim;
        return ok(undefined);
      });

      await handler.handle(command);

      // Verify simulation was transitioned to closed (single participant = unanimous)
      expect(savedSimulation.status).toBe('closed');
    });
  });

  describe('Validation errors', () => {
    it('should fail when no active debate exists', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const command: VoteToCloseCommand = {
        agentId,
        vote: true,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(
        err(new NotFoundError('Simulation', 'active'))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ConflictError);
        expect(result.error.message).toContain('No active debate');
      }
    });

    it('should fail when agent does not exist', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      const command: VoteToCloseCommand = {
        agentId,
        vote: true,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(
        err(new NotFoundError('Agent', agentId))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toContain('Agent');
      }
    });

    it('should fail when debate is closed', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));
      // Transition to closed
      simulation = simulation.transitionTo('closed');

      const agent = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const command: VoteToCloseCommand = {
        agentId,
        vote: true,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Cannot vote on closed debate');
      }
    });

    it('should fail when agent is not a participant', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const otherAgentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      // Add different agent as participant
      simulation = simulation.addParticipant(otherAgentId);

      const agent = Agent.create({
        id: agentId,
        name: 'Non-Participant Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const command: VoteToCloseCommand = {
        agentId,
        vote: true,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Only participants can vote');
      }
    });

    it('should fail when agent has already voted', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation.addParticipant(agentId);
      // Agent already voted
      simulation = simulation.recordCloseVote(agentId, true, 'Already voted', TimestampGenerator.now());

      const agent = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const command: VoteToCloseCommand = {
        agentId,
        vote: true,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('already voted');
      }
    });
  });

  describe('Repository error handling', () => {
    it('should handle save failure', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation.addParticipant(agentId);

      const agent = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const command: VoteToCloseCommand = {
        agentId,
        vote: true,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockSimulationRepo.clearActive).mockResolvedValue(ok(undefined)); // Single participant reaches consensus
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(
        err(new StorageError('Storage failed', 'write'))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
    });

    it('should handle clear active failure when closing', async () => {
      const agentId1 = AgentIdGenerator.generate(cryptoService);
      const agentId2 = AgentIdGenerator.generate(cryptoService);

      let simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      simulation = simulation.addParticipant(agentId1).addParticipant(agentId2);
      simulation = simulation.recordCloseVote(agentId1, true, 'Ready', TimestampGenerator.now());
      simulation = simulation.transitionTo('voting');

      const agent = Agent.create({
        id: agentId2,
        name: 'Test Agent 2',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent2.md',
      });

      const command: VoteToCloseCommand = {
        agentId: agentId2,
        vote: true,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockSimulationRepo.clearActive).mockResolvedValue(
        err(new StorageError('Failed to clear active', 'write'))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
    });
  });
});
