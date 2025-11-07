/**
 * Unit tests for GetCitationStatsHandler
 * Tests statistics calculation, edge cases, and batch usage counting
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetCitationStatsHandler } from '../../../../src/application/handlers/GetCitationStatsHandler';
import { GetCitationStatsQuery } from '../../../../src/application/queries/GetCitationStatsQuery';
import { ICitationRepository } from '../../../../src/core/repositories/ICitationRepository';
import { Citation } from '../../../../src/core/entities/Citation';
import { SimulationIdGenerator, SimulationId } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { ok, err } from '../../../../src/shared/result';
import { ValidationError } from '../../../../src/shared/errors';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('GetCitationStatsHandler', () => {
  let handler: GetCitationStatsHandler;
  let mockCitationRepo: ICitationRepository;
  let cryptoService: MockCryptoService;
  let testSimulationId: SimulationId;

  const createMockCitation = (source: string, type: 'paper' | 'study' | 'book' | 'website' | 'report') => {
    return Citation.create(source, type, {}, cryptoService);
  };

  beforeEach(() => {
    cryptoService = new MockCryptoService();
    testSimulationId = SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now()).value;

    mockCitationRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findBySimulation: vi.fn(),
      findByType: vi.fn(),
      getUsageCount: vi.fn(),
      getUsageCountsBatch: vi.fn(),
      resolveShortId: vi.fn(),
    };

    handler = new GetCitationStatsHandler(mockCitationRepo);
  });

  describe('Empty Simulation', () => {
    it('should return zero stats for simulation with no citations', async () => {
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok([]));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const stats = result.value;
        expect(stats.totalCitations).toBe(0);
        expect(stats.peerReviewedCount).toBe(0);
        expect(stats.peerReviewedPercentage).toBe(0);
        expect(stats.citationsByType).toEqual({});
        expect(stats.mostReferencedCitations).toEqual([]);
      }
    });

    it('should not call batch usage count for empty simulation', async () => {
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok([]));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      await handler.handle(query);

      expect(mockCitationRepo.getUsageCountsBatch).not.toHaveBeenCalled();
    });
  });

  describe('Total Citation Count', () => {
    it('should count single citation', async () => {
      const citations = [createMockCitation('Source 1', 'paper')];
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(new Map()));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.totalCitations).toBe(1);
      }
    });

    it('should count multiple citations', async () => {
      const citations = [
        createMockCitation('Source 1', 'paper'),
        createMockCitation('Source 2', 'study'),
        createMockCitation('Source 3', 'book'),
      ];
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(new Map()));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.totalCitations).toBe(3);
      }
    });
  });

  describe('Peer-Reviewed Statistics', () => {
    it('should count papers as peer-reviewed', async () => {
      const citations = [
        createMockCitation('Paper 1', 'paper'),
        createMockCitation('Paper 2', 'paper'),
      ];
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(new Map()));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.peerReviewedCount).toBe(2);
        expect(result.value.peerReviewedPercentage).toBe(100);
      }
    });

    it('should count studies as peer-reviewed', async () => {
      const citations = [createMockCitation('Study 1', 'study')];
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(new Map()));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.peerReviewedCount).toBe(1);
      }
    });

    it('should not count websites as peer-reviewed', async () => {
      const citations = [createMockCitation('Website 1', 'website')];
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(new Map()));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.peerReviewedCount).toBe(0);
      }
    });

    it('should calculate correct percentage (50%)', async () => {
      const citations = [
        createMockCitation('Paper 1', 'paper'), // peer-reviewed
        createMockCitation('Website 1', 'website'), // not peer-reviewed
      ];
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(new Map()));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.peerReviewedCount).toBe(1);
        expect(result.value.totalCitations).toBe(2);
        expect(result.value.peerReviewedPercentage).toBe(50);
      }
    });

    it('should round percentage correctly (67% from 2/3)', async () => {
      const citations = [
        createMockCitation('Paper 1', 'paper'),
        createMockCitation('Study 1', 'study'),
        createMockCitation('Website 1', 'website'),
      ];
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(new Map()));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.peerReviewedCount).toBe(2);
        expect(result.value.totalCitations).toBe(3);
        expect(result.value.peerReviewedPercentage).toBe(67); // Math.round(66.666...)
      }
    });
  });

  describe('Citations by Type', () => {
    it('should group citations by type', async () => {
      const citations = [
        createMockCitation('Paper 1', 'paper'),
        createMockCitation('Paper 2', 'paper'),
        createMockCitation('Study 1', 'study'),
        createMockCitation('Website 1', 'website'),
      ];
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(new Map()));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.citationsByType).toEqual({
          paper: 2,
          study: 1,
          website: 1,
        });
      }
    });

    it('should handle all citation types', async () => {
      const citations = [
        createMockCitation('Paper', 'paper'),
        createMockCitation('Study', 'study'),
        createMockCitation('Book', 'book'),
        createMockCitation('Website', 'website'),
        createMockCitation('Report', 'report'),
      ];
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(new Map()));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.citationsByType).toEqual({
          paper: 1,
          study: 1,
          book: 1,
          website: 1,
          report: 1,
        });
      }
    });
  });

  describe('Usage Counting (Batch)', () => {
    it('should use batch method for usage counts', async () => {
      const citation1 = createMockCitation('Source 1', 'paper');
      const citation2 = createMockCitation('Source 2', 'study');
      const citations = [citation1, citation2];

      const usageCounts = new Map();
      usageCounts.set(citation1.id, 5);
      usageCounts.set(citation2.id, 3);

      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(usageCounts));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(mockCitationRepo.getUsageCountsBatch).toHaveBeenCalledOnce();
      expect(mockCitationRepo.getUsageCountsBatch).toHaveBeenCalledWith([citation1.id, citation2.id]);
    });

    it('should sort citations by usage count descending', async () => {
      const citation1 = createMockCitation('Low Usage', 'paper');
      const citation2 = createMockCitation('High Usage', 'study');
      const citation3 = createMockCitation('Medium Usage', 'book');
      const citations = [citation1, citation2, citation3];

      const usageCounts = new Map();
      usageCounts.set(citation1.id, 2);
      usageCounts.set(citation2.id, 10);
      usageCounts.set(citation3.id, 5);

      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(usageCounts));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const mostReferenced = result.value.mostReferencedCitations;
        expect(mostReferenced).toHaveLength(3);
        expect(mostReferenced[0].source).toBe('High Usage');
        expect(mostReferenced[0].usageCount).toBe(10);
        expect(mostReferenced[1].source).toBe('Medium Usage');
        expect(mostReferenced[1].usageCount).toBe(5);
        expect(mostReferenced[2].source).toBe('Low Usage');
        expect(mostReferenced[2].usageCount).toBe(2);
      }
    });

    it('should limit to top 5 most referenced', async () => {
      const citations = Array.from({ length: 10 }, (_, i) =>
        createMockCitation(`Source ${i + 1}`, 'paper')
      );

      const usageCounts = new Map();
      citations.forEach((citation, index) => {
        usageCounts.set(citation.id, 10 - index); // Descending usage counts
      });

      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(usageCounts));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.mostReferencedCitations).toHaveLength(5);
        expect(result.value.mostReferencedCitations[0].usageCount).toBe(10);
        expect(result.value.mostReferencedCitations[4].usageCount).toBe(6);
      }
    });

    it('should handle zero usage counts', async () => {
      const citation = createMockCitation('Unused', 'paper');
      const usageCounts = new Map();
      usageCounts.set(citation.id, 0);

      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok([citation]));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(usageCounts));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.mostReferencedCitations[0].usageCount).toBe(0);
      }
    });

    it('should fallback to zero if batch fetch fails', async () => {
      const citations = [createMockCitation('Source 1', 'paper')];

      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok(citations));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(
        err(new ValidationError('Batch fetch failed'))
      );

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should still return stats with zero usage counts
        expect(result.value.mostReferencedCitations[0].usageCount).toBe(0);
      }
    });
  });

  describe('Short ID in Results', () => {
    it('should include short ID for citations', async () => {
      const citation = createMockCitation('Test', 'paper');
      const usageCounts = new Map();
      usageCounts.set(citation.id, 5);

      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(ok([citation]));
      vi.mocked(mockCitationRepo.getUsageCountsBatch).mockResolvedValue(ok(usageCounts));

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const shortId = result.value.mostReferencedCitations[0].citationId;
        expect(shortId).toBe(citation.getShortId());
        expect(shortId.length).toBe(7); // Standard short ID length
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should return error when repository fails', async () => {
      vi.mocked(mockCitationRepo.findBySimulation).mockResolvedValue(
        err(new ValidationError('Repository error'))
      );

      const query: GetCitationStatsQuery = {
        simulationId: testSimulationId as string,
      };

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Failed to retrieve citations');
      }
    });
  });
});
