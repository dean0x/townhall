/**
 * ARCHITECTURE: Interface layer - Init command
 * Pattern: Command adapter that delegates to infrastructure
 * Rationale: Simple initialization doesn't need full CQRS
 */

import { Command } from 'commander';
import { ObjectStorage } from '../../../infrastructure/storage/ObjectStorage';
import { ILogger } from '../../../application/ports/ILogger';

export class InitCommand {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly logger: ILogger
  ) {}

  public build(): Command {
    return new Command('init')
      .description('Initialize a new Townhall repository')
      .action(async () => {
        await this.execute();
      });
  }

  private async execute(): Promise<void> {
    this.logger.info('Initializing Townhall repository');

    const result = await this.storage.initialize();

    if (result.isErr()) {
      console.error('❌ Failed to initialize repository:', result.error.message);
      process.exit(1);
    }

    console.log('✓ Initialized Townhall repository in .townhall/');
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

    this.logger.info('Repository initialized successfully');
  }
}