/**
 * ARCHITECTURE: Application layer tests
 * Pattern: Unit tests for CommandBus mediator pattern
 * Rationale: Ensure command routing and error handling work correctly
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandBus, ICommandHandler } from '../../../../src/application/handlers/CommandBus';
import { Result, ok, err } from '../../../../src/shared/result';
import { ValidationError, InternalError } from '../../../../src/shared/errors';

// Test command types
interface TestCommand {
  readonly value: string;
}

interface AnotherTestCommand {
  readonly data: number;
}

// Mock handler that always succeeds
class SuccessfulHandler implements ICommandHandler<TestCommand, string> {
  public async handle(command: TestCommand): Promise<Result<string, Error>> {
    return ok(`Processed: ${command.value}`);
  }
}

// Mock handler that always fails with domain error
class FailingHandler implements ICommandHandler<TestCommand, string> {
  public async handle(command: TestCommand): Promise<Result<string, Error>> {
    return err(new ValidationError(`Invalid value: ${command.value}`));
  }
}

// Mock handler that throws an exception
class ThrowingHandler implements ICommandHandler<TestCommand, string> {
  public async handle(command: TestCommand): Promise<Result<string, Error>> {
    throw new Error('Unexpected exception');
  }
}

// Mock handler for different command type
class AnotherSuccessfulHandler implements ICommandHandler<AnotherTestCommand, number> {
  public async handle(command: AnotherTestCommand): Promise<Result<number, Error>> {
    return ok(command.data * 2);
  }
}

describe('CommandBus', () => {
  let commandBus: CommandBus;

  beforeEach(() => {
    commandBus = new CommandBus();
  });

  describe('Handler Registration', () => {
    it('should register a command handler successfully', () => {
      const handler = new SuccessfulHandler();

      expect(() => {
        commandBus.register('TestCommand', handler);
      }).not.toThrow();
    });

    it('should register multiple different handlers', () => {
      const handler1 = new SuccessfulHandler();
      const handler2 = new AnotherSuccessfulHandler();

      expect(() => {
        commandBus.register('TestCommand', handler1);
        commandBus.register('AnotherTestCommand', handler2);
      }).not.toThrow();
    });

    it('should allow overriding a registered handler', () => {
      const handler1 = new SuccessfulHandler();
      const handler2 = new FailingHandler();

      commandBus.register('TestCommand', handler1);
      commandBus.register('TestCommand', handler2); // Override

      // Should not throw - last registration wins
      expect(() => {
        commandBus.register('TestCommand', handler2);
      }).not.toThrow();
    });
  });

  describe('Command Execution - Success Cases', () => {
    it('should execute command with explicit command name', async () => {
      const handler = new SuccessfulHandler();
      commandBus.register('TestCommand', handler);

      const command: TestCommand = { value: 'test data' };
      const result = await commandBus.execute(command, 'TestCommand');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('Processed: test data');
      }
    });

    it('should execute command using constructor name fallback', async () => {
      const handler = new SuccessfulHandler();
      commandBus.register('TestCommand', handler);

      // Create command with constructor name
      class TestCommand {
        constructor(public readonly value: string) {}
      }

      const command = new TestCommand('constructor test');
      const result = await commandBus.execute(command);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('Processed: constructor test');
      }
    });

    it('should execute multiple different commands', async () => {
      const handler1 = new SuccessfulHandler();
      const handler2 = new AnotherSuccessfulHandler();

      commandBus.register('TestCommand', handler1);
      commandBus.register('AnotherTestCommand', handler2);

      const command1: TestCommand = { value: 'first' };
      const command2: AnotherTestCommand = { data: 10 };

      const result1 = await commandBus.execute(command1, 'TestCommand');
      const result2 = await commandBus.execute(command2, 'AnotherTestCommand');

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      if (result1.isOk()) expect(result1.value).toBe('Processed: first');
      if (result2.isOk()) expect(result2.value).toBe(20);
    });

    it('should execute same command multiple times', async () => {
      const handler = new SuccessfulHandler();
      commandBus.register('TestCommand', handler);

      const command1: TestCommand = { value: 'call 1' };
      const command2: TestCommand = { value: 'call 2' };
      const command3: TestCommand = { value: 'call 3' };

      const result1 = await commandBus.execute(command1, 'TestCommand');
      const result2 = await commandBus.execute(command2, 'TestCommand');
      const result3 = await commandBus.execute(command3, 'TestCommand');

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      expect(result3.isOk()).toBe(true);

      if (result1.isOk()) expect(result1.value).toBe('Processed: call 1');
      if (result2.isOk()) expect(result2.value).toBe('Processed: call 2');
      if (result3.isOk()) expect(result3.value).toBe('Processed: call 3');
    });
  });

  describe('Command Execution - Error Cases', () => {
    it('should return error when no handler is registered', async () => {
      const command: TestCommand = { value: 'unhandled' };
      const result = await commandBus.execute(command, 'UnregisteredCommand');

      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('No handler registered for command');
        expect(result.error.message).toContain('UnregisteredCommand');
      }
    });

    it('should return error when handler returns error Result', async () => {
      const handler = new FailingHandler();
      commandBus.register('TestCommand', handler);

      const command: TestCommand = { value: 'invalid' };
      const result = await commandBus.execute(command, 'TestCommand');

      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Invalid value: invalid');
      }
    });

    it('should catch and wrap exceptions thrown by handler', async () => {
      const handler = new ThrowingHandler();
      commandBus.register('TestCommand', handler);

      const command: TestCommand = { value: 'will throw' };
      const result = await commandBus.execute(command, 'TestCommand');

      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Command handler failed');
        expect(result.error.message).toContain('Unexpected exception');
      }
    });

    it('should handle command with unknown constructor name', async () => {
      const handler = new SuccessfulHandler();
      commandBus.register('TestCommand', handler);

      // Plain object without constructor
      const command = { value: 'plain object' };
      const result = await commandBus.execute(command); // No explicit name

      // Should fail because constructor.name will be "Object" or "UnknownCommand"
      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('No handler registered');
      }
    });
  });

  describe('Command Execution - Edge Cases', () => {
    it('should handle handler that returns rejected promise', async () => {
      class RejectingHandler implements ICommandHandler<TestCommand, string> {
        public async handle(command: TestCommand): Promise<Result<string, Error>> {
          return Promise.reject(new Error('Promise rejection'));
        }
      }

      const handler = new RejectingHandler();
      commandBus.register('TestCommand', handler);

      const command: TestCommand = { value: 'reject test' };
      const result = await commandBus.execute(command, 'TestCommand');

      expect(result.isOk()).toBe(false);
      if (!result.isOk()) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Command handler failed');
        expect(result.error.message).toContain('Promise rejection');
      }
    });

    it('should execute commands in sequence without interference', async () => {
      const handler = new SuccessfulHandler();
      commandBus.register('TestCommand', handler);

      // Execute multiple commands rapidly
      const commands = Array.from({ length: 10 }, (_, i) => ({
        value: `command-${i}`,
      }));

      const results = await Promise.all(
        commands.map((cmd) => commandBus.execute(cmd, 'TestCommand'))
      );

      // All should succeed
      expect(results.every((r) => r.isOk())).toBe(true);

      // Each should have correct value
      results.forEach((result, index) => {
        if (result.isOk()) {
          expect(result.value).toBe(`Processed: command-${index}`);
        }
      });
    });

    it('should not affect other handlers when one handler fails', async () => {
      const successHandler = new SuccessfulHandler();
      const failHandler = new FailingHandler();

      commandBus.register('SuccessCommand', successHandler);
      commandBus.register('FailCommand', failHandler);

      const successCmd: TestCommand = { value: 'success' };
      const failCmd: TestCommand = { value: 'fail' };

      // Execute failing command first
      const failResult = await commandBus.execute(failCmd, 'FailCommand');
      expect(failResult.isErr()).toBe(true);

      // Success command should still work
      const successResult = await commandBus.execute(successCmd, 'SuccessCommand');
      expect(successResult.isOk()).toBe(true);
      if (successResult.isOk()) {
        expect(successResult.value).toBe('Processed: success');
      }
    });

    it('should handle empty command name by falling back to constructor', async () => {
      const handler = new SuccessfulHandler();
      commandBus.register('', handler);

      const command: TestCommand = { value: 'empty name test' };
      const result = await commandBus.execute(command, '');

      // Empty string is falsy, so CommandBus falls back to constructor.name
      // Since command is plain object, this will fail
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('No handler registered');
      }
    });

    it('should handle special characters in command name', async () => {
      const handler = new SuccessfulHandler();
      const specialName = 'Test-Command_v2.0';

      commandBus.register(specialName, handler);

      const command: TestCommand = { value: 'special chars' };
      const result = await commandBus.execute(command, specialName);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('Processed: special chars');
      }
    });
  });

  describe('Handler State Isolation', () => {
    it('should maintain separate state for different handler instances', async () => {
      class StatefulHandler implements ICommandHandler<TestCommand, number> {
        private callCount = 0;

        public async handle(command: TestCommand): Promise<Result<number, Error>> {
          this.callCount++;
          return ok(this.callCount);
        }
      }

      const handler1 = new StatefulHandler();
      const handler2 = new StatefulHandler();

      commandBus.register('Handler1', handler1);
      commandBus.register('Handler2', handler2);

      const command: TestCommand = { value: 'test' };

      // Call handler1 three times
      await commandBus.execute(command, 'Handler1');
      await commandBus.execute(command, 'Handler1');
      const result1 = await commandBus.execute(command, 'Handler1');

      // Call handler2 once
      const result2 = await commandBus.execute(command, 'Handler2');

      // Each handler should maintain its own state
      expect(result1.isOk() && result1.value).toBe(3);
      expect(result2.isOk() && result2.value).toBe(1);
    });
  });
});
