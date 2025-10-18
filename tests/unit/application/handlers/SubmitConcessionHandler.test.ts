/**
 * Tests for SubmitConcessionHandler
 * Following TDD approach
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubmitConcessionHandler } from '../../../../src/application/handlers/SubmitConcessionHandler';
import { SubmitConcessionCommand } from '../../../../src/application/commands/SubmitConcessionCommand';
import { ISimulationRepository } from '../../../../src/core/repositories/ISimulationRepository';
import { IArgumentRepository } from '../../../../src/core/repositories/IArgumentRepository';
import { IAgentRepository } from '../../../../src/core/repositories/IAgentRepository';
import { ICryptoService } from '../../../../src/core/services/ICryptoService';
import { ok, err } from '../../../../src/shared/result';
import { ValidationError, NotFoundError, StorageError, ConflictError } from '../../../../src/shared/errors';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { expectOk } from '../../../helpers/result-assertions';
import { DebateSimulation } from '../../../../src/core/entities/DebateSimulation';
import { Agent } from '../../../../src/core/entities/Agent';
import { Argument } from '../../../../src/core/entities/Argument';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';

describe('SubmitConcessionHandler', () => {
  let handler: SubmitConcessionHandler;
  let mockArgumentRepo: IArgumentRepository;
  let mockSimulationRepo: ISimulationRepository;
  let mockAgentRepo: IAgentRepository;
  let cryptoService: ICryptoService;

  beforeEach(() => {
    cryptoService = new MockCryptoService();

    mockArgumentRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findBySimulation: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };

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

    handler = new SubmitConcessionHandler(
      mockArgumentRepo,
      mockSimulationRepo,
      mockAgentRepo,
      cryptoService
    );
  });

  describe('Successful concession submission', () => {
    it('should submit full concession successfully', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const targetAgentId = AgentIdGenerator.generate(cryptoService);

      const simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      const agent = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const targetArgument = expectOk(Argument.create({
        agentId: targetAgentId,
        type: 'deductive',
        content: {
          text: 'Original argument text here.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulation.id,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const command: SubmitConcessionCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        concessionType: 'full',
        explanation: 'I fully accept the validity of this argument.',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.concessionId).toBeDefined();
        expect(result.value.targetId).toBe(targetArgument.id);
        expect(result.value.reason).toBe('full');
        expect(result.value.createdAt).toBeDefined();
      }
      expect(mockArgumentRepo.save).toHaveBeenCalled();
      expect(mockSimulationRepo.save).toHaveBeenCalled();
    });

    it('should submit partial concession successfully', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const targetAgentId = AgentIdGenerator.generate(cryptoService);

      const simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      const agent = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const targetArgument = expectOk(Argument.create({
        agentId: targetAgentId,
        type: 'deductive',
        content: {
          text: 'Original argument.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulation.id,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const command: SubmitConcessionCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        concessionType: 'partial',
        explanation: 'I agree with some aspects of this argument, but not all.',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.reason).toBe('partial');
      }
    });

    it('should submit conditional concession successfully', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const targetAgentId = AgentIdGenerator.generate(cryptoService);

      const simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      const agent = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const targetArgument = expectOk(Argument.create({
        agentId: targetAgentId,
        type: 'deductive',
        content: {
          text: 'Original argument.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulation.id,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const command: SubmitConcessionCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        concessionType: 'conditional',
        explanation: 'I accept this argument under specific conditions.',
        conditions: 'Only if additional evidence is provided for premise P1',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.reason).toBe('conditional');
      }
    });
  });

  describe('Validation errors', () => {
    it('should fail when no active debate exists', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const targetArgumentId = 'target-arg-id' as any;

      const command: SubmitConcessionCommand = {
        agentId,
        targetArgumentId,
        concessionType: 'full',
        explanation: 'Concession text',
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

    it('should fail when target argument not found', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const targetArgumentId = 'non-existent-arg' as any;

      const simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      const command: SubmitConcessionCommand = {
        agentId,
        targetArgumentId,
        concessionType: 'full',
        explanation: 'Concession text',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(
        err(new NotFoundError('Argument', targetArgumentId))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toContain('Target argument');
      }
    });

    it('should fail when agent does not exist', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const targetAgentId = AgentIdGenerator.generate(cryptoService);

      const simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      const targetArgument = expectOk(Argument.create({
        agentId: targetAgentId,
        type: 'deductive',
        content: {
          text: 'Original argument.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulation.id,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const command: SubmitConcessionCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        concessionType: 'full',
        explanation: 'Concession text',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
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

    it('should fail when debate is not active', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const targetAgentId = AgentIdGenerator.generate(cryptoService);

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

      const targetArgument = expectOk(Argument.create({
        agentId: targetAgentId,
        type: 'deductive',
        content: {
          text: 'Original argument.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulation.id,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const command: SubmitConcessionCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        concessionType: 'full',
        explanation: 'Concession text',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Cannot submit concession to closed debate');
      }
    });

    it('should fail when agent tries to concede to own argument', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      const agent = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      // Target argument from same agent
      const targetArgument = expectOk(Argument.create({
        agentId, // Same agent!
        type: 'deductive',
        content: {
          text: 'Original argument.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulation.id,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const command: SubmitConcessionCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        concessionType: 'full',
        explanation: 'Concession text',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Cannot concede to your own argument');
      }
    });
  });

  describe('Repository error handling', () => {
    it('should handle argument save failure', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const targetAgentId = AgentIdGenerator.generate(cryptoService);

      const simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      const agent = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const targetArgument = expectOk(Argument.create({
        agentId: targetAgentId,
        type: 'deductive',
        content: {
          text: 'Original argument.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulation.id,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const command: SubmitConcessionCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        concessionType: 'full',
        explanation: 'Concession text',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(
        err(new StorageError('Storage failed', 'write'))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
    });

    it('should handle simulation update failure', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const targetAgentId = AgentIdGenerator.generate(cryptoService);

      const simulation = expectOk(DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      }));

      const agent = Agent.create({
        id: agentId,
        name: 'Test Agent',
        type: 'llm',
        capabilities: ['debate'],
        description: 'Test',
        filePath: '/test/agent.md',
      });

      const targetArgument = expectOk(Argument.create({
        agentId: targetAgentId,
        type: 'deductive',
        content: {
          text: 'Original argument.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
        simulationId: simulation.id,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const command: SubmitConcessionCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        concessionType: 'full',
        explanation: 'Concession text',
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(
        err(new StorageError('Storage failed', 'write'))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
    });
  });
});
