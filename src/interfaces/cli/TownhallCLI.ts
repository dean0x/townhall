/**
 * ARCHITECTURE: Interface layer - Main CLI coordinator (refactored)
 * Pattern: Commander.js with Result-based command delegation
 * Rationale: Thin layer with consistent error handling using Result types
 */

import { injectable, inject } from 'tsyringe';
import { Command } from 'commander';
import { Result, ok, err } from '../../shared/result';
import { DomainError, InternalError } from '../../shared/errors';
import { ICommandBus } from '../../application/handlers/CommandBus';
import { IQueryBus } from '../../application/handlers/QueryBus';
import { ILogger } from '../../application/ports/ILogger';
import type { IArgumentRepository, IDebateRepository } from '../../simulations/debate/repositories';
import type { ObjectStorage as _ObjectStorage } from '../../infrastructure/storage/ObjectStorage';
import { Tokens } from './container-config';
import { CommandContext } from './base/BaseCommand';

// All commands with Result types
import { ArgumentCommand } from './commands/ArgumentCommand';
import { RebuttalCommand } from './commands/RebuttalCommand';
import { SimulateCommand } from './commands/SimulateCommand';
import { InitCommand } from './commands/InitCommand';
import { LogCommand } from './commands/LogCommand';
import { ConcedeCommand } from './commands/ConcedeCommand';
import { VoteCommand } from './commands/VoteCommand';
import { CheckoutCommand } from './commands/CheckoutCommand';
import { StatusCommand } from './commands/StatusCommand';
import { ListCommand } from './commands/ListCommand';
import { ShowCommand } from './commands/ShowCommand';
import { TraceCommand } from './commands/TraceCommand';
import { CitationCommand } from './commands/CitationCommand';

@injectable()
export class TownhallCLI {
  private readonly program: Command;
  private readonly context: CommandContext;

  constructor(
    @inject(Tokens.CommandBus.symbol) private readonly commandBus: ICommandBus,
    @inject(Tokens.QueryBus.symbol) private readonly queryBus: IQueryBus,
    @inject(Tokens.Logger.symbol) private readonly logger: ILogger,
    @inject(Tokens.ObjectStorage.symbol) _storage: _ObjectStorage,
    @inject(Tokens.ArgumentRepository.symbol) private readonly argumentRepository: IArgumentRepository,
    @inject(Tokens.SimulationRepository.symbol) private readonly simulationRepository: IDebateRepository
  ) {
    this.program = new Command();
    this.context = {
      logger: this.logger,
      exitOnError: true, // CLI should exit on error by default
    };
    this.setupCommands();
  }

  /**
   * Run the CLI with Result-based error handling
   */
  public async run(argv: string[]): Promise<Result<void, DomainError>> {
    try {
      await this.program.parseAsync(argv);
      return ok(undefined);
    } catch (error) {
      // Handle Commander-specific errors (help, version, etc.)
      if (this.isCommanderHelpOrVersion(error)) {
        // These are normal exits, not errors
        process.exit(0);
      }

      // Convert other errors to Result type
      const domainError = this.convertToDomainError(error);
      this.logger.error('Command execution failed', domainError);

      if (this.context.exitOnError) {
        this.displayError(domainError);
        process.exit(1);
      }

      return err(domainError);
    }
  }

  /**
   * Run the CLI without exiting on error (useful for testing)
   */
  public async runWithoutExit(argv: string[]): Promise<Result<void, DomainError>> {
    const originalExitOnError = this.context.exitOnError ?? true;
    this.context.exitOnError = false;

    try {
      const result = await this.run(argv);
      return result;
    } catch (error) {
      return err(this.convertToDomainError(error));
    } finally {
      this.context.exitOnError = originalExitOnError;
    }
  }

  private setupCommands(): void {
    this.program
      .name('townhall')
      .description('Git-inspired CLI for structured agent debate simulations')
      .version('1.0.0');

    // Register all commands (using Result types)
    const initCommand = new InitCommand(this.commandBus, this.context);
    const simulateCommand = new SimulateCommand(this.commandBus, this.context);
    const checkoutCommand = new CheckoutCommand(this.commandBus, this.context);
    const statusCommand = new StatusCommand(this.simulationRepository, this.context);
    const listCommand = new ListCommand(this.simulationRepository, this.context);
    const showCommand = new ShowCommand(this.queryBus, this.context);
    const traceCommand = new TraceCommand(this.queryBus, this.context);
    const argumentCommand = new ArgumentCommand(this.commandBus, this.context);
    const logCommand = new LogCommand(this.queryBus, this.context);
    const rebuttalCommand = new RebuttalCommand(this.commandBus, this.argumentRepository, this.context);
    const concedeCommand = new ConcedeCommand(this.commandBus, this.argumentRepository, this.context);
    const voteCommand = new VoteCommand(this.commandBus, this.context);
    const citationCommand = new CitationCommand(this.commandBus, this.queryBus, this.simulationRepository, this.context);

    // Add commands to program
    this.program.addCommand(initCommand.build());
    this.program.addCommand(simulateCommand.build());
    this.program.addCommand(checkoutCommand.build());
    this.program.addCommand(statusCommand.build());
    this.program.addCommand(listCommand.build());
    this.program.addCommand(showCommand.build());
    this.program.addCommand(traceCommand.build());
    this.program.addCommand(argumentCommand.build());
    this.program.addCommand(logCommand.build());
    this.program.addCommand(rebuttalCommand.build());
    this.program.addCommand(concedeCommand.build());
    this.program.addCommand(voteCommand.build());
    this.program.addCommand(citationCommand.build());

    // Configure error handling
    this.configureErrorHandling();
  }

  private configureErrorHandling(): void {
    this.program.exitOverride((err) => {
      // Don't treat help/version as errors
      if (this.isCommanderHelpOrVersion(err)) {
        throw err; // Let it bubble up to be handled normally
      }

      // Log other Commander errors
      this.logger.error('Command failed', err);
      throw err;
    });
  }

  private isCommanderHelpOrVersion(error: unknown): boolean {
    if (!(error instanceof Error) || error.name !== 'CommanderError') {
      return false;
    }

    // Commander errors have a code property
    const hasCode = 'code' in error && typeof error.code === 'string';
    return (
      hasCode && (
        error.code === 'commander.help' ||
        error.code === 'commander.version'
      ) ||
      error.message === '(outputHelp)'
    );
  }

  private convertToDomainError(error: any): DomainError {
    if (error instanceof DomainError) {
      return error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    const cause = error instanceof Error ? error : undefined;

    return new InternalError(message, cause);
  }

  private displayError(error: DomainError): void {
    const errorPrefix = '❌';

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
      case 'STORAGE_ERROR':
        console.error(`${errorPrefix} Storage error: ${error.message}`);
        break;
      case 'BUSINESS_RULE_VIOLATION':
        console.error(`${errorPrefix} Business rule violation: ${error.message}`);
        break;
      default:
        console.error(`${errorPrefix} Error: ${error.message}`);
    }
  }
}

/**
 * Factory function to create CLI with proper error handling
 */
export function createCLI(
  commandBus: ICommandBus,
  queryBus: IQueryBus,
  logger: ILogger,
  storage: _ObjectStorage,
  argumentRepository: IArgumentRepository,
  simulationRepository: IDebateRepository
): TownhallCLI {
  return new TownhallCLI(commandBus, queryBus, logger, storage, argumentRepository, simulationRepository);
}