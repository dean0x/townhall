/**
 * Tests for SubmitRebuttalHandler
 * Following TDD approach
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubmitRebuttalHandler } from '../../../../src/application/handlers/SubmitRebuttalHandler';
import { SubmitRebuttalCommand } from '../../../../src/application/commands/SubmitRebuttalCommand';
import { ISimulationRepository } from '../../../../src/core/repositories/ISimulationRepository';
import { IArgumentRepository } from '../../../../src/core/repositories/IArgumentRepository';
import { IAgentRepository } from '../../../../src/core/repositories/IAgentRepository';
import { ArgumentValidator } from '../../../../src/core/services/ArgumentValidator';
import { RelationshipBuilder } from '../../../../src/core/services/RelationshipBuilder';
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

describe('SubmitRebuttalHandler', () => {
  let handler: SubmitRebuttalHandler;
  let mockArgumentRepo: IArgumentRepository;
  let mockSimulationRepo: ISimulationRepository;
  let mockAgentRepo: IAgentRepository;
  let mockValidator: ArgumentValidator;
  let mockRelationshipBuilder: RelationshipBuilder;
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

    mockValidator = new ArgumentValidator();
    mockRelationshipBuilder = new RelationshipBuilder();

    handler = new SubmitRebuttalHandler(
      mockArgumentRepo,
      mockSimulationRepo,
      mockAgentRepo,
      mockValidator,
      cryptoService,
      mockRelationshipBuilder
    );
  });

  describe('Successful rebuttal submission', () => {
    it('should submit logical rebuttal successfully', async () => {
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

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        type: 'deductive',
        content: {
          text: 'This rebuttal identifies a logical flaw in the original argument.',
          structure: {
            premises: ['Premise P1 is false', 'Therefore conclusion C is invalid'],
            conclusion: 'The original argument is flawed',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.argumentId).toBeDefined();
        expect(result.value.shortHash).toBeDefined();
        expect(result.value.targetId).toBe(targetArgument.id);
        expect(result.value.rebuttalType).toBe('logical');
        expect(result.value.timestamp).toBeDefined();
      }
      expect(mockArgumentRepo.save).toHaveBeenCalled();
      expect(mockSimulationRepo.save).toHaveBeenCalled();
    });

    it('should submit empirical rebuttal successfully', async () => {
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
        type: 'empirical',
        content: {
          text: 'Data supports this claim.',
          structure: {
            claim: 'Test claim',
            evidence: [
              { source: 'Study A', relevance: 'Shows correlation' }
            ],
          },
        },
        simulationId: simulation.id,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        rebuttalType: 'empirical',
        type: 'empirical',
        content: {
          text: 'Counter-evidence contradicts the original claim.',
          structure: {
            claim: 'The original evidence is flawed',
            evidence: [
              { source: 'Study B', relevance: 'Shows opposite correlation' },
              { source: 'Meta-analysis C', relevance: 'Questions Study A methodology' }
            ],
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.rebuttalType).toBe('empirical');
      }
    });

    it('should submit methodological rebuttal successfully', async () => {
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
        type: 'inductive',
        content: {
          text: 'Pattern shows trend.',
          structure: {
            observations: ['Observation 1', 'Observation 2'],
            pattern: 'Consistent pattern',
            generalization: 'Universal rule',
          },
        },
        simulationId: simulation.id,
        timestamp: TimestampGenerator.now(),
        sequenceNumber: 1,
      }, cryptoService));

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        rebuttalType: 'methodological',
        type: 'deductive',
        content: {
          text: 'The methodology used to reach this conclusion is flawed.',
          structure: {
            premises: ['Sample size too small', 'Selection bias present'],
            conclusion: 'Methodology is insufficient',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));
      vi.mocked(mockArgumentRepo.save).mockResolvedValue(ok(undefined));
      vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.rebuttalType).toBe('methodological');
      }
    });
  });

  describe('Validation errors', () => {
    it('should fail when no active debate exists', async () => {
      const agentId = AgentIdGenerator.generate(cryptoService);
      const targetArgumentId = 'target-arg-id' as any;

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId,
        rebuttalType: 'logical',
        type: 'deductive',
        content: {
          text: 'Valid rebuttal text.',
          structure: {
            premises: ['P1', 'P2'],
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

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId,
        rebuttalType: 'logical',
        type: 'deductive',
        content: {
          text: 'Valid rebuttal text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
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

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        type: 'deductive',
        content: {
          text: 'Valid rebuttal text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
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

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        type: 'deductive',
        content: {
          text: 'Valid rebuttal text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Cannot submit rebuttal to closed debate');
      }
    });

    it('should fail when agent tries to rebut own argument', async () => {
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

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        type: 'deductive',
        content: {
          text: 'Valid rebuttal text.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(agent));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Cannot rebut your own argument');
      }
    });

    it('should fail with invalid deductive structure', async () => {
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

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        type: 'deductive',
        content: {
          text: 'Invalid structure rebuttal.',
          structure: {
            premises: [], // Empty premises - invalid
            conclusion: 'C',
          },
        },
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(targetArgument));
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

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        type: 'deductive',
        content: {
          text: 'Valid rebuttal text here.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
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

      const command: SubmitRebuttalCommand = {
        agentId,
        targetArgumentId: targetArgument.id,
        rebuttalType: 'logical',
        type: 'deductive',
        content: {
          text: 'Valid rebuttal text here.',
          structure: {
            premises: ['P1', 'P2'],
            conclusion: 'C',
          },
        },
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
