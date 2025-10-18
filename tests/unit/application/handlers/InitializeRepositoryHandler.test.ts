/**
 * Tests for InitializeRepositoryHandler
 * Validates repository initialization through application port
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InitializeRepositoryHandler } from '../../../../src/application/handlers/InitializeRepositoryHandler';
import { InitializeRepositoryCommand } from '../../../../src/application/commands/InitializeRepositoryCommand';
import { IStorageInitializer } from '../../../../src/application/ports/IStorageInitializer';
import { ok, err } from '../../../../src/shared/result';
import { StorageError } from '../../../../src/shared/errors';

describe('InitializeRepositoryHandler', () => {
  let handler: InitializeRepositoryHandler;
  let mockStorageInitializer: IStorageInitializer;

  beforeEach(() => {
    // Create mock storage initializer
    mockStorageInitializer = {
      initialize: vi.fn(),
    };

    handler = new InitializeRepositoryHandler(mockStorageInitializer);
  });

  describe('successful initialization', () => {
    it('should initialize repository successfully', async () => {
      const command: InitializeRepositoryCommand = {
        force: false,
      };

      vi.mocked(mockStorageInitializer.initialize).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      expect(mockStorageInitializer.initialize).toHaveBeenCalledTimes(1);
    });

    it('should call storage initializer when force is true', async () => {
      const command: InitializeRepositoryCommand = {
        force: true,
      };

      vi.mocked(mockStorageInitializer.initialize).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      expect(mockStorageInitializer.initialize).toHaveBeenCalledTimes(1);
    });

    it('should call storage initializer when force is false', async () => {
      const command: InitializeRepositoryCommand = {
        force: false,
      };

      vi.mocked(mockStorageInitializer.initialize).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      expect(result.isOk()).toBe(true);
      expect(mockStorageInitializer.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle storage initialization failure', async () => {
      const command: InitializeRepositoryCommand = {
        force: false,
      };

      const storageError = new StorageError('Failed to create directories', 'write');
      vi.mocked(mockStorageInitializer.initialize).mockResolvedValue(err(storageError));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(storageError);
      expect(result._unsafeUnwrapErr().message).toBe('Failed to create directories');
      expect(result._unsafeUnwrapErr().operation).toBe('write');
    });

    it('should handle permission denied errors', async () => {
      const command: InitializeRepositoryCommand = {
        force: false,
      };

      const permissionError = new StorageError('Permission denied', 'write');
      vi.mocked(mockStorageInitializer.initialize).mockResolvedValue(err(permissionError));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('Permission denied');
    });

    it('should handle storage quota exceeded errors', async () => {
      const command: InitializeRepositoryCommand = {
        force: false,
      };

      const quotaError = new StorageError('Disk quota exceeded', 'write');
      vi.mocked(mockStorageInitializer.initialize).mockResolvedValue(err(quotaError));

      const result = await handler.handle(command);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('Disk quota exceeded');
    });
  });

  describe('dependency injection', () => {
    it('should use injected storage initializer interface', () => {
      // Verify handler accepts IStorageInitializer interface
      expect(handler).toBeInstanceOf(InitializeRepositoryHandler);
      // TypeScript ensures compile-time that only IStorageInitializer is accepted
    });

    it('should not depend on concrete infrastructure implementation', () => {
      // This test documents architectural constraint:
      // Handler depends on IStorageInitializer (application port),
      // not ObjectStorage (infrastructure implementation)

      // If this compiles, the architecture is correct
      const mockPort: IStorageInitializer = {
        initialize: vi.fn().mockResolvedValue(ok(undefined)),
      };

      const testHandler = new InitializeRepositoryHandler(mockPort);
      expect(testHandler).toBeInstanceOf(InitializeRepositoryHandler);
    });
  });

  describe('force flag behavior (future)', () => {
    it('should document TODO for force flag implementation', async () => {
      // Current behavior: force flag is ignored
      // TODO: Implement existence check when force=false
      // See: InitializeRepositoryHandler.ts line 24

      const command: InitializeRepositoryCommand = {
        force: false,
      };

      vi.mocked(mockStorageInitializer.initialize).mockResolvedValue(ok(undefined));

      const result = await handler.handle(command);

      // Currently, force flag has no effect
      expect(result.isOk()).toBe(true);

      // Future behavior should be:
      // - force=false: Check if .townhall exists, return error if it does
      // - force=true: Always initialize, overwriting existing repository
    });
  });
});
