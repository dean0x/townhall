/**
 * ARCHITECTURE: Interface layer - Simulate command (refactored)
 * Pattern: Simple command adapter with Result-based error handling
 * Rationale: Thin translation layer with proper error propagation
 */

import { Command } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { InitializeDebateCommand } from '../../../application/commands/InitializeDebateCommand';

interface SimulateOptions {
  topic: string;
  maxRounds?: string;
}

interface ValidatedSimulateOptions {
  topic: string;
  maxRounds: number;
}

export class SimulateCommand extends BaseCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    context: CommandContext
  ) {
    super('simulate', 'Simulation commands', context);
  }

  protected setupOptions(command: Command): void {
    // Create subcommand structure: simulate debate <topic>
    const debateCmd = new Command('debate')
      .description('Start a new debate simulation')
      .argument('<topic>', 'The debate topic')
      .option('--max-rounds <number>', 'Maximum number of debate rounds', '10')
      .action(async (topic: string, options: any) => {
        const result = await this.executeWithOptions({ topic, maxRounds: options.maxRounds });
        if (result.isErr()) {
          this.handleError(result.error);
        }
      });

    command.addCommand(debateCmd);
  }

  // Override build to handle subcommand structure
  public build(): Command {
    this.setupOptions(this.command);
    return this.command;
  }

  private async executeWithOptions(options: SimulateOptions): Promise<Result<void, DomainError>> {
    const validationResult = this.validateOptions(options);
    if (validationResult.isErr()) {
      return err(validationResult.error);
    }
    return await this.execute(validationResult.value);
  }

  protected validateOptions(options: SimulateOptions): Result<ValidatedSimulateOptions, ValidationError> {
    // Validate topic
    if (!options.topic || options.topic.trim().length === 0) {
      return err(new ValidationError(
        'Topic cannot be empty',
        'topic'
      ));
    }

    if (options.topic.length > 500) {
      return err(new ValidationError(
        'Topic must be less than 500 characters',
        'topic'
      ));
    }

    // Validate maxRounds
    const maxRounds = parseInt(options.maxRounds || '10', 10);
    if (isNaN(maxRounds) || maxRounds < 1 || maxRounds > 100) {
      return err(new ValidationError(
        'Max rounds must be a number between 1 and 100',
        'maxRounds'
      ));
    }

    return ok({
      topic: options.topic.trim(),
      maxRounds,
    });
  }

  protected async execute(validatedOptions: ValidatedSimulateOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Starting debate simulation', {
      topic: validatedOptions.topic,
      maxRounds: validatedOptions.maxRounds,
    });

    const command: InitializeDebateCommand = {
      topic: validatedOptions.topic,
      maxRounds: validatedOptions.maxRounds,
    };

    const result = await this.commandBus.execute(command, 'InitializeDebateCommand');

    if (result.isErr()) {
      return err(result.error);
    }

    const debate = result.value;
    this.displaySuccess('Debate simulation started', {
      'ID': debate.simulationId,
      'Topic': debate.topic,
      'Status': debate.status,
      'Max Rounds': validatedOptions.maxRounds,
      'Created': new Date(debate.createdAt).toLocaleString(),
    });

    this.context.logger.info('Debate simulation started successfully', {
      simulationId: debate.simulationId,
      status: debate.status,
    });

    return ok(undefined);
  }
}