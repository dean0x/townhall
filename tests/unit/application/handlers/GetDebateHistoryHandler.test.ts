/**
 * Tests for GetDebateHistoryHandler
 * Validates debate history querying with filtering and relationships
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetDebateHistoryHandler } from '../../../../src/application/handlers/GetDebateHistoryHandler';
import { GetDebateHistoryQuery } from '../../../../src/application/queries/GetDebateHistoryQuery';
import { ISimulationRepository } from '../../../../src/core/repositories/ISimulationRepository';
import { IArgumentRepository } from '../../../../src/core/repositories/IArgumentRepository';
import { IAgentRepository } from '../../../../src/core/repositories/IAgentRepository';
import { RelationshipBuilder } from '../../../../src/core/services/RelationshipBuilder';
import { ok, err } from '../../../../src/shared/result';
import { NotFoundError, StorageError } from '../../../../src/shared/errors';
import { DebateSimulation } from '../../../../src/core/entities/DebateSimulation';
import { Argument } from '../../../../src/core/entities/Argument';
import { Rebuttal } from '../../../../src/core/entities/Rebuttal';
import { Agent } from '../../../../src/core/entities/Agent';

describe('GetDebateHistoryHandler', () => {
  let handler: GetDebateHistoryHandler;
  let mockSimulationRepo: ISimulationRepository;
  let mockArgumentRepo: IArgumentRepository;
  let mockAgentRepo: IAgentRepository;
  let mockRelationshipBuilder: RelationshipBuilder;

  beforeEach(() => {
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
      findByAgent: vi.fn(),
      findReferencingArguments: vi.fn(),
      exists: vi.fn(),
      expandShortHash: vi.fn(),
    };

    mockAgentRepo = {
      findById: vi.fn(),
      findByName: vi.fn(),
      listAll: vi.fn(),
      exists: vi.fn(),
      refresh: vi.fn(),
    };

    mockRelationshipBuilder = {
      buildChain: vi.fn(),
    } as any;

    handler = new GetDebateHistoryHandler(
      mockSimulationRepo,
      mockArgumentRepo,
      mockAgentRepo,
      mockRelationshipBuilder
    );
  });

  describe('successful query with active simulation', () => {
    it('should return debate history for active simulation', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test Debate',
        status: 'ACTIVE',
        getParticipantCount: () => 2,
        getArgumentCount: () => 1,
      } as DebateSimulation;

      const mockArgument = {
        id: 'arg-abc' as any,
        agentId: 'agent-1' as any,
        type: 'DEDUCTIVE',
        content: { text: 'Test argument content' },
        timestamp: '2025-01-01T00:00:00.000Z',
        metadata: { sequenceNumber: 1, shortHash: 'arg-abc' },
      } as Argument;

      const mockAgent = {
        id: 'agent-1' as any,
        name: 'Alice',
      } as Agent;

      const query: GetDebateHistoryQuery = {};

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok([mockArgument]));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(mockAgent));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.simulationId).toBe('sim-123');
      expect(history.topic).toBe('Test Debate');
      expect(history.status).toBe('ACTIVE');
      expect(history.arguments).toHaveLength(1);
      expect(history.arguments[0].agentName).toBe('Alice');
      expect(history.arguments[0].preview).toBe('Test argument content');
      expect(history.participantCount).toBe(2);
      expect(history.argumentCount).toBe(1);
    });

    it('should return debate history for specific simulation by ID', async () => {
      const mockSimulation = {
        id: 'sim-456' as any,
        topic: 'Specific Debate',
        status: 'CLOSED',
        getParticipantCount: () => 3,
        getArgumentCount: () => 5,
      } as DebateSimulation;

      const query: GetDebateHistoryQuery = {
        simulationId: 'sim-456' as any,
      };

      vi.mocked(mockSimulationRepo.findById).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok([]));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.simulationId).toBe('sim-456');
      expect(history.topic).toBe('Specific Debate');
      expect(history.status).toBe('CLOSED');
      expect(mockSimulationRepo.findById).toHaveBeenCalledWith('sim-456');
    });
  });

  describe('no active simulation', () => {
    it('should return empty result when no active simulation exists', async () => {
      const query: GetDebateHistoryQuery = {};

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(
        err(new NotFoundError('No active simulation'))
      );

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.simulationId).toBe('');
      expect(history.topic).toBe('No active debate');
      expect(history.status).toBe('inactive');
      expect(history.arguments).toHaveLength(0);
      expect(history.participantCount).toBe(0);
      expect(history.argumentCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle simulation not found error', async () => {
      const query: GetDebateHistoryQuery = {
        simulationId: 'nonexistent' as any,
      };

      const notFoundError = new NotFoundError('Simulation not found');
      vi.mocked(mockSimulationRepo.findById).mockResolvedValue(err(notFoundError));

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(notFoundError);
    });

    it('should handle argument repository error', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test',
        status: 'ACTIVE',
        getParticipantCount: () => 0,
        getArgumentCount: () => 0,
      } as DebateSimulation;

      const query: GetDebateHistoryQuery = {};

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(
        err(new StorageError('Failed to read arguments', 'read'))
      );

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('Failed to read arguments');
    });
  });

  describe('filtering', () => {
    it('should filter arguments by agent', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test',
        status: 'ACTIVE',
        getParticipantCount: () => 2,
        getArgumentCount: () => 3,
      } as DebateSimulation;

      const mockArguments = [
        {
          id: 'arg-1' as any,
          agentId: 'agent-1' as any,
          type: 'DEDUCTIVE',
          content: { text: 'Argument from agent 1' },
          timestamp: '2025-01-01T00:00:00.000Z',
          metadata: { sequenceNumber: 1, shortHash: 'arg-1' },
        } as Argument,
        {
          id: 'arg-2' as any,
          agentId: 'agent-2' as any,
          type: 'INDUCTIVE',
          content: { text: 'Argument from agent 2' },
          timestamp: '2025-01-01T00:01:00.000Z',
          metadata: { sequenceNumber: 2, shortHash: 'arg-2' },
        } as Argument,
      ];

      const mockAgent = {
        id: 'agent-1' as any,
        name: 'Alice',
      } as Agent;

      const query: GetDebateHistoryQuery = {
        agentFilter: 'agent-1' as any,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok(mockArguments));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(mockAgent));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.arguments).toHaveLength(1);
      expect(history.arguments[0].id).toBe('arg-1');
    });

    it('should filter arguments by type', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test',
        status: 'ACTIVE',
        getParticipantCount: () => 1,
        getArgumentCount: () => 2,
      } as DebateSimulation;

      const mockArguments = [
        {
          id: 'arg-1' as any,
          agentId: 'agent-1' as any,
          type: 'DEDUCTIVE',
          content: { text: 'Deductive argument' },
          timestamp: '2025-01-01T00:00:00.000Z',
          metadata: { sequenceNumber: 1, shortHash: 'arg-1' },
        } as Argument,
        {
          id: 'arg-2' as any,
          agentId: 'agent-1' as any,
          type: 'INDUCTIVE',
          content: { text: 'Inductive argument' },
          timestamp: '2025-01-01T00:01:00.000Z',
          metadata: { sequenceNumber: 2, shortHash: 'arg-2' },
        } as Argument,
      ];

      const mockAgent = {
        id: 'agent-1' as any,
        name: 'Alice',
      } as Agent;

      const query: GetDebateHistoryQuery = {
        typeFilter: 'DEDUCTIVE' as any,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok(mockArguments));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(mockAgent));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.arguments).toHaveLength(1);
      expect(history.arguments[0].type).toBe('DEDUCTIVE');
    });

    it('should apply limit to results', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test',
        status: 'ACTIVE',
        getParticipantCount: () => 1,
        getArgumentCount: () => 5,
      } as DebateSimulation;

      const mockArguments = Array.from({ length: 5 }, (_, i) => ({
        id: `arg-${i}` as any,
        agentId: 'agent-1' as any,
        type: 'DEDUCTIVE',
        content: { text: `Argument ${i}` },
        timestamp: `2025-01-01T00:0${i}:00.000Z`,
        metadata: { sequenceNumber: i + 1, shortHash: `arg-${i}` },
      } as Argument));

      const mockAgent = {
        id: 'agent-1' as any,
        name: 'Alice',
      } as Agent;

      const query: GetDebateHistoryQuery = {
        limit: 2,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok(mockArguments));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(mockAgent));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.arguments).toHaveLength(2);
    });
  });

  describe('argument summary building', () => {
    it('should truncate long argument previews', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test',
        status: 'ACTIVE',
        getParticipantCount: () => 1,
        getArgumentCount: () => 1,
      } as DebateSimulation;

      const longText = 'A'.repeat(150);
      const mockArgument = {
        id: 'arg-1' as any,
        agentId: 'agent-1' as any,
        type: 'DEDUCTIVE',
        content: { text: longText },
        timestamp: '2025-01-01T00:00:00.000Z',
        metadata: { sequenceNumber: 1, shortHash: 'arg-1' },
      } as Argument;

      const mockAgent = {
        id: 'agent-1' as any,
        name: 'Alice',
      } as Agent;

      const query: GetDebateHistoryQuery = {};

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok([mockArgument]));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(mockAgent));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.arguments[0].preview).toHaveLength(103); // 100 chars + '...'
      expect(history.arguments[0].preview.endsWith('...')).toBe(true);
    });

    it('should handle unknown agents gracefully', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test',
        status: 'ACTIVE',
        getParticipantCount: () => 1,
        getArgumentCount: () => 1,
      } as DebateSimulation;

      const mockArgument = {
        id: 'arg-1' as any,
        agentId: 'nonexistent-agent' as any,
        type: 'DEDUCTIVE',
        content: { text: 'Test' },
        timestamp: '2025-01-01T00:00:00.000Z',
        metadata: { sequenceNumber: 1, shortHash: 'arg-1' },
      } as Argument;

      const query: GetDebateHistoryQuery = {};

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok([mockArgument]));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(
        err(new NotFoundError('Agent not found'))
      );

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.arguments[0].agentName).toBe('Unknown Agent');
    });

    it('should batch agent lookups for efficiency', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test',
        status: 'ACTIVE',
        getParticipantCount: () => 2,
        getArgumentCount: () => 4,
      } as DebateSimulation;

      const mockArguments = [
        {
          id: 'arg-1' as any,
          agentId: 'agent-1' as any,
          type: 'DEDUCTIVE',
          content: { text: 'First' },
          timestamp: '2025-01-01T00:00:00.000Z',
          metadata: { sequenceNumber: 1, shortHash: 'arg-1' },
        } as Argument,
        {
          id: 'arg-2' as any,
          agentId: 'agent-2' as any,
          type: 'INDUCTIVE',
          content: { text: 'Second' },
          timestamp: '2025-01-01T00:01:00.000Z',
          metadata: { sequenceNumber: 2, shortHash: 'arg-2' },
        } as Argument,
        {
          id: 'arg-3' as any,
          agentId: 'agent-1' as any,
          type: 'DEDUCTIVE',
          content: { text: 'Third' },
          timestamp: '2025-01-01T00:02:00.000Z',
          metadata: { sequenceNumber: 3, shortHash: 'arg-3' },
        } as Argument,
      ];

      const mockAgent1 = { id: 'agent-1' as any, name: 'Alice' } as Agent;
      const mockAgent2 = { id: 'agent-2' as any, name: 'Bob' } as Agent;

      const query: GetDebateHistoryQuery = {};

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok(mockArguments));
      vi.mocked(mockAgentRepo.findById)
        .mockResolvedValueOnce(ok(mockAgent1))
        .mockResolvedValueOnce(ok(mockAgent2));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      // Should only call findById twice (for 2 unique agents), not 3 times
      expect(mockAgentRepo.findById).toHaveBeenCalledTimes(2);
    });
  });

  describe('relationships', () => {
    it('should include relationships when requested', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test',
        status: 'ACTIVE',
        getParticipantCount: () => 2,
        getArgumentCount: () => 2,
      } as DebateSimulation;

      const baseArgument = {
        id: 'arg-base' as any,
        agentId: 'agent-1' as any,
        type: 'DEDUCTIVE',
        content: { text: 'Base argument' },
        timestamp: '2025-01-01T00:00:00.000Z',
        metadata: { sequenceNumber: 1, shortHash: 'arg-base' },
      } as Argument;

      const mockRebuttal = Object.assign(Object.create(Rebuttal.prototype), {
        id: 'arg-rebut' as any,
        agentId: 'agent-2' as any,
        targetArgumentId: 'arg-base' as any,
        type: 'REBUTTAL',
        content: { text: 'Rebuttal' },
        timestamp: '2025-01-01T00:01:00.000Z',
        metadata: { sequenceNumber: 2, shortHash: 'arg-rebut' },
      });

      const mockAgent = {
        id: 'agent-1' as any,
        name: 'Alice',
      } as Agent;

      const query: GetDebateHistoryQuery = {
        includeRelationships: true,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok([baseArgument, mockRebuttal]));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(mockAgent));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.relationships).toBeDefined();
      expect(history.relationships).toHaveLength(1);
      expect(history.relationships![0].type).toBe('rebuts');
      expect(history.relationships![0].fromId).toBe('arg-rebut');
      expect(history.relationships![0].toId).toBe('arg-base');
    });

    it('should not include relationships when not requested', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test',
        status: 'ACTIVE',
        getParticipantCount: () => 1,
        getArgumentCount: () => 1,
      } as DebateSimulation;

      const mockArgument = {
        id: 'arg-1' as any,
        agentId: 'agent-1' as any,
        type: 'DEDUCTIVE',
        content: { text: 'Test' },
        timestamp: '2025-01-01T00:00:00.000Z',
        metadata: { sequenceNumber: 1, shortHash: 'arg-1' },
      } as Argument;

      const mockAgent = {
        id: 'agent-1' as any,
        name: 'Alice',
      } as Agent;

      const query: GetDebateHistoryQuery = {
        includeRelationships: false,
      };

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok([mockArgument]));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(mockAgent));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.relationships).toBeUndefined();
    });
  });

  describe('sorting', () => {
    it('should sort arguments by sequence number', async () => {
      const mockSimulation = {
        id: 'sim-123' as any,
        topic: 'Test',
        status: 'ACTIVE',
        getParticipantCount: () => 1,
        getArgumentCount: () => 3,
      } as DebateSimulation;

      const mockArguments = [
        {
          id: 'arg-3' as any,
          agentId: 'agent-1' as any,
          type: 'DEDUCTIVE',
          content: { text: 'Third' },
          timestamp: '2025-01-01T00:02:00.000Z',
          metadata: { sequenceNumber: 3, shortHash: 'arg-3' },
        } as Argument,
        {
          id: 'arg-1' as any,
          agentId: 'agent-1' as any,
          type: 'DEDUCTIVE',
          content: { text: 'First' },
          timestamp: '2025-01-01T00:00:00.000Z',
          metadata: { sequenceNumber: 1, shortHash: 'arg-1' },
        } as Argument,
        {
          id: 'arg-2' as any,
          agentId: 'agent-1' as any,
          type: 'DEDUCTIVE',
          content: { text: 'Second' },
          timestamp: '2025-01-01T00:01:00.000Z',
          metadata: { sequenceNumber: 2, shortHash: 'arg-2' },
        } as Argument,
      ];

      const mockAgent = {
        id: 'agent-1' as any,
        name: 'Alice',
      } as Agent;

      const query: GetDebateHistoryQuery = {};

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(mockSimulation));
      vi.mocked(mockArgumentRepo.findBySimulation).mockResolvedValue(ok(mockArguments));
      vi.mocked(mockAgentRepo.findById).mockResolvedValue(ok(mockAgent));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      const history = result._unsafeUnwrap();
      expect(history.arguments[0].sequenceNumber).toBe(1);
      expect(history.arguments[1].sequenceNumber).toBe(2);
      expect(history.arguments[2].sequenceNumber).toBe(3);
    });
  });
});
