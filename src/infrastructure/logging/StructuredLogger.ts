/**
 * ARCHITECTURE: Infrastructure implementation of logger
 * Pattern: Structured JSON logging for observability
 * Rationale: Production-ready logging with context and structured output
 */

import { injectable } from 'tsyringe';
import { ILogger, LogContext, LogLevel } from '../../application/ports/ILogger';

interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: LogContext;
  readonly error?: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
}

@injectable()
export class StructuredLogger implements ILogger {
  private readonly baseContext: LogContext;

  constructor(baseContext: LogContext = {}) {
    this.baseContext = baseContext;
  }

  /**
   * SECURITY: Sanitize stack traces to prevent information disclosure
   * Removes absolute file paths, keeping only relative paths within project
   */
  private sanitizeStackTrace(stack: string | undefined): string | undefined {
    if (!stack) return undefined;

    return stack
      .split('\n')
      .map(line => {
        // Remove absolute paths, keep only filename and line number
        // Match patterns like: at Function.name (/absolute/path/to/file.ts:123:45)
        return line.replace(/\(.*?([^/\\]+\.(?:ts|js|mjs)):(\d+):(\d+)\)/g, '($1:$2:$3)')
                  .replace(/at\s+(.*?)\s+\(.*?([^/\\]+\.(?:ts|js|mjs)):(\d+):(\d+)\)/g, 'at $1 ($2:$3:$4)')
                  // Also handle lines without function names
                  .replace(/^\s*at\s+.*?([^/\\]+\.(?:ts|js|mjs)):(\d+):(\d+)/g, '    at $1:$2:$3');
      })
      .join('\n');
  }

  public debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  public error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: this.sanitizeStackTrace(error.stack),
      }
    } : {};

    this.log('error', message, { ...context, ...errorContext });
  }

  public child(context: LogContext): ILogger {
    return new StructuredLogger({ ...this.baseContext, ...context });
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.baseContext, ...context },
    };

    // Remove empty context if no additional context provided
    if (Object.keys(entry.context || {}).length === 0) {
      delete (entry as any).context;
    }

    const output = JSON.stringify(entry);

    // Route to appropriate console method based on level
    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }
}