/**
 * Tests for CreateArgumentHandler
 * Following TDD approach
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateArgumentHandler } from '../../../../src/application/handlers/CreateArgumentHandler';
import { CreateArgumentCommand } from '../../../../src/application/commands/CreateArgumentCommand';
import { ISimulationRepository } from '../../../../src/core/repositories/ISimulationRepository';
import { IArgumentRepository } from '../../../../src/core/repositories/IArgumentRepository';
import { IAgentRepository } from '../../../../src/core/repositories/IAgentRepository';
import { ArgumentValidator } from '../../../../src/core/services/ArgumentValidator';
import { ICryptoService } from '../../../../src/core/services/ICryptoService';
import { ok, err } from '../../../../src/shared/result';
import { ValidationError, NotFoundError, StorageError } from '../../../../src/shared/errors';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { expectOk } from '../../../helpers/result-assertions';
import { DebateSimulation } from '../../../../src/core/entities/DebateSimulation';
import { Agent } from '../../../../src/core/entities/Agent';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { SimulationIdGenerator } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';

describe('CreateArgumentHandler', () => {
  let handler: CreateArgumentHandler;
  let mockSimulationRepo: ISimulationRepository;
  let mockArgumentRepo: IArgumentRepository;
  let mockAgentRepo: IAgentRepository;
  let mockValidator: ArgumentValidator;
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

    mockArgumentRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findBySimulation: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
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

    mockValidator = new ArgumentValidator();

    handler = new CreateArgumentHandler(
      mockSimulationRepo,
      mockArgumentRepo,
      mockAgentRepo,
      mockValidator,
      cryptoService
    );
  });

  describe('Successful argument creation', () => {
    it('should create deductive argument successfully', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const simulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now(), cryptoService));

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

      const command: CreateArgumentCommand = {
        agentId,
        type: 'deductive',
        content: {
          text: 'All humans are mortal. Socrates is human. Therefore, Socrates is mortal.',
          structure: {
            premises: ['All humans are mortal', 'Socrates is human'],
            conclusion: 'Socrates is mortal',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.argumentId).toBeDefined();
        expect(result.value.shortHash).toBeDefined();
        expect(result.value.sequenceNumber).toBe(1);
        expect(result.value.timestamp).toBeDefined();
      }
      expect(mockArgumentRepo.save).toHaveBeenCalled();
      expect(mockSimulationRepo.save).toHaveBeenCalled();
    });

    it('should create inductive argument successfully', async () => {
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

      const command: CreateArgumentCommand = {
        agentId,
        type: 'inductive',
        content: {
          text: 'Swan 1 is white. Swan 2 is white. Therefore, all swans are white.',
          structure: {
            observations: ['Swan 1 is white', 'Swan 2 is white'],
            pattern: 'All observed swans are white',
            generalization: 'All swans are white',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
    });

    it('should create empirical argument successfully', async () => {
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

      const command: CreateArgumentCommand = {
        agentId,
        type: 'empirical',
        content: {
          text: 'Data shows climate change correlation.',
          structure: {
            claim: 'Climate is changing',
            evidence: [
              { source: 'NOAA Temperature Records', relevance: 'Shows rising global temperatures' },
              { source: 'Sea Level Rise Studies', relevance: 'Demonstrates ocean expansion' }
            ],
            methodology: 'Statistical analysis of long-term climate data',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
    });

    it('should add participant to simulation on first argument', async () => {
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

      const command: CreateArgumentCommand = {
        agentId,
        type: 'deductive',
        content: {
          text: 'Valid argument text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));

      let savedSimulation: any;
      vi.mocked(mockSimulationRepo.save).mockImplementation(async (sim) => {
        savedSimulation = sim;
        return ok(undefined);
      });

      await handler.handle(command);

      expect(savedSimulation.participantIds).toContain(agentId);
      expect(savedSimulation.argumentIds.length).toBe(1);
    });
  });

  describe('Validation errors', () => {
    it('should fail when no active debate exists', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const command: CreateArgumentCommand = {
        agentId,
        type: 'deductive',
        content: {
          text: 'Valid argument.',
          structure: {
            premises: ['P1'],
            conclusion: 'C',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(
        err(new NotFoundError('Simulation', 'active'))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('No active debate');
      }
    });

    it('should fail when agent does not exist', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);

      const simulation = DebateSimulation.create({
        topic: 'Test Topic',
        createdAt: TimestampGenerator.now(),
        cryptoService,
      });

      const command: CreateArgumentCommand = {
        agentId,
        type: 'deductive',
        content: {
          text: 'Valid argument.',
          structure: {
            premises: ['P1'],
            conclusion: 'C',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(
        err(new NotFoundError('Agent', agentId))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });

    it('should fail when debate is not active', async () => {
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

      const command: CreateArgumentCommand = {
        agentId,
        type: 'deductive',
        content: {
          text: 'Valid argument.',
          structure: {
            premises: ['P1'],
            conclusion: 'C',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Cannot add arguments to closed debate');
      }
    });

    it('should fail with invalid deductive structure', async () => {
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

      const command: CreateArgumentCommand = {
        agentId,
        type: 'deductive',
        content: {
          text: 'Invalid structure.',
          structure: {
            premises: [], // Empty premises
            conclusion: 'C',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('Repository error handling', () => {
    it('should handle argument save failure', async () => {
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

      const command: CreateArgumentCommand = {
        agentId,
        type: 'deductive',
        content: {
          text: 'Valid argument text here.',
          structure: {
            premises: ['P1'],
            conclusion: 'C',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(
        err(new StorageError('Storage failed', 'write'))
      );

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
    });

    it('should handle simulation update failure', async () => {
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

      const command: CreateArgumentCommand = {
        agentId,
        type: 'deductive',
        content: {
          text: 'Valid argument text here.',
          structure: {
            premises: ['P1'],
            conclusion: 'C',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
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
