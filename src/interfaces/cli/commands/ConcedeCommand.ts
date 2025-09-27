/**
 * ARCHITECTURE: Interface layer - Concede command
 * Pattern: Command adapter that translates CLI input to application commands
 * Rationale: Separates CLI concerns from business logic
 */

import { Command } from 'commander';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { SubmitConcessionCommand } from '../../../application/commands/SubmitConcessionCommand';
import { ILogger } from '../../../application/ports/ILogger';
import { AgentIdGenerator } from '../../../core/value-objects/AgentId';
import { ArgumentId } from '../../../core/value-objects/ArgumentId';

export class ConcedeCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    private readonly logger: ILogger
  ) {}

  public build(): Command {
    const cmd = new Command('concede')
      .description('Concede a point to another argument')
      .requiredOption('--target <id>', 'Target argument ID to concede to (full hash or short hash)')
      .requiredOption('--agent <id>', 'Agent ID submitting the concession')
      .requiredOption('--reason <text>', 'Reason for conceding: convinced, evidence, or logic-superior')
      .option('--acknowledgement <text>', 'Optional acknowledgement message')
      .action(async (options) => {
        await this.executeConcession(options);
      });

    return cmd;
  }

  private async executeConcession(options: any): Promise<void> {
    this.logger.info('Submitting concession', {
      target: options.target,
      agent: options.agent,
      reason: options.reason,
    });

    // Validate concession reason
    const validReasons = ['convinced', 'evidence', 'logic-superior'];
    if (!validReasons.includes(options.reason)) {
      console.error(`❌ Invalid reason. Must be one of: ${validReasons.join(', ')}`);
      process.exit(1);
    }

    const command: SubmitConcessionCommand = {
      agentId: AgentIdGenerator.fromString(options.agent),
      targetArgumentId: options.target as ArgumentId, // Will need hash resolution
      reason: options.reason,
      acknowledgement: options.acknowledgement,
    };

    const result = await this.commandBus.execute(command, 'SubmitConcessionCommand');

    if (result.isErr()) {
      console.error('❌ Failed to submit concession:', result.error.message);
      process.exit(1);
    }

    const concession = result.value;
    console.log('✓ Concession submitted:', concession.concessionId.slice(0, 12) + '...');
    console.log('Target:', concession.targetId.slice(0, 12) + '...');
    console.log('Reason:', concession.reason);
    console.log('Created:', new Date(concession.createdAt).toLocaleString());

    this.logger.info('Concession submitted successfully', {
      concessionId: concession.concessionId,
      targetId: concession.targetId,
      reason: concession.reason,
    });
  }
}