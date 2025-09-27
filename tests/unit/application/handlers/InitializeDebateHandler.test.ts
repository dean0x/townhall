/**
 * Tests for InitializeDebateHandler
 * Following TDD approach
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InitializeDebateHandler } from '../../../../src/application/handlers/InitializeDebateHandler';
import { InitializeDebateCommand } from '../../../../src/application/commands/InitializeDebateCommand';
import { ISimulationRepository } from '../../../../src/core/repositories/ISimulationRepository';
import { ok, err } from '../../../../src/shared/result';
import { StorageError, ConflictError } from '../../../../src/shared/errors';

describe('InitializeDebateHandler', () => {
  let handler: InitializeDebateHandler;
  let mockSimulationRepo: ISimulationRepository;

  beforeEach(() => {
    mockSimulationRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      getActive: vi.fn(),
      setActive: vi.fn(),
      hasActive: vi.fn(),
      clearActive: vi.fn(),
      listAll: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
    };

    handler = new InitializeDebateHandler(mockSimulationRepo);
  });

  it('should create new debate when no active debate exists', async () => {
    const command: InitializeDebateCommand = {
      topic: 'Should AI be regulated?',
    };

    vi.mocked(mockSimulationRepo.hasActive).mockResolvedValue(ok(false));
    vi.mocked(mockSimulationRepo.save).mockResolvedValue(ok('simulation-id' as any));
    vi.mocked(mockSimulationRepo.setActive).mockResolvedValue(ok(undefined));

    const result = await handler.handle(command);

    expect(result.isOk()).toBe(true);
    expect(mockSimulationRepo.save).toHaveBeenCalled();
    expect(mockSimulationRepo.setActive).toHaveBeenCalled();
  });

  it('should fail when active debate already exists', async () => {
    const command: InitializeDebateCommand = {
      topic: 'Another topic',
    };

    vi.mocked(mockSimulationRepo.hasActive).mockResolvedValue(ok(true));

    const result = await handler.handle(command);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('another debate is already active');
    expect(mockSimulationRepo.save).not.toHaveBeenCalled();
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

    vi.mocked(mockSimulationRepo.hasActive).mockResolvedValue(err(new StorageError('Storage failed', 'read')));

    const result = await handler.handle(command);

    expect(result.isErr()).toBe(true);
  });
});