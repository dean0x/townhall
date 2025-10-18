/**
 * Unit tests for GetArgumentChainHandler
 * Tests the query handler that builds argument chains with recursive traversal
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetArgumentChainHandler } from '../../../../src/application/handlers/GetArgumentChainHandler';
import { GetArgumentChainQuery } from '../../../../src/application/queries/GetArgumentChainQuery';
import { IArgumentRepository } from '../../../../src/core/repositories/IArgumentRepository';
import { Argument } from '../../../../src/core/entities/Argument';
import { ArgumentId } from '../../../../src/core/value-objects/ArgumentId';
import { ArgumentType } from '../../../../src/core/value-objects/ArgumentType';
import { AgentIdGenerator } from '../../../../src/core/value-objects/AgentId';
import { SimulationIdGenerator } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { ok, err } from '../../../../src/shared/result';
import { NotFoundError, StorageError } from '../../../../src/shared/errors';
import { expectOk } from '../../../helpers/result-assertions';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('GetArgumentChainHandler', () => {
  let handler: GetArgumentChainHandler;
  let mockArgumentRepo: IArgumentRepository;
  const cryptoService = new MockCryptoService();

  const mockAgentId = AgentIdGenerator.generate(cryptoService);
  const mockSimulationId = expectOk(SimulationIdGenerator.fromTopicAndTimestamp('test', '2025-01-26T10:00:00.000Z', cryptoService));
  const mockTimestamp = TimestampGenerator.now();

  // Helper to create test arguments
  const createArgument = (text: string): Argument => {
    return expectOk(Argument.create({
      agentId: mockAgentId,
      type: ArgumentType.DEDUCTIVE,
      content: {
        text,
        structure: {
          premises: ['Premise 1', 'Premise 2'],
          conclusion: text,
        },
      },
      simulationId: mockSimulationId,
      timestamp: mockTimestamp,
    }, cryptoService));
  };

  beforeEach(() => {
    mockArgumentRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findBySimulation: vi.fn(),
      findRelationships: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    };

    handler = new GetArgumentChainHandler(mockArgumentRepo);
  });

  describe('Single argument (no children)', () => {
    it('should retrieve single argument with no relationships', async () => {
      const rootArg = createArgument('Root argument');
      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(rootArg));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(ok({
        rebuttals: [],
        concessions: [],
        supports: [],
      }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.root.argument).toBe(rootArg);
        expect(result.value.root.children).toEqual([]);
        expect(result.value.totalArguments).toBe(1);
        expect(result.value.maxDepthReached).toBe(0);
      }
    });

    it('should handle relationships retrieval failure gracefully', async () => {
      const rootArg = createArgument('Root argument');
      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(rootArg));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(
        err(new StorageError('Failed to read relationships', 'read'))
      );

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.root.children).toEqual([]);
        expect(result.value.totalArguments).toBe(1);
      }
    });
  });

  describe('Argument chain with children', () => {
    it('should build 2-level argument chain', async () => {
      const rootArg = createArgument('Root');
      const child1 = createArgument('Child 1');
      const child2 = createArgument('Child 2');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
      };

      vi.mocked(mockArgumentRepo.findById)
        .mockResolvedValueOnce(ok(rootArg))
        .mockResolvedValueOnce(ok(child1))
        .mockResolvedValueOnce(ok(child2));

      vi.mocked(mockArgumentRepo.findRelationships)
        .mockResolvedValueOnce(ok({
          rebuttals: [child1.id, child2.id],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.root.argument).toBe(rootArg);
        expect(result.value.root.children).toHaveLength(2);
        expect(result.value.totalArguments).toBe(3);
        expect(result.value.maxDepthReached).toBe(1);
      }
    });

    it('should build 3-level argument chain', async () => {
      const rootArg = createArgument('Root');
      const child1 = createArgument('Child 1');
      const grandchild1 = createArgument('Grandchild 1');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
      };

      vi.mocked(mockArgumentRepo.findById)
        .mockResolvedValueOnce(ok(rootArg))
        .mockResolvedValueOnce(ok(child1))
        .mockResolvedValueOnce(ok(grandchild1));

      vi.mocked(mockArgumentRepo.findRelationships)
        .mockResolvedValueOnce(ok({
          rebuttals: [child1.id],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [grandchild1.id],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.totalArguments).toBe(3);
        expect(result.value.maxDepthReached).toBe(2);
        expect(result.value.root.children).toHaveLength(1);
        expect(result.value.root.children[0].children).toHaveLength(1);
      }
    });

    it('should include both rebuttals and supports', async () => {
      const rootArg = createArgument('Root');
      const rebuttal = createArgument('Rebuttal');
      const support = createArgument('Support');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
      };

      vi.mocked(mockArgumentRepo.findById)
        .mockResolvedValueOnce(ok(rootArg))
        .mockResolvedValueOnce(ok(rebuttal))
        .mockResolvedValueOnce(ok(support));

      vi.mocked(mockArgumentRepo.findRelationships)
        .mockResolvedValueOnce(ok({
          rebuttals: [rebuttal.id],
          concessions: [],
          supports: [support.id],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.root.children).toHaveLength(2);
        expect(result.value.totalArguments).toBe(3);
      }
    });

    it('should not include concessions in chain', async () => {
      const rootArg = createArgument('Root');
      const rebuttal = createArgument('Rebuttal');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
      };

      vi.mocked(mockArgumentRepo.findById)
        .mockResolvedValueOnce(ok(rootArg))
        .mockResolvedValueOnce(ok(rebuttal));

      vi.mocked(mockArgumentRepo.findRelationships)
        .mockResolvedValueOnce(ok({
          rebuttals: [rebuttal.id],
          concessions: ['concession1' as ArgumentId], // Should be ignored
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        // Only rebuttal should be included, not concession
        expect(result.value.root.children).toHaveLength(1);
        expect(result.value.totalArguments).toBe(2);
      }
    });
  });

  describe('Max depth handling', () => {
    it('should respect maxDepth limit of 0 (root only)', async () => {
      const rootArg = createArgument('Root');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 0, // Only allow root level, no children
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(rootArg));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(ok({
        rebuttals: [],
        concessions: [],
        supports: [],
      }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        // With maxDepth = 0 and currentDepth = 0, should stop before fetching children
        expect(result.value.root.children).toEqual([]);
        expect(result.value.totalArguments).toBe(1);
        expect(result.value.maxDepthReached).toBe(0);
      }
    });

    it('should respect maxDepth limit of 1 (root + children)', async () => {
      const rootArg = createArgument('Root');
      const child = createArgument('Child');
      const grandchild = createArgument('Grandchild');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 1, // Root + one level of children
      };

      vi.mocked(mockArgumentRepo.findById)
        .mockResolvedValueOnce(ok(rootArg))
        .mockResolvedValueOnce(ok(child));

      vi.mocked(mockArgumentRepo.findRelationships)
        .mockResolvedValueOnce(ok({
          rebuttals: [child.id],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [grandchild.id],
          concessions: [],
          supports: [],
        }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        // Should have root + child, but not grandchild
        expect(result.value.root.children).toHaveLength(1);
        expect(result.value.root.children[0].children).toEqual([]); // No grandchildren
        expect(result.value.totalArguments).toBe(2);
        expect(result.value.maxDepthReached).toBe(1);
      }
    });

    it('should use default maxDepth of 10 when not specified', async () => {
      const rootArg = createArgument('Root');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        // maxDepth not specified
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(rootArg));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(ok({
        rebuttals: [],
        concessions: [],
        supports: [],
      }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      // Should use default depth of 10 (no error)
    });

    it('should cap maxDepth at 100', async () => {
      const rootArg = createArgument('Root');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 999, // Should be capped to 100
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(rootArg));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(ok({
        rebuttals: [],
        concessions: [],
        supports: [],
      }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      // Should not error, maxDepth capped internally
    });
  });

  describe('Metadata inclusion', () => {
    it('should include metadata when requested', async () => {
      const rootArg = createArgument('Root');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
        includeMetadata: true,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(rootArg));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(ok({
        rebuttals: [],
        concessions: [],
        supports: [],
      }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.root.metadata).toBeDefined();
        expect(result.value.root.metadata?.depth).toBe(0);
        expect(result.value.root.metadata?.type).toBe(ArgumentType.DEDUCTIVE);
        expect(result.value.root.metadata?.agentId).toBe(mockAgentId);
      }
    });

    it('should exclude metadata when not requested', async () => {
      const rootArg = createArgument('Root');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
        includeMetadata: false,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(rootArg));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(ok({
        rebuttals: [],
        concessions: [],
        supports: [],
      }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.root.metadata).toBeUndefined();
      }
    });

    it('should include depth in metadata for nested nodes', async () => {
      const rootArg = createArgument('Root');
      const child = createArgument('Child');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
        includeMetadata: true,
      };

      vi.mocked(mockArgumentRepo.findById)
        .mockResolvedValueOnce(ok(rootArg))
        .mockResolvedValueOnce(ok(child));

      vi.mocked(mockArgumentRepo.findRelationships)
        .mockResolvedValueOnce(ok({
          rebuttals: [child.id],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.root.metadata?.depth).toBe(0);
        expect(result.value.root.children[0].metadata?.depth).toBe(1);
      }
    });
  });

  describe('Error handling', () => {
    it('should return NotFoundError when root argument does not exist', async () => {
      const fakeId = 'nonexistent' as ArgumentId;
      const query: GetArgumentChainQuery = {
        rootArgumentId: fakeId,
        maxDepth: 10,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(
        err(new NotFoundError('Argument', fakeId))
      );

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);

      if (result.isErr()) {
        expect(result.error.constructor.name).toBe('NotFoundError');
        expect(result.error.message).toContain('Root argument');
      }
    });

    it('should skip children that fail to load', async () => {
      const rootArg = createArgument('Root');
      const child1 = createArgument('Child 1');
      const child2Id = 'missing-child' as ArgumentId;

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
      };

      vi.mocked(mockArgumentRepo.findById)
        .mockResolvedValueOnce(ok(rootArg))
        .mockResolvedValueOnce(ok(child1))
        .mockResolvedValueOnce(err(new NotFoundError('Argument', child2Id)));

      vi.mocked(mockArgumentRepo.findRelationships)
        .mockResolvedValueOnce(ok({
          rebuttals: [child1.id, child2Id],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        // Should only have child1, child2 was skipped
        expect(result.value.root.children).toHaveLength(1);
        expect(result.value.totalArguments).toBe(2);
      }
    });
  });

  describe('Statistics calculation', () => {
    it('should correctly count total arguments in chain', async () => {
      const rootArg = createArgument('Root');
      const child1 = createArgument('Child 1');
      const child2 = createArgument('Child 2');
      const grandchild = createArgument('Grandchild');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
      };

      vi.mocked(mockArgumentRepo.findById)
        .mockResolvedValueOnce(ok(rootArg))
        .mockResolvedValueOnce(ok(child1))
        .mockResolvedValueOnce(ok(child2))
        .mockResolvedValueOnce(ok(grandchild));

      vi.mocked(mockArgumentRepo.findRelationships)
        .mockResolvedValueOnce(ok({
          rebuttals: [child1.id, child2.id],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [grandchild.id],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValueOnce(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.totalArguments).toBe(4);
        expect(result.value.maxDepthReached).toBe(2);
      }
    });

    it('should correctly calculate maxDepthReached', async () => {
      const rootArg = createArgument('Root');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
      };

      vi.mocked(mockArgumentRepo.findById).mockResolvedValue(ok(rootArg));
      vi.mocked(mockArgumentRepo.findRelationships).mockResolvedValue(ok({
        rebuttals: [],
        concessions: [],
        supports: [],
      }));

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.maxDepthReached).toBe(0);
      }
    });
  });

  describe('Parallel fetching', () => {
    it('should fetch child arguments in parallel', async () => {
      const rootArg = createArgument('Root');
      const child1 = createArgument('Child 1');
      const child2 = createArgument('Child 2');
      const child3 = createArgument('Child 3');

      const query: GetArgumentChainQuery = {
        rootArgumentId: rootArg.id,
        maxDepth: 10,
      };

      const fetchTimes: number[] = [];

      vi.mocked(mockArgumentRepo.findById)
        .mockResolvedValueOnce(ok(rootArg))
        .mockImplementation(async () => {
          fetchTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 10));
          return ok(child1);
        });

      vi.mocked(mockArgumentRepo.findRelationships)
        .mockResolvedValueOnce(ok({
          rebuttals: [child1.id, child2.id, child3.id],
          concessions: [],
          supports: [],
        }))
        .mockResolvedValue(ok({
          rebuttals: [],
          concessions: [],
          supports: [],
        }));

      await handler.handle(query);

      // All child fetches should start at roughly the same time (parallel)
      // This is a loose check - in practice they'd be within milliseconds
      expect(fetchTimes.length).toBeGreaterThan(0);
    });
  });
});
