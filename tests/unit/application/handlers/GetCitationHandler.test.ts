/**
 * Unit tests for GetCitationHandler
 * Tests short ID resolution, full ID lookups, and error scenarios
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetCitationHandler } from '../../../../src/application/handlers/GetCitationHandler';
import { GetCitationQuery } from '../../../../src/application/queries/GetCitationQuery';
import { ICitationRepository, CitationResolutionError, CitationNotFoundError } from '../../../../src/core/repositories/ICitationRepository';
import { Citation } from '../../../../src/core/entities/Citation';
import { CitationId } from '../../../../src/core/value-objects/CitationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { ok, err } from '../../../../src/shared/result';
import { NotFoundError, ValidationError } from '../../../../src/shared/errors';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('GetCitationHandler', () => {
  let handler: GetCitationHandler;
  let mockCitationRepo: ICitationRepository;
  let cryptoService: MockCryptoService;

  // Test citation for mocking
  const createMockCitation = (source: string) => {
    cryptoService = new MockCryptoService();
    return Citation.create(
      source,
      'paper',
      {},
      cryptoService
    );
  };

  beforeEach(() => {
    mockCitationRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findBySimulation: vi.fn(),
      findByType: vi.fn(),
      getUsageCount: vi.fn(),
      getUsageCountsBatch: vi.fn(),
      resolveShortId: vi.fn(),
    };

    handler = new GetCitationHandler(mockCitationRepo);
  });

  describe('Full ID Lookup', () => {
    it('should retrieve citation with full 64-char ID', async () => {
      const mockCitation = createMockCitation('Test Source');
      const fullId = mockCitation.id;

      vi.mocked(mockCitationRepo.findById).mockResolvedValue(ok(mockCitation));

      const query: GetCitationQuery = {
        citationId: fullId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.source).toBe('Test Source');
      }
      expect(mockCitationRepo.findById).toHaveBeenCalledWith(fullId);
      expect(mockCitationRepo.resolveShortId).not.toHaveBeenCalled();
    });

    it('should return error when full ID not found', async () => {
      const fullId = 'a'.repeat(64);

      vi.mocked(mockCitationRepo.findById).mockResolvedValue(
        err(new CitationNotFoundError(fullId))
      );

      const query: GetCitationQuery = {
        citationId: fullId,
      };

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toContain(fullId);
      }
    });
  });

  describe('Short ID Resolution', () => {
    it('should resolve and retrieve citation with 7-char short ID', async () => {
      const mockCitation = createMockCitation('Test Source');
      const fullId = mockCitation.id;
      const shortId = (fullId as string).substring(0, 7);

      vi.mocked(mockCitationRepo.resolveShortId).mockResolvedValue(ok(fullId));
      vi.mocked(mockCitationRepo.findById).mockResolvedValue(ok(mockCitation));

      const query: GetCitationQuery = {
        citationId: shortId,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.source).toBe('Test Source');
      }
      expect(mockCitationRepo.resolveShortId).toHaveBeenCalledWith(shortId);
      expect(mockCitationRepo.findById).toHaveBeenCalledWith(fullId);
    });

    it('should resolve and retrieve citation with 12-char short ID', async () => {
      const mockCitation = createMockCitation('Test Source');
      const fullId = mockCitation.id;
      const shortId = (fullId as string).substring(0, 12);

      vi.mocked(mockCitationRepo.resolveShortId).mockResolvedValue(ok(fullId));
      vi.mocked(mockCitationRepo.findById).mockResolvedValue(ok(mockCitation));

      const query: GetCitationQuery = {
        citationId: shortId,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.source).toBe('Test Source');
      }
      expect(mockCitationRepo.resolveShortId).toHaveBeenCalledWith(shortId);
    });

    it('should handle any valid short ID length (7-63 chars)', async () => {
      const mockCitation = createMockCitation('Test Source');
      const fullId = mockCitation.id;

      for (const length of [7, 10, 20, 32, 63]) {
        const shortId = (fullId as string).substring(0, length);

        vi.mocked(mockCitationRepo.resolveShortId).mockResolvedValue(ok(fullId));
        vi.mocked(mockCitationRepo.findById).mockResolvedValue(ok(mockCitation));

        const query: GetCitationQuery = {
          citationId: shortId,
        };

        const result = await handler.handle(query);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.source).toBe('Test Source');
        }
      }
    });
  });

  describe('Short ID Resolution Errors', () => {
    it('should reject ID shorter than 7 characters', async () => {
      const query: GetCitationQuery = {
        citationId: 'abc123', // 6 chars
      };

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('at least 7 characters');
      }
      expect(mockCitationRepo.resolveShortId).not.toHaveBeenCalled();
    });

    it('should return error when short ID not found', async () => {
      const shortId = 'abc1234';

      vi.mocked(mockCitationRepo.resolveShortId).mockResolvedValue(
        err(new CitationResolutionError(shortId, 'not_found'))
      );

      const query: GetCitationQuery = {
        citationId: shortId,
      };

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toContain(shortId);
        expect(result.error.message).toMatch(/not found|ambiguous/);
      }
    });

    it('should return error when short ID is ambiguous', async () => {
      const shortId = 'abc1234';

      vi.mocked(mockCitationRepo.resolveShortId).mockResolvedValue(
        err(new CitationResolutionError(shortId, 'ambiguous'))
      );

      const query: GetCitationQuery = {
        citationId: shortId,
      };

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toContain(shortId);
        expect(result.error.message).toMatch(/not found|ambiguous/);
      }
    });

    it('should return error when resolved ID not found in repository', async () => {
      const shortId = 'abc1234';
      const fullId = 'a'.repeat(64) as CitationId;

      vi.mocked(mockCitationRepo.resolveShortId).mockResolvedValue(ok(fullId));
      vi.mocked(mockCitationRepo.findById).mockResolvedValue(
        err(new CitationNotFoundError(fullId as string))
      );

      const query: GetCitationQuery = {
        citationId: shortId,
      };

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toContain(shortId);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string ID', async () => {
      const query: GetCitationQuery = {
        citationId: '',
      };

      const result = await handler.handle(query);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        // Empty string is an invalid input, not a "not found" case
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should handle minimum valid short ID (7 chars exactly)', async () => {
      const mockCitation = createMockCitation('Test Source');
      const fullId = mockCitation.id;
      const shortId = 'abc1234'; // 7 chars

      vi.mocked(mockCitationRepo.resolveShortId).mockResolvedValue(ok(fullId));
      vi.mocked(mockCitationRepo.findById).mockResolvedValue(ok(mockCitation));

      const query: GetCitationQuery = {
        citationId: shortId,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      expect(mockCitationRepo.resolveShortId).toHaveBeenCalledWith(shortId);
    });

    it('should handle maximum valid short ID (63 chars)', async () => {
      const mockCitation = createMockCitation('Test Source');
      const fullId = mockCitation.id;
      const shortId = (fullId as string).substring(0, 63);

      vi.mocked(mockCitationRepo.resolveShortId).mockResolvedValue(ok(fullId));
      vi.mocked(mockCitationRepo.findById).mockResolvedValue(ok(mockCitation));

      const query: GetCitationQuery = {
        citationId: shortId,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      expect(mockCitationRepo.resolveShortId).toHaveBeenCalledWith(shortId);
    });

    it('should treat exactly 64 chars as full ID (no resolution)', async () => {
      const mockCitation = createMockCitation('Test Source');
      const fullId = mockCitation.id;

      vi.mocked(mockCitationRepo.findById).mockResolvedValue(ok(mockCitation));

      const query: GetCitationQuery = {
        citationId: fullId as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      expect(mockCitationRepo.resolveShortId).not.toHaveBeenCalled();
      expect(mockCitationRepo.findById).toHaveBeenCalledWith(fullId);
    });
  });

  describe('Citation Content', () => {
    it('should return complete citation with all fields', async () => {
      cryptoService = new MockCryptoService();
      const mockCitation = Citation.create(
        'Complete Citation',
        'paper',
        {
          doi: '10.1234/test',
          url: 'https://example.com',
          page: 42,
          quote: 'Important quote',
          authors: ['Smith, J.', 'Doe, A.'],
          year: 2023,
        },
        cryptoService
      );

      vi.mocked(mockCitationRepo.findById).mockResolvedValue(ok(mockCitation));

      const query: GetCitationQuery = {
        citationId: mockCitation.id as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const citation = result.value;
        expect(citation.source).toBe('Complete Citation');
        expect(citation.type).toBe('paper');
        expect(citation.metadata.doi).toBe('10.1234/test');
        expect(citation.metadata.url).toBe('https://example.com');
        expect(citation.metadata.page).toBe(42);
        expect(citation.metadata.quote).toBe('Important quote');
        expect(citation.metadata.authors).toEqual(['Smith, J.', 'Doe, A.']);
        expect(citation.metadata.year).toBe(2023);
      }
    });

    it('should return citation with minimal fields', async () => {
      const mockCitation = createMockCitation('Minimal Citation');

      vi.mocked(mockCitationRepo.findById).mockResolvedValue(ok(mockCitation));

      const query: GetCitationQuery = {
        citationId: mockCitation.id as string,
      };

      const result = await handler.handle(query);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const citation = result.value;
        expect(citation.source).toBe('Minimal Citation');
        expect(citation.type).toBe('paper');
      }
    });
  });
});
