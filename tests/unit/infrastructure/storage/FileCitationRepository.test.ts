/**
 * Integration tests for FileCitationRepository
 * Tests file-based persistence, retrieval, and querying of citations
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileCitationRepository } from '../../../../src/infrastructure/storage/FileCitationRepository';
import { ObjectStorage } from '../../../../src/infrastructure/storage/ObjectStorage';
import { HashResolver } from '../../../../src/infrastructure/storage/HashResolver';
import { Citation } from '../../../../src/core/entities/Citation';
import { CitationType } from '../../../../src/core/value-objects/CitationType';
import { CitationId } from '../../../../src/core/value-objects/CitationId';
import type { SimulationId } from '../../../../src/core/value-objects/SimulationId';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { expectOk, expectErr } from '../../../helpers/result-assertions';

describe('FileCitationRepository Integration Tests', () => {
  const cryptoService = new MockCryptoService();
  let repository: FileCitationRepository;
  let storage: ObjectStorage;
  let hashResolver: HashResolver;
  let testDir: string;
  const mockSimulationId = 'sim123' as SimulationId;
  const mockSimulationId2 = 'sim456' as SimulationId;

  beforeEach(async () => {
    // Create isolated temp directory for each test
    testDir = join(tmpdir(), `citation-repo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new ObjectStorage(testDir);
    hashResolver = new HashResolver(storage);
    repository = new FileCitationRepository(storage, hashResolver, cryptoService);
    await storage.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('save()', () => {
    it('should save citation with minimal metadata', async () => {
      const citation = Citation.create(
        'Machine Learning Basics',
        CitationType.BOOK,
        {},
        cryptoService
      );

      const result = await repository.save(citation, mockSimulationId);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(citation.id);
      }
    });

    it('should save citation with full metadata', async () => {
      const citation = Citation.create(
        'Deep Learning Research',
        CitationType.PAPER,
        {
          doi: '10.1234/example',
          url: 'https://example.com/paper',
          page: 42,
          quote: 'Neural networks are powerful',
          authors: ['John Doe', 'Jane Smith'],
          year: 2023,
        },
        cryptoService
      );

      const result = await repository.save(citation, mockSimulationId);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(citation.id);
      }
    });

    it('should save multiple citations to same simulation', async () => {
      const citation1 = Citation.create('Source 1', CitationType.PAPER, {}, cryptoService);
      const citation2 = Citation.create('Source 2', CitationType.BOOK, {}, cryptoService);
      const citation3 = Citation.create('Source 3', CitationType.WEBSITE, {}, cryptoService);

      const result1 = await repository.save(citation1, mockSimulationId);
      const result2 = await repository.save(citation2, mockSimulationId);
      const result3 = await repository.save(citation3, mockSimulationId);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      expect(result3.isOk()).toBe(true);
    });
  });

  describe('findById()', () => {
    it('should retrieve saved citation by full ID', async () => {
      const original = Citation.create(
        'Test Source',
        CitationType.PAPER,
        { doi: '10.1234/test', year: 2024 },
        cryptoService
      );

      await repository.save(original, mockSimulationId);
      const result = await repository.findById(original.id);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const retrieved = result.value;
        expect(retrieved.id).toBe(original.id);
        expect(retrieved.source).toBe(original.source);
        expect(retrieved.type).toBe(original.type);
        expect(retrieved.metadata.doi).toBe(original.metadata.doi);
        expect(retrieved.metadata.year).toBe(original.metadata.year);
      }
    });

    it('should return error for non-existent citation', async () => {
      const fakeId = CitationId.fromString('nonexistent123');
      const result = await repository.findById(fakeId);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should preserve all metadata fields', async () => {
      const metadata = {
        doi: '10.5555/12345678',
        url: 'https://example.com/paper.pdf',
        page: 100,
        quote: 'This is a test quote from the paper.',
        authors: ['Alice', 'Bob', 'Charlie'],
        year: 2023,
      };

      const original = Citation.create('Complex Citation', CitationType.STUDY, metadata, cryptoService);

      await repository.save(original, mockSimulationId);
      const result = await repository.findById(original.id);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const retrieved = result.value;
        expect(retrieved.metadata.doi).toBe(metadata.doi);
        expect(retrieved.metadata.url).toBe(metadata.url);
        expect(retrieved.metadata.page).toBe(metadata.page);
        expect(retrieved.metadata.quote).toBe(metadata.quote);
        expect(retrieved.metadata.authors).toEqual(metadata.authors);
        expect(retrieved.metadata.year).toBe(metadata.year);
      }
    });
  });

  describe('findBySimulation()', () => {
    it('should return all citations for a simulation', async () => {
      const citation1 = Citation.create('Source 1', CitationType.PAPER, {}, cryptoService);
      const citation2 = Citation.create('Source 2', CitationType.BOOK, {}, cryptoService);
      const citation3 = Citation.create('Source 3', CitationType.REPORT, {}, cryptoService);

      await repository.save(citation1, mockSimulationId);
      await repository.save(citation2, mockSimulationId);
      await repository.save(citation3, mockSimulationId);

      const result = await repository.findBySimulation(mockSimulationId);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.length).toBe(3);
        const ids = result.value.map(c => c.id);
        expect(ids).toContain(citation1.id);
        expect(ids).toContain(citation2.id);
        expect(ids).toContain(citation3.id);
      }
    });

    it('should return empty array for simulation with no citations', async () => {
      const result = await repository.findBySimulation(mockSimulationId);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual([]);
      }
    });

    it('should isolate citations between different simulations', async () => {
      const citation1 = Citation.create('Sim1 Citation', CitationType.PAPER, {}, cryptoService);
      const citation2 = Citation.create('Sim2 Citation', CitationType.BOOK, {}, cryptoService);

      await repository.save(citation1, mockSimulationId);
      await repository.save(citation2, mockSimulationId2);

      const result1 = await repository.findBySimulation(mockSimulationId);
      const result2 = await repository.findBySimulation(mockSimulationId2);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      if (result1.isOk() && result2.isOk()) {
        expect(result1.value.length).toBe(1);
        expect(result2.value.length).toBe(1);
        expect(result1.value[0].source).toBe('Sim1 Citation');
        expect(result2.value[0].source).toBe('Sim2 Citation');
      }
    });
  });

  describe('findByType()', () => {
    it('should filter citations by type', async () => {
      const paper1 = Citation.create('Paper 1', CitationType.PAPER, {}, cryptoService);
      const paper2 = Citation.create('Paper 2', CitationType.PAPER, {}, cryptoService);
      const book = Citation.create('Book 1', CitationType.BOOK, {}, cryptoService);
      const website = Citation.create('Website 1', CitationType.WEBSITE, {}, cryptoService);

      await repository.save(paper1, mockSimulationId);
      await repository.save(paper2, mockSimulationId);
      await repository.save(book, mockSimulationId);
      await repository.save(website, mockSimulationId);

      const result = await repository.findByType(mockSimulationId, CitationType.PAPER);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.length).toBe(2);
        result.value.forEach(citation => {
          expect(citation.type).toBe(CitationType.PAPER);
        });
      }
    });

    it('should return empty array when no citations match type', async () => {
      const book = Citation.create('Book 1', CitationType.BOOK, {}, cryptoService);
      await repository.save(book, mockSimulationId);

      const result = await repository.findByType(mockSimulationId, CitationType.PAPER);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('getUsageCount()', () => {
    it('should return 0 for citation not referenced by any arguments', async () => {
      const citation = Citation.create('Unused Citation', CitationType.PAPER, {}, cryptoService);
      await repository.save(citation, mockSimulationId);

      const result = await repository.getUsageCount(citation.id);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(0);
      }
    });

    // Note: Testing actual usage count requires arguments to be created
    // This is better suited for E2E tests where we can create full argument chains
  });

  describe('resolveShortId()', () => {
    it('should resolve 7-character short ID to full ID', async () => {
      const citation = Citation.create('Test Source', CitationType.PAPER, {}, cryptoService);
      await repository.save(citation, mockSimulationId);

      const shortId = citation.getShortId();
      const result = await repository.resolveShortId(shortId);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(citation.id);
      }
    });

    it('should resolve longer prefix to full ID', async () => {
      const citation = Citation.create('Test Source', CitationType.PAPER, {}, cryptoService);
      await repository.save(citation, mockSimulationId);

      const fullId = CitationId.toString(citation.id);
      const prefix = fullId.substring(0, 12);
      const result = await repository.resolveShortId(prefix);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(citation.id);
      }
    });

    it('should return error for short ID less than 7 characters', async () => {
      const result = await repository.resolveShortId('abc12');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.reason).toBe('too_short');
      }
    });

    it('should return error for non-existent short ID', async () => {
      const result = await repository.resolveShortId('abcdef1');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.reason).toBe('not_found');
      }
    });
  });

  describe('Content-addressed storage', () => {
    it('should generate same ID for identical citation content', async () => {
      const citation1 = Citation.create(
        'Identical Source',
        CitationType.PAPER,
        { doi: '10.1234/same' },
        cryptoService
      );

      const citation2 = Citation.create(
        'Identical Source',
        CitationType.PAPER,
        { doi: '10.1234/same' },
        cryptoService
      );

      expect(citation1.id).toBe(citation2.id);

      // Saving both should result in the same storage location
      await repository.save(citation1, mockSimulationId);
      await repository.save(citation2, mockSimulationId);

      const result = await repository.findBySimulation(mockSimulationId);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should only have one citation due to content addressing
        expect(result.value.length).toBe(1);
      }
    });

    it('should generate different IDs for different citation content', async () => {
      const citation1 = Citation.create('Source A', CitationType.PAPER, {}, cryptoService);
      const citation2 = Citation.create('Source B', CitationType.PAPER, {}, cryptoService);

      expect(citation1.id).not.toBe(citation2.id);
    });
  });

  describe('Persistence and recovery', () => {
    it('should persist citations across repository instances', async () => {
      const citation = Citation.create(
        'Persistent Citation',
        CitationType.STUDY,
        { year: 2024 },
        cryptoService
      );

      await repository.save(citation, mockSimulationId);

      // Create new repository instance with same storage
      const newRepository = new FileCitationRepository(storage, hashResolver, cryptoService);
      const result = await newRepository.findById(citation.id);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBe(citation.id);
        expect(result.value.source).toBe(citation.source);
        expect(result.value.type).toBe(citation.type);
      }
    });

    it('should handle concurrent saves to different simulations', async () => {
      const citation1 = Citation.create('Concurrent 1', CitationType.PAPER, {}, cryptoService);
      const citation2 = Citation.create('Concurrent 2', CitationType.BOOK, {}, cryptoService);

      // Save concurrently
      const [result1, result2] = await Promise.all([
        repository.save(citation1, mockSimulationId),
        repository.save(citation2, mockSimulationId2),
      ]);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      // Verify both saved correctly
      const sim1Citations = await repository.findBySimulation(mockSimulationId);
      const sim2Citations = await repository.findBySimulation(mockSimulationId2);

      expect(sim1Citations.isOk()).toBe(true);
      expect(sim2Citations.isOk()).toBe(true);

      if (sim1Citations.isOk() && sim2Citations.isOk()) {
        expect(sim1Citations.value.length).toBe(1);
        expect(sim2Citations.value.length).toBe(1);
      }
    });
  });
});
