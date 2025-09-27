/**
 * ARCHITECTURE: Interface layer - Vote command
 * Pattern: Command adapter that translates CLI input to application commands
 * Rationale: Separates CLI concerns from business logic
 */

import { Command } from 'commander';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { VoteToCloseCommand } from '../../../application/commands/VoteToCloseCommand';
import { ILogger } from '../../../application/ports/ILogger';
import { AgentIdGenerator } from '../../../core/value-objects/AgentId';

export class VoteCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    private readonly logger: ILogger
  ) {}

  public build(): Command {
    const cmd = new Command('vote')
      .description('Vote to close the current debate')
      .requiredOption('--agent <id>', 'Agent ID casting the vote')
      .option('--yes', 'Vote to close the debate')
      .option('--no', 'Vote against closing the debate')
      .option('--reason <text>', 'Optional reason for your vote')
      .action(async (options) => {
        await this.executeVote(options);
      });

    return cmd;
  }

  private async executeVote(options: any): Promise<void> {
    // Determine vote value
    const vote = options.yes ? true : options.no ? false : undefined;

    if (vote === undefined) {
      console.error('❌ You must specify either --yes or --no');
      process.exit(1);
    }

    this.logger.info('Casting vote to close', {
      agent: options.agent,
      vote,
      reason: options.reason,
    });

    const command: VoteToCloseCommand = {
      agentId: AgentIdGenerator.fromString(options.agent),
      vote,
      reason: options.reason,
    };

    const result = await this.commandBus.execute(command, 'VoteToCloseCommand');

    if (result.isErr()) {
      console.error('❌ Failed to cast vote:', result.error.message);
      process.exit(1);
    }

    const voteResult = result.value;
    console.log('✓ Vote cast successfully');
    console.log(`Total votes: ${voteResult.totalVotes}/${voteResult.votesNeeded} needed`);

    if (voteResult.debateClosed) {
      console.log('');
      console.log('🎯 Debate closed!');
      console.log(voteResult.reason);
    } else {
      const remaining = voteResult.votesNeeded - voteResult.totalVotes;
      console.log(`${remaining} more vote(s) needed to close the debate`);
    }

    this.logger.info('Vote cast successfully', {
      totalVotes: voteResult.totalVotes,
      votesNeeded: voteResult.votesNeeded,
      debateClosed: voteResult.debateClosed,
    });
  }
}