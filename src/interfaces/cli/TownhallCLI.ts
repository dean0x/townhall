/**
 * ARCHITECTURE: Interface layer - Main CLI coordinator
 * Pattern: Commander.js with command delegation
 * Rationale: Thin layer that delegates to command handlers
 */

import { injectable, inject } from 'tsyringe';
import { Command } from 'commander';
import { ICommandBus, CommandBus } from '../../application/handlers/CommandBus';
import { IQueryBus, QueryBus } from '../../application/handlers/QueryBus';
import { ILogger } from '../../application/ports/ILogger';
import { ObjectStorage } from '../../infrastructure/storage/ObjectStorage';
import { TOKENS } from '../../shared/container';

// Command imports
import { InitCommand } from './commands/InitCommand';
import { SimulateCommand } from './commands/SimulateCommand';
import { ArgumentCommand } from './commands/ArgumentCommand';
import { LogCommand } from './commands/LogCommand';
import { RebuttalCommand } from './commands/RebuttalCommand';
import { ConcedeCommand } from './commands/ConcedeCommand';
import { VoteCommand } from './commands/VoteCommand';

@injectable()
export class TownhallCLI {
  private readonly program: Command;

  constructor(
    @inject(TOKENS.CommandBus) private readonly commandBus: ICommandBus,
    @inject(TOKENS.QueryBus) private readonly queryBus: IQueryBus,
    @inject(TOKENS.Logger) private readonly logger: ILogger,
    @inject(TOKENS.ObjectStorage) private readonly storage: ObjectStorage
  ) {
    this.program = new Command();
    this.setupCommands();
  }

  public async run(argv: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      this.logger.error('Command execution failed', error as Error);
      process.exit(1);
    }
  }

  private setupCommands(): void {
    this.program
      .name('townhall')
      .description('Git-inspired CLI for structured agent debate simulations')
      .version('1.0.0');

    // Register commands
    const initCommand = new InitCommand(this.storage, this.logger);
    const simulateCommand = new SimulateCommand(this.commandBus, this.logger);
    const argumentCommand = new ArgumentCommand(this.commandBus, this.logger);
    const logCommand = new LogCommand(this.queryBus, this.logger);
    const rebuttalCommand = new RebuttalCommand(this.commandBus, this.logger);
    const concedeCommand = new ConcedeCommand(this.commandBus, this.logger);
    const voteCommand = new VoteCommand(this.commandBus, this.logger);

    // Add commands to program
    this.program.addCommand(initCommand.build());
    this.program.addCommand(simulateCommand.build());
    this.program.addCommand(argumentCommand.build());
    this.program.addCommand(logCommand.build());
    this.program.addCommand(rebuttalCommand.build());
    this.program.addCommand(concedeCommand.build());
    this.program.addCommand(voteCommand.build());

    // Error handling
    this.program.exitOverride((err) => {
      this.logger.error('Command failed', err);
      throw err;
    });
  }
}