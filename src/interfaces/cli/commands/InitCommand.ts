/**
 * ARCHITECTURE: Interface layer - Init command (refactored)
 * Pattern: Command adapter with Result-based error handling
 * Rationale: Simple initialization with proper error propagation
 * Note: Uses CommandBus to maintain hexagonal architecture boundaries
 */

import { Command } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { InitializeRepositoryCommand } from '../../../application/commands/InitializeRepositoryCommand';

interface InitOptions {
  force?: boolean;
}

interface ValidatedInitOptions {
  force: boolean;
}

export class InitCommand extends BaseCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    context: CommandContext
  ) {
    super('init', 'Initialize a new Townhall repository', context);
  }

  protected setupOptions(command: Command): void {
    command
      .option('--force', 'Force initialization even if repository exists');
  }

  protected validateOptions(options: InitOptions): Result<ValidatedInitOptions, ValidationError> {
    return ok({
      force: options.force || false,
    });
  }

  protected async execute(validatedOptions: ValidatedInitOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Initializing Townhall repository', {
      force: validatedOptions.force,
    });

    const command: InitializeRepositoryCommand = {
      force: validatedOptions.force,
    };

    const result = await this.commandBus.execute(command, 'InitializeRepositoryCommand');

    if (result.isErr()) {
      return err(result.error);
    }

    this.displayRepositoryStructure();

    this.context.logger.info('Repository initialized successfully');

    return ok(undefined);
  }

  private displayRepositoryStructure(): void {
    this.displaySuccess('Initialized Townhall repository in .townhall/');

    console.log('');
    console.log('Repository structure:');
    console.log('  .townhall/');
    console.log('  ├── objects/     # Content-addressed storage');
    console.log('  ├── refs/        # References to simulations');
    console.log('  ├── index/       # Query optimization');
    console.log('  └── agents/      # Agent definitions (MD files)');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Create agent files in .townhall/agents/');
    console.log('  2. Start a debate with: townhall simulate debate "<topic>"');
  }
}