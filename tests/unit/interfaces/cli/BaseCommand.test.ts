/**
 * Tests for BaseCommand with Result-based error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';
import { Result, ok, err } from '../../../../src/shared/result';
import { ValidationError, DomainError } from '../../../../src/shared/errors';
import { BaseCommand, CommandContext } from '../../../../src/interfaces/cli/base/BaseCommand';
import { ILogger } from '../../../../src/application/ports/ILogger';

// Test implementation of BaseCommand
class TestCommand extends BaseCommand {
  public validationResult: Result<any, ValidationError> = ok({ test: true });
  public executionResult: Promise<Result<void, DomainError>> = Promise.resolve(ok(undefined));

  constructor(context: CommandContext) {
    super('test', 'Test command', context);
  }

  protected setupOptions(command: Command): void {
    command.option('--test <value>', 'Test option');
  }

  protected validateOptions(options: any): Result<any, ValidationError> {
    return this.validationResult;
  }

  protected async execute(validatedOptions: any): Promise<Result<void, DomainError>> {
    return this.executionResult;
  }
}

describe('BaseCommand', () => {
  let mockLogger: ILogger;
  let context: CommandContext;
  let testCommand: TestCommand;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    context = {
      logger: mockLogger,
      exitOnError: false, // Don't exit in tests
    };

    testCommand = new TestCommand(context);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('build()', () => {
    it('should create a command with proper structure', () => {
      const command = testCommand.build();

      expect(command.name()).toBe('test');
      expect(command.description()).toBe('Test command');
      expect(command.options).toHaveLength(1);
      expect(command.options[0].flags).toContain('--test');
    });
  });

  describe('validation', () => {
    it('should handle validation errors properly', async () => {
      testCommand.validationResult = err(new ValidationError('Invalid test value', 'test'));

      const command = testCommand.build();
      await command.parseAsync(['node', 'test', '--test', 'value'], { from: 'node' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Command failed',
        expect.objectContaining({
          message: 'Invalid test value',
          code: 'VALIDATION_ERROR',
        })
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Invalid input: Invalid test value');
    });

    it('should proceed to execution on successful validation', async () => {
      testCommand.validationResult = ok({ test: 'valid' });
      testCommand.executionResult = Promise.resolve(ok(undefined));

      const command = testCommand.build();
      await command.parseAsync(['node', 'test', '--test', 'valid'], { from: 'node' });

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('execution', () => {
    it('should handle execution errors with proper error codes', async () => {
      testCommand.validationResult = ok({ test: 'valid' });
      testCommand.executionResult = Promise.resolve(
        err(new ValidationError('Execution failed'))
      );

      const command = testCommand.build();
      await command.parseAsync(['node', 'test', '--test', 'valid'], { from: 'node' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Command failed',
        expect.objectContaining({
          message: 'Execution failed',
          code: 'VALIDATION_ERROR',
        })
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Invalid input: Execution failed');
    });

    it('should display success messages properly', () => {
      const displaySuccess = testCommand['displaySuccess'].bind(testCommand);

      displaySuccess('Operation successful', {
        'ID': '12345',
        'Status': 'active',
        'Count': 42,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Operation successful');
      expect(consoleLogSpy).toHaveBeenCalledWith('  ID: 12345');
      expect(consoleLogSpy).toHaveBeenCalledWith('  Status: active');
      expect(consoleLogSpy).toHaveBeenCalledWith('  Count: 42');
    });
  });

  describe('error handling', () => {
    it('should format different error types correctly', () => {
      const handleError = testCommand['handleError'].bind(testCommand);

      const errors = [
        { error: new ValidationError('Validation failed'), expected: '❌ Invalid input: Validation failed' },
        { error: new (class extends DomainError { constructor() { super('Not found', 'NOT_FOUND'); } })(), expected: '❌ Not found: Not found' },
        { error: new (class extends DomainError { constructor() { super('Conflict', 'CONFLICT'); } })(), expected: '❌ Conflict: Conflict' },
        { error: new (class extends DomainError { constructor() { super('Permission denied', 'PERMISSION_DENIED'); } })(), expected: '❌ Permission denied: Permission denied' },
        { error: new (class extends DomainError { constructor() { super('Storage failed', 'STORAGE_ERROR'); } })(), expected: '❌ Storage error: Storage failed' },
        { error: new (class extends DomainError { constructor() { super('Business rule', 'BUSINESS_RULE_VIOLATION'); } })(), expected: '❌ Business rule violation: Business rule' },
        { error: new (class extends DomainError { constructor() { super('Unknown', 'UNKNOWN'); } })(), expected: '❌ Error: Unknown' },
      ];

      errors.forEach(({ error, expected }) => {
        consoleErrorSpy.mockClear();
        handleError(error);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expected);
      });
    });

    it('should exit process when exitOnError is true', () => {
      context.exitOnError = true;
      testCommand = new TestCommand(context);

      const handleError = testCommand['handleError'].bind(testCommand);

      expect(() => handleError(new ValidationError('Test error'))).toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should not exit process when exitOnError is false', () => {
      context.exitOnError = false;
      testCommand = new TestCommand(context);

      const handleError = testCommand['handleError'].bind(testCommand);

      handleError(new ValidationError('Test error'));
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });

  describe('chainResults helper', () => {
    it('should execute operations in sequence and return all results', async () => {
      const chainResults = testCommand['chainResults'].bind(testCommand);

      const result = await chainResults(
        async () => ok('first'),
        async () => ok('second'),
        async () => ok('third')
      );

      expect(result.isOk()).toBe(true);
      expect(result.value).toEqual(['first', 'second', 'third']);
    });

    it('should stop on first error and return it', async () => {
      const chainResults = testCommand['chainResults'].bind(testCommand);

      const result = await chainResults(
        async () => ok('first'),
        async () => err(new ValidationError('Failed at second')),
        async () => ok('third')
      );

      expect(result.isErr()).toBe(true);
      expect(result.error.message).toBe('Failed at second');
    });
  });

  describe('unexpected errors', () => {
    it('should catch and wrap unexpected errors in Result type', async () => {
      testCommand.validateOptions = () => {
        throw new Error('Unexpected validation error');
      };

      const command = testCommand.build();
      await command.parseAsync(['node', 'test', '--test', 'value'], { from: 'node' });

      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error in command execution',
        expect.objectContaining({ message: 'Unexpected validation error' })
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Invalid input: Unexpected validation error');
    });

    it('should handle non-Error objects thrown', async () => {
      testCommand.validateOptions = () => {
        throw 'String error';
      };

      const command = testCommand.build();
      await command.parseAsync(['node', 'test', '--test', 'value'], { from: 'node' });

      expect(mockLogger.error).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Invalid input: Unknown error occurred');
    });
  });
});