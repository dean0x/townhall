/**
 * Tests for InitializeDebateHandler
 * Following TDD approach
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InitializeDebateHandler } from '../../../../src/application/handlers/InitializeDebateHandler';
import { InitializeDebateCommand } from '../../../../src/application/commands/InitializeDebateCommand';
import { ISimulationRepository } from '../../../../src/core/repositories/ISimulationRepository';
import { ICryptoService } from '../../../../src/core/services/ICryptoService';
import { ok, err } from '../../../../src/shared/result';
import { StorageError, ConflictError } from '../../../../src/shared/errors';
import { MockCryptoService } from '../../../helpers/MockCryptoService';

describe('InitializeDebateHandler', () => {
  let handler: InitializeDebateHandler;
  let mockSimulationRepo: ISimulationRepository;
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

    handler = new InitializeDebateHandler(mockSimulationRepo, cryptoService);
  });

  it('should create new debate and auto-checkout', async () => {
    const command: InitializeDebateCommand = {
      topic: 'Should AI be regulated?',
    };

    vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok('simulation-id' as any));
    vi.mocked(mockSimulationRepo.switchActive).mockResolvedValue(ok(undefined));

    const result = await handler.handle(command);

    expect(result.isOk()).toBe(true);
    expect(mockSimulationRepo.save).toHaveBeenCalled();
    expect(mockSimulationRepo.switchActive).toHaveBeenCalled();
  });

  it('should allow multiple simulations by auto-checkout', async () => {
    const command: InitializeDebateCommand = {
      topic: 'Another topic',
    };

    vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok('simulation-id-2' as any));
    vi.mocked(mockSimulationRepo.switchActive).mockResolvedValue(ok(undefined));

    const result = await handler.handle(command);

    expect(result.isOk()).toBe(true);
    expect(mockSimulationRepo.save).toHaveBeenCalled();
    expect(mockSimulationRepo.switchActive).toHaveBeenCalled();
  });

  it('should validate topic length', async () => {
    const command: InitializeDebateCommand = {
      topic: '', // Empty topic
    };

    const result = await handler.handle(command);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('Topic');
  });

  it('should handle repository errors gracefully', async () => {
    const command: InitializeDebateCommand = {
      topic: 'Valid topic',
    };

    vi.mocked(mockSimulationRepo.save).mockResolvedValue(err(new StorageError('Storage failed', 'write')));

    const result = await handler.handle(command);

    expect(result.isErr()).toBe(true);
  });
});
