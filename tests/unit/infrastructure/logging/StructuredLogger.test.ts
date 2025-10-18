/**
 * ARCHITECTURE: Infrastructure layer tests
 * Pattern: Unit tests for StructuredLogger security-critical features
 * Rationale: Ensure stack trace sanitization prevents information disclosure
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StructuredLogger } from '../../../../src/infrastructure/logging/StructuredLogger';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new StructuredLogger({ component: 'test' });
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Logging', () => {
    it('should log debug messages with JSON structure', () => {
      logger.debug('Test debug message');

      expect(consoleDebugSpy).toHaveBeenCalledOnce();
      const logged = JSON.parse(consoleDebugSpy.mock.calls[0][0] as string);

      expect(logged).toMatchObject({
        level: 'debug',
        message: 'Test debug message',
        context: { component: 'test' },
      });
      expect(logged.timestamp).toBeDefined();
    });

    it('should log info messages with JSON structure', () => {
      logger.info('Test info message');

      expect(consoleInfoSpy).toHaveBeenCalledOnce();
      const logged = JSON.parse(consoleInfoSpy.mock.calls[0][0] as string);

      expect(logged).toMatchObject({
        level: 'info',
        message: 'Test info message',
        context: { component: 'test' },
      });
    });

    it('should log warn messages with JSON structure', () => {
      logger.warn('Test warning message');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const logged = JSON.parse(consoleWarnSpy.mock.calls[0][0] as string);

      expect(logged).toMatchObject({
        level: 'warn',
        message: 'Test warning message',
        context: { component: 'test' },
      });
    });

    it('should log error messages with JSON structure', () => {
      logger.error('Test error message');

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(logged).toMatchObject({
        level: 'error',
        message: 'Test error message',
        context: { component: 'test' },
      });
    });
  });

  describe('Context Management', () => {
    it('should merge additional context with base context', () => {
      logger.info('Test message', { userId: '123', action: 'login' });

      const logged = JSON.parse(consoleInfoSpy.mock.calls[0][0] as string);

      expect(logged.context).toMatchObject({
        component: 'test',
        userId: '123',
        action: 'login',
      });
    });

    it('should create child logger with merged context', () => {
      const childLogger = logger.child({ requestId: 'req-456' });

      childLogger.info('Child message', { extra: 'data' });

      const logged = JSON.parse(consoleInfoSpy.mock.calls[0][0] as string);

      expect(logged.context).toMatchObject({
        component: 'test',
        requestId: 'req-456',
        extra: 'data',
      });
    });

    it('should not include empty context objects', () => {
      const loggerWithoutContext = new StructuredLogger();
      loggerWithoutContext.info('Test message');

      const logged = JSON.parse(consoleInfoSpy.mock.calls[0][0] as string);

      expect(logged.context).toBeUndefined();
    });
  });

  describe('Stack Trace Sanitization (Security-Critical)', () => {
    it('should remove absolute Unix paths from stack traces', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Function.test (/home/user/project/src/core/entities/Argument.ts:123:45)
    at processArgument (/home/user/project/src/application/handlers/CreateArgumentHandler.ts:67:12)`;

      logger.error('Error occurred', error);

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(logged.context.error.stack).toBeDefined();
      expect(logged.context.error.stack).not.toContain('/home/user');
      expect(logged.context.error.stack).not.toContain('/project/src');
      expect(logged.context.error.stack).toContain('Argument.ts:123:45');
      expect(logged.context.error.stack).toContain('CreateArgumentHandler.ts:67:12');
    });

    it('should remove absolute Windows paths from stack traces', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Function.test (C:\\Users\\dev\\project\\src\\core\\entities\\Argument.ts:123:45)
    at processArgument (C:\\Users\\dev\\project\\src\\application\\handlers\\CreateArgumentHandler.ts:67:12)`;

      logger.error('Error occurred', error);

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(logged.context.error.stack).not.toContain('C:\\Users');
      expect(logged.context.error.stack).not.toContain('C:\\\\Users');
      expect(logged.context.error.stack).toContain('Argument.ts');
      expect(logged.context.error.stack).toContain('CreateArgumentHandler.ts');
    });

    it('should preserve relative paths in stack traces', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at test (Argument.ts:123:45)
    at process (CreateArgumentHandler.ts:67:12)`;

      logger.error('Error occurred', error);

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(logged.context.error.stack).toContain('Argument.ts:123:45');
      expect(logged.context.error.stack).toContain('CreateArgumentHandler.ts:67:12');
    });

    it('should handle stack traces without function names', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at /home/user/project/src/infrastructure/storage/ObjectStorage.ts:345:23
    at /home/user/project/dist/index.js:1234:56`;

      logger.error('Error occurred', error);

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(logged.context.error.stack).not.toContain('/home/user');
      expect(logged.context.error.stack).toContain('ObjectStorage.ts:345:23');
      expect(logged.context.error.stack).toContain('index.js:1234:56');
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Test error');
      delete error.stack;

      logger.error('Error occurred', error);

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(logged.context.error).toMatchObject({
        name: 'Error',
        message: 'Test error',
      });
      expect(logged.context.error.stack).toBeUndefined();
    });

    it('should handle errors with .mjs extensions', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at test (/home/user/project/src/module.mjs:10:5)`;

      logger.error('Error occurred', error);

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(logged.context.error.stack).not.toContain('/home/user');
      expect(logged.context.error.stack).toContain('module.mjs:10:5');
    });

    it('should not leak sensitive information in stack traces', () => {
      const error = new Error('Database connection failed');
      error.stack = `Error: Database connection failed
    at connect (/var/www/secret-app/src/database/connection.ts:45:12)
    at init (/home/admin/.secret/config/database.ts:23:8)`;

      logger.error('Database error', error);

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      // Ensure no sensitive paths are leaked
      expect(logged.context.error.stack).not.toContain('/var/www/secret-app');
      expect(logged.context.error.stack).not.toContain('/home/admin/.secret');
      expect(logged.context.error.stack).not.toContain('secret-app');
      expect(logged.context.error.stack).not.toContain('.secret');

      // Ensure filename and line numbers are preserved
      expect(logged.context.error.stack).toContain('connection.ts:45:12');
      expect(logged.context.error.stack).toContain('database.ts:23:8');
    });
  });

  describe('Error Logging', () => {
    it('should include error details in context', () => {
      const error = new Error('Test error');
      error.name = 'ValidationError';

      logger.error('Validation failed', error, { field: 'email' });

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(logged.context.error).toMatchObject({
        name: 'ValidationError',
        message: 'Test error',
      });
      expect(logged.context.field).toBe('email');
    });

    it('should handle errors without additional context', () => {
      const error = new Error('Simple error');

      logger.error('Error occurred', error);

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(logged.context.error).toBeDefined();
      expect(logged.context.error.name).toBe('Error');
      expect(logged.context.error.message).toBe('Simple error');
    });

    it('should handle logging without error object', () => {
      logger.error('Error message without error object');

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);

      expect(logged.message).toBe('Error message without error object');
      expect(logged.context.error).toBeUndefined();
    });
  });

  describe('Timestamp Validation', () => {
    it('should include ISO 8601 timestamp in log entries', () => {
      logger.info('Test message');

      const logged = JSON.parse(consoleInfoSpy.mock.calls[0][0] as string);

      expect(logged.timestamp).toBeDefined();
      expect(logged.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should use current time for timestamp', () => {
      const before = new Date().toISOString();
      logger.info('Test message');
      const after = new Date().toISOString();

      const logged = JSON.parse(consoleInfoSpy.mock.calls[0][0] as string);

      expect(logged.timestamp >= before).toBe(true);
      expect(logged.timestamp <= after).toBe(true);
    });
  });
});
