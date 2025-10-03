/**
 * ARCHITECTURE: Interface layer - Base command class
 * Pattern: Template method with Result-based error handling
 * Rationale: Consistent error handling across all CLI commands using Result types
 */

import { Command } from 'commander';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ILogger } from '../../../application/ports/ILogger';

export interface CommandContext {
  logger: ILogger;
  exitOnError?: boolean;
}

export abstract class BaseCommand {
  protected readonly command: Command;
  protected readonly context: CommandContext;

  constructor(name: string, description: string, context: CommandContext) {
    this.command = new Command(name).description(description);
    this.context = context;
  }

  /**
   * Build the command with options and action handler
   */
  public build(): Command {
    // Setup command-specific options
    this.setupOptions(this.command);

    // Set up the action with proper error handling
    this.command.action(async (...args) => {
      const result = await this.executeWithErrorHandling(...args);

      if (result.isErr()) {
        this.handleError(result.error);
      }
    });

    return this.command;
  }

  /**
   * Template method for setting up command options
   * Override in subclasses to add specific options
   */
  protected abstract setupOptions(command: Command): void;

  /**
   * Template method for validating options before execution
   * Returns Result with validated options or validation error
   */
  protected abstract validateOptions(options: any): Result<any, ValidationError>;

  /**
   * Template method for executing the command logic
   * Must return a Result type
   */
  protected abstract execute(validatedOptions: any): Promise<Result<void, DomainError>>;

  /**
   * Execute command with full error handling pipeline
   */
  private async executeWithErrorHandling(...args: any[]): Promise<Result<void, DomainError>> {
    try {
      // Extract options (last argument before callback)
      const options = args[args.length - 2] || args[0];

      // Validate options using Result type
      const validationResult = this.validateOptions(options);
      if (validationResult.isErr()) {
        return err(validationResult.error);
      }

      // Execute command logic
      return await this.execute(validationResult.value);

    } catch (error) {
      // Catch any unexpected errors and wrap in Result
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.context.logger.error('Unexpected error in command execution', error as Error);
      return err(new ValidationError(errorMessage));
    }
  }

  /**
   * Handle errors consistently across all commands
   */
  protected handleError(error: DomainError): void {
    const errorPrefix = '❌';

    // Log the error
    this.context.logger.error('Command failed', error);

    // Display user-friendly error message
    switch (error.code) {
      case 'VALIDATION_ERROR':
        console.error(`${errorPrefix} Invalid input: ${error.message}`);
        break;
      case 'NOT_FOUND':
        console.error(`${errorPrefix} Not found: ${error.message}`);
        break;
      case 'CONFLICT':
        console.error(`${errorPrefix} Conflict: ${error.message}`);
        break;
      case 'PERMISSION_DENIED':
        console.error(`${errorPrefix} Permission denied: ${error.message}`);
        break;
      case 'STORAGE_ERROR':
        console.error(`${errorPrefix} Storage error: ${error.message}`);
        break;
      case 'BUSINESS_RULE_VIOLATION':
        console.error(`${errorPrefix} Business rule violation: ${error.message}`);
        break;
      default:
        console.error(`${errorPrefix} Error: ${error.message}`);
    }

    // Exit if configured to do so (default for CLI)
    if (this.context.exitOnError !== false) {
      process.exit(1);
    }
  }

  /**
   * Helper method to format success messages consistently
   */
  protected displaySuccess(message: string, details?: Record<string, any>): void {
    console.log(`✓ ${message}`);
    if (details) {
      Object.entries(details).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
  }

  /**
   * Helper method to chain Result operations
   */
  protected async chainResults<T, E extends DomainError>(
    ...operations: Array<() => Promise<Result<T, E>>>
  ): Promise<Result<T[], E>> {
    const results: T[] = [];

    for (const operation of operations) {
      const result = await operation();
      if (result.isErr()) {
        return err(result.error);
      }
      results.push(result.value);
    }

    return ok(results);
  }
}