/**
 * Unit tests for CreateCitationHandler
 * Tests validation logic, error scenarios, and successful citation creation
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateCitationHandler } from '../../../../src/application/handlers/CreateCitationHandler';
import { CreateCitationCommand } from '../../../../src/application/commands/CreateCitationCommand';
import { ICitationRepository } from '../../../../src/core/repositories/ICitationRepository';
import { ISimulationRepository } from '../../../../src/core/repositories/ISimulationRepository';
import { ICryptoService } from '../../../../src/core/services/ICryptoService';
import { ok, err } from '../../../../src/shared/result';
import { ValidationError } from '../../../../src/shared/errors';
import { MockCryptoService } from '../../../helpers/MockCryptoService';
import { DebateSimulation } from '../../../../src/simulations/debate';
import { SimulationIdGenerator } from '../../../../src/core/value-objects/SimulationId';
import { TimestampGenerator } from '../../../../src/core/value-objects/Timestamp';
import { CitationType } from '../../../../src/core/value-objects/CitationType';

describe('CreateCitationHandler', () => {
  let handler: CreateCitationHandler;
  let mockCitationRepo: ICitationRepository;
  let mockSimulationRepo: ISimulationRepository;
  let cryptoService: ICryptoService;

  beforeEach(() => {
    cryptoService = new MockCryptoService();

    mockCitationRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findBySimulation: vi.fn(),
      findByType: vi.fn(),
      getUsageCount: vi.fn(),
      getUsageCountsBatch: vi.fn(),
      resolveShortId: vi.fn(),
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

    handler = new CreateCitationHandler(
      mockCitationRepo,
      cryptoService,
      mockSimulationRepo
    );
  });

  describe('Validation', () => {
    it('should reject empty source', async () => {
      const command: CreateCitationCommand = {
        source: '',
        type: 'paper' as CitationType,
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('source is required');
      }
    });

    it('should reject whitespace-only source', async () => {
      const command: CreateCitationCommand = {
        source: '   ',
        type: 'paper' as CitationType,
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('source is required');
      }
    });

    it('should reject source longer than 500 characters', async () => {
      const command: CreateCitationCommand = {
        source: 'a'.repeat(501),
        type: 'paper' as CitationType,
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('less than 500 characters');
      }
    });

    it('should reject missing type', async () => {
      const command = {
        source: 'Test Source',
      } as CreateCitationCommand;

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('type is required');
      }
    });

    it('should reject year before 1000', async () => {
      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
        year: 999,
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Year must be between');
      }
    });

    it('should reject year in future', async () => {
      const currentYear = new Date().getFullYear();
      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
        year: currentYear + 2,
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Year must be between');
      }
    });

    it('should reject negative page number', async () => {
      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
        page: -1,
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Page number must be positive');
      }
    });

    it('should reject zero page number', async () => {
      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
        page: 0,
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Page number must be positive');
      }
    });

    it('should reject quote longer than 1000 characters', async () => {
      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
        quote: 'a'.repeat(1001),
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Quote must be less than 1000 characters');
      }
    });

    it('should reject invalid URL protocol', async () => {
      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'website' as CitationType,
        url: 'javascript:alert(1)',
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('http or https protocol');
      }
    });

    it('should reject URL with localhost', async () => {
      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'website' as CitationType,
        url: 'http://localhost:8080/secret',
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('private network addresses');
      }
    });

    it('should reject URL with private IP (192.168.x.x)', async () => {
      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'website' as CitationType,
        url: 'http://192.168.1.1/internal',
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('private network addresses');
      }
    });

    it('should reject URL with private IP (10.x.x.x)', async () => {
      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'website' as CitationType,
        url: 'http://10.0.0.1/internal',
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('private network addresses');
      }
    });

    it('should reject invalid DOI format', async () => {
      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
        doi: 'invalid-doi',
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Invalid DOI format');
      }
    });

    it('should accept valid DOI format', async () => {
      const simulationId = SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now());
      const simulation = DebateSimulation.reconstitute(
        simulationId.value,
        'Test',
        TimestampGenerator.now(),
        'active',
        [],
        [],
        []
      );

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockCitationRepo.save).mockResolvedValue(ok('citation-id' as any));

      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
        doi: '10.1234/test',
      };

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
    });

    it('should accept valid URL', async () => {
      const simulationId = SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now());
      const simulation = DebateSimulation.reconstitute(
        simulationId.value,
        'Test',
        TimestampGenerator.now(),
        'active',
        [],
        [],
        []
      );

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockCitationRepo.save).mockResolvedValue(ok('citation-id' as any));

      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'website' as CitationType,
        url: 'https://example.com/article',
      };

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
    });
  });

  describe('Successful Creation', () => {
    it('should create citation with required fields only', async () => {
      const simulationId = SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now());
      const simulation = DebateSimulation.reconstitute(
        simulationId.value,
        'Test',
        TimestampGenerator.now(),
        'active',
        [],
        [],
        []
      );

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockCitationRepo.save).mockResolvedValue(ok('citation-id' as any));

      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
      };

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      expect(mockCitationRepo.save).toHaveBeenCalledOnce();
    });

    it('should create citation with all optional fields', async () => {
      const simulationId = SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now());
      const simulation = DebateSimulation.reconstitute(
        simulationId.value,
        'Test',
        TimestampGenerator.now(),
        'active',
        [],
        [],
        []
      );

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockCitationRepo.save).mockResolvedValue(ok('citation-id' as any));

      const command: CreateCitationCommand = {
        source: 'Complete Citation',
        type: 'paper' as CitationType,
        doi: '10.1234/test',
        url: 'https://example.com',
        page: 42,
        quote: 'Important finding',
        authors: ['Smith, J.', 'Doe, A.'],
        year: 2023,
      };

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      expect(mockCitationRepo.save).toHaveBeenCalledOnce();
    });

    it('should return citation ID on success', async () => {
      const simulationId = SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now());
      const simulation = DebateSimulation.reconstitute(
        simulationId.value,
        'Test',
        TimestampGenerator.now(),
        'active',
        [],
        [],
        []
      );

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockCitationRepo.save).mockImplementation(async (citation) => ok(citation.id));

      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
      };

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should return a valid citation ID (SHA-256 hash - 64 chars)
        expect(typeof result.value).toBe('string');
        expect((result.value as string).length).toBe(64);
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should return error when no active simulation', async () => {
      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(err(new ValidationError('No active simulation')));

      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('No active simulation');
      }
    });

    it('should return error when repository save fails', async () => {
      const simulationId = SimulationIdGenerator.fromTopicAndTimestamp('Test', TimestampGenerator.now());
      const simulation = DebateSimulation.reconstitute(
        simulationId.value,
        'Test',
        TimestampGenerator.now(),
        'active',
        [],
        [],
        []
      );

      vi.mocked(mockSimulationRepo.getActive).mockResolvedValue(ok(simulation));
      vi.mocked(mockCitationRepo.save).mockResolvedValue(err(new ValidationError('Save failed')));

      const command: CreateCitationCommand = {
        source: 'Test Source',
        type: 'paper' as CitationType,
      };

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Failed to save citation');
      }
    });
  });
});
