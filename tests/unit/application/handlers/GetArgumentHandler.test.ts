/**
 * Unit tests for GetArgumentHandler
 * Tests the query handler that retrieves single arguments with optional relationships
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetArgumentHandler } from '../../../../src/application/handlers/GetArgumentHandler';
import { GetArgumentQuery } from '../../../../src/application/queries/GetArgumentQuery';
import { IArgumentRepository } from '../../../../src/core/repositories/IArgumentRepository';
import { Argument } from '../../../../src/core/entities/Argument';
import { ArgumentId } from '../../../../src/core/value-objects/ArgumentId';
import { ArgumentType } from '../../../../src/core/value-objects/ArgumentType';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { SimulationIdGenerator } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { ok, err } from '../../../../src/shared/result';
import { NotFoundError, StorageError } from '../../../../src/shared/errors';
import { expectOk, expectErr } from '../../../helpers/result-assertions';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('GetArgumentHandler', () => {
  let handler: GetArgumentHandler;
  let mockArgumentRepo: IArgumentRepository;
  const cryptoService = new MockCryptoService();

  // Create a sample argument for testing
  const mockAgentId = AgentIdGenerator.generate(cryptoService);
  const mockSimulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('test', '2025-01-26T10:00:00.000Z', cryptoService));
  const mockTimestamp = TimestampGenerator.now();

  let sampleArgument: Argument;

  beforeEach(() => {
    // Create a sample argument
    const argumentResult = Argument.create({
      agentId: mockAgentId,
      type: ArgumentType.DEDUCTIVE,
      content: {
        text: 'All humans are mortal. Socrates is human. Therefore, Socrates is mortal.',
        structure: {
          premises: ['All humans are mortal', 'Socrates is human'],
          conclusion: 'Socrates is mortal',
        },
      },
      simulationId: mockSimulationId,
      timestamp: mockTimestamp,
    }, cryptoService);

    sampleArgument = expectOk(argumentResult);

    mockArgumentRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findBySimulation: vi.fn(),
      findRelationships: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    };

    handler = new GetArgumentHandler(mockArgumentRepo);
  });

  describe('Successful retrieval without relationships', () => {
    it('should retrieve argument without relationships when not requested', async () => {
      const argumentId = sampleArgument.id;
      const query: GetArgumentQuery = {
        argumentId,
        includeRelationships: false,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(sampleArgument));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      expect(mockArgumentRepo.findById).toHaveBeenCalledWith(argumentId);
      expect(mockArgumentRepo.findRelationships).not.toHaveBeenCalled();

      if (result.isOk()) {
        expect(result.value.argument).toBe(sampleArgument);
        expect(result.value.relationships).toBeUndefined();
      }
    });

    it('should retrieve argument without relationships by default', async () => {
      const argumentId = sampleArgument.id;
      const query: GetArgumentQuery = {
        argumentId,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(sampleArgument));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      expect(mockArgumentRepo.findRelationships).not.toHaveBeenCalled();

      if (result.isOk()) {
        expect(result.value.argument).toBe(sampleArgument);
        expect(result.value.relationships).toBeUndefined();
      }
    });
  });

  describe('Successful retrieval with relationships', () => {
    it('should retrieve argument with relationships when requested', async () => {
      const argumentId = sampleArgument.id;
      const query: GetArgumentQuery = {
        argumentId,
        includeRelationships: true,
      };

      const mockRelationships = {
        rebuttals: ['arg1' as ArgumentId, 'arg2' as ArgumentId],
        concessions: ['arg3' as ArgumentId],
        supports: ['arg4' as ArgumentId, 'arg5' as ArgumentId],
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(sampleArgument));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(ok(mockRelationships));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      expect(mockArgumentRepo.findById).toHaveBeenCalledWith(argumentId);
      expect(mockArgumentRepo.findRelationships).toHaveBeenCalledWith(argumentId);

      if (result.isOk()) {
        expect(result.value.argument).toBe(sampleArgument);
        expect(result.value.relationships).toEqual(mockRelationships);
      }
    });

    it('should handle empty relationships', async () => {
      const argumentId = sampleArgument.id;
      const query: GetArgumentQuery = {
        argumentId,
        includeRelationships: true,
      };

      const emptyRelationships = {
        rebuttals: [],
        concessions: [],
        supports: [],
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(sampleArgument));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(ok(emptyRelationships));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.relationships).toEqual(emptyRelationships);
      }
    });

    it('should succeed even if relationships retrieval fails', async () => {
      const argumentId = sampleArgument.id;
      const query: GetArgumentQuery = {
        argumentId,
        includeRelationships: true,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(sampleArgument));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(
        err(new StorageError('Failed to read relationships', 'read'))
      );

      const result = await handler.handle(query);

      // Handler should still succeed, just without relationships
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.argument).toBe(sampleArgument);
        expect(result.value.relationships).toBeUndefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should return NotFoundError when argument does not exist', async () => {
      const argumentId = 'nonexistent' as ArgumentId;
      const query: GetArgumentQuery = {
        argumentId,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(
        err(new NotFoundError('Argument', argumentId))
      );

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      expect(mockArgumentRepo.findById).toHaveBeenCalledWith(argumentId);

      if (result.isErr()) {
        expect(result.error.constructor.name).toBe('NotFoundError');
        expect(result.error.message).toContain('Argument');
      }
    });

    it('should handle StorageError from repository', async () => {
      const argumentId = sampleArgument.id;
      const query: GetArgumentQuery = {
        argumentId,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(
        err(new StorageError('Disk failure', 'read'))
      );

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);

      if (result.isErr()) {
        expect(result.error.constructor.name).toBe('NotFoundError');
        expect(result.error.message).toContain('Argument');
      }
    });
  });

  describe('ArgumentId type handling', () => {
    it('should handle ArgumentId type directly', async () => {
      const argumentId: ArgumentId = sampleArgument.id;
      const query: GetArgumentQuery = {
        argumentId,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(sampleArgument));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      expect(mockArgumentRepo.findById).toHaveBeenCalledWith(argumentId);
    });

    it('should handle string type as full hash (MVP behavior)', async () => {
      const argumentIdString: string = sampleArgument.id;
      const query: GetArgumentQuery = {
        argumentId: argumentIdString,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(sampleArgument));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      // Should cast string to ArgumentId and use it directly
      expect(mockArgumentRepo.findById).toHaveBeenCalledWith(argumentIdString as ArgumentId);
    });

    it('should treat short hash as full hash in current MVP implementation', async () => {
      // This documents current behavior - short hash is treated as full hash
      const shortHash = sampleArgument.metadata.shortHash;
      const query: GetArgumentQuery = {
        argumentId: shortHash,
      };

      // In MVP, this will fail because short hash != full hash
      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(
        err(new NotFoundError('Argument', shortHash as ArgumentId))
      );

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      // This test documents that short hash resolution is NOT implemented yet
      expect(mockArgumentRepo.findById).toHaveBeenCalledWith(shortHash as ArgumentId);
    });
  });

  describe('Repository interaction', () => {
    it('should call findById before findRelationships', async () => {
      const argumentId = sampleArgument.id;
      const query: GetArgumentQuery = {
        argumentId,
        includeRelationships: true,
      };

      const callOrder: string[] = [];

      vi.mocked(mockArgumentRepo.findById).mockImplementation(async () => {
        callOrder.push('findById');
        return ok(sampleArgument);
      });

      vi.mocked(mockArgumentRepo.findRelationships).mockImplementation(async () => {
        callOrder.push('findRelationships');
        return ok({ rebuttals: [], concessions: [], supports: [] });
      });

      await handler.handle(query);

      expect(callOrder).toEqual(['findById', 'findRelationships']);
    });

    it('should not call findRelationships if findById fails', async () => {
      const argumentId = 'nonexistent' as ArgumentId;
      const query: GetArgumentQuery = {
        argumentId,
        includeRelationships: true,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(
        err(new NotFoundError('Argument', argumentId))
      );

      await handler.handle(query);

      expect(mockArgumentRepo.findById).toHaveBeenCalledOnce();
      expect(mockArgumentRepo.findRelationships).not.toHaveBeenCalled();
    });
  });
});
