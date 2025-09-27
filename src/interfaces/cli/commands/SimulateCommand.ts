/**
 * ARCHITECTURE: Interface layer - Simulate command
 * Pattern: Command adapter that translates CLI input to application commands
 * Rationale: Separates CLI concerns from business logic
 */

import { Command } from 'commander';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { InitializeDebateCommand } from '../../../application/commands/InitializeDebateCommand';
import { ILogger } from '../../../application/ports/ILogger';

export class SimulateCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    private readonly logger: ILogger
  ) {}

  public build(): Command {
    const cmd = new Command('simulate');

    cmd
      .command('debate')
      .description('Start a new debate simulation')
      .argument('<topic>', 'The debate topic')
      .action(async (topic: string) => {
        await this.executeDebate(topic);
      });

    return cmd;
  }

  private async executeDebate(topic: string): Promise<void> {
    this.logger.info('Starting new debate', { topic });

    const command: InitializeDebateCommand = { topic };
    const result = await this.commandBus.execute(command, 'InitializeDebateCommand');

    if (result.isErr()) {
      console.error('❌ Failed to start debate:', result.error.message);
      process.exit(1);
    }

    const debate = result.value;
    console.log('✓ Debate initialized:', debate.simulationId.slice(0, 12) + '...');
    console.log('Topic:', debate.topic);
    console.log('Status: active');
    console.log('Created:', new Date(debate.createdAt).toLocaleString());
    console.log('');
    console.log('Ready for arguments. Agents can now submit their positions using:');
    console.log('  townhall argument --agent <agent-id> --type <type> ...');

    this.logger.info('Debate started successfully', {
      simulationId: debate.simulationId,
      topic: debate.topic,
    });
  }
}