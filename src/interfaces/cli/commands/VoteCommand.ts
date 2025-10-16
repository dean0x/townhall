/**
 * ARCHITECTURE: Interface layer - Vote command (refactored)
 * Pattern: Command adapter with Result-based error handling
 * Rationale: Separates CLI concerns from business logic with proper error propagation
 */

import { Command } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { VoteToCloseCommand } from '../../../application/commands/VoteToCloseCommand';
import { AgentIdGenerator, AgentId } from '../../../core/value-objects/AgentId';

interface VoteOptions {
  agent: string;
  yes?: boolean;
  no?: boolean;
  reason?: string;
}

interface ValidatedVoteOptions {
  agentId: AgentId;
  vote: boolean;
  reason?: string;
}

export class VoteCommand extends BaseCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    context: CommandContext
  ) {
    super('vote', 'Vote to close the current debate', context);
  }

  protected setupOptions(command: Command): void {
    command
      .requiredOption('--agent <id>', 'Agent ID casting the vote')
      .option('--yes', 'Vote to close the debate')
      .option('--no', 'Vote against closing the debate')
      .option('--reason <text>', 'Optional reason for your vote');
  }

  protected validateOptions(options: VoteOptions): Result<ValidatedVoteOptions, ValidationError> {
    // Validate vote direction
    const vote = options.yes ? true : options.no ? false : undefined;

    if (vote === undefined) {
      return err(new ValidationError(
        'You must specify either --yes or --no',
        'vote'
      ));
    }

    // Validate agent ID
    const agentIdResult = this.validateAgentId(options.agent);
    if (agentIdResult.isErr()) {
      return err(agentIdResult.error);
    }

    return ok({
      agentId: agentIdResult.value,
      vote,
      reason: options.reason,
    });
  }

  protected async execute(validatedOptions: ValidatedVoteOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Casting vote to close', {
      agent: validatedOptions.agentId,
      vote: validatedOptions.vote,
      reason: validatedOptions.reason,
    });

    const command: VoteToCloseCommand = {
      agentId: validatedOptions.agentId,
      vote: validatedOptions.vote,
      reason: validatedOptions.reason,
    };

    const result = await this.commandBus.execute(command, 'VoteToCloseCommand');

    if (result.isErr()) {
      return err(result.error);
    }

    const voteResult = result.value;

    // Display vote results
    this.displaySuccess('Vote cast successfully');
    console.log(`Total votes: ${voteResult.totalVotes}/${voteResult.votesNeeded} needed`);

    if (voteResult.debateClosed) {
      console.log('');
      console.log('🎯 Debate closed!');
      if (voteResult.reason) {
        console.log(voteResult.reason);
      }
    } else {
      const remaining = voteResult.votesNeeded - voteResult.totalVotes;
      console.log(`${remaining} more vote(s) needed to close the debate`);
    }

    this.context.logger.info('Vote cast successfully', {
      totalVotes: voteResult.totalVotes,
      votesNeeded: voteResult.votesNeeded,
      debateClosed: voteResult.debateClosed,
    });

    return ok(undefined);
  }

  private validateAgentId(agentId: string): Result<AgentId, ValidationError> {
    return AgentIdGenerator.fromString(agentId);
  }
}