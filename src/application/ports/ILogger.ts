/**
 * ARCHITECTURE: Application layer port for logging
 * Pattern: Interface for infrastructure dependency
 * Rationale: Application defines logging contract, infrastructure implements
 */

export interface LogContext {
  readonly [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogger {
  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void;

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): ILogger;
}