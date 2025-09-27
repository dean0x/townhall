/**
 * ARCHITECTURE: Interface layer - Rebuttal command
 * Pattern: Command adapter that translates CLI input to application commands
 * Rationale: Separates CLI concerns from business logic
 */

import { Command } from 'commander';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { SubmitRebuttalCommand } from '../../../application/commands/SubmitRebuttalCommand';
import { ILogger } from '../../../application/ports/ILogger';
import { RebuttalType } from '../../../core/entities/Rebuttal';
import { ArgumentContent, ArgumentType } from '../../../core/entities/Argument';
import { AgentIdGenerator } from '../../../core/value-objects/AgentId';
import { ArgumentId } from '../../../core/value-objects/ArgumentId';

export class RebuttalCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    private readonly logger: ILogger
  ) {}

  public build(): Command {
    const cmd = new Command('rebuttal')
      .description('Submit a rebuttal to an existing argument')
      .requiredOption('--target <id>', 'Target argument ID (full hash or short hash)')
      .requiredOption('--agent <id>', 'Agent ID submitting the rebuttal')
      .requiredOption('--type <type>', 'Rebuttal type: logical, empirical, or methodological')
      .requiredOption('--argument-type <type>', 'Argument type: deductive, inductive, or empirical')
      .requiredOption('--summary <text>', 'Brief summary of the rebuttal')
      .requiredOption('--premise <premise...>', 'Premises supporting the rebuttal (multiple allowed)')
      .option('--conclusion <text>', 'Conclusion (for deductive arguments)')
      .option('--pattern <text>', 'Pattern observed (for inductive arguments)')
      .option('--probability <number>', 'Probability estimate 0-1 (for inductive arguments)')
      .option('--hypothesis <text>', 'Hypothesis (for empirical arguments)')
      .option('--evidence <evidence...>', 'Supporting evidence (for empirical arguments)')
      .option('--confidence <number>', 'Confidence level (0-100)', '75')
      .action(async (options) => {
        await this.executeRebuttal(options);
      });

    return cmd;
  }

  private async executeRebuttal(options: any): Promise<void> {
    this.logger.info('Submitting rebuttal', {
      target: options.target,
      agent: options.agent,
      type: options.type,
    });

    // Parse argument content based on type
    let structure: any;
    switch (options.argumentType) {
      case 'deductive':
        if (!options.conclusion) {
          console.error('❌ Deductive arguments require --conclusion');
          process.exit(1);
        }
        structure = {
          premises: options.premise,
          conclusion: options.conclusion,
        };
        break;

      case 'inductive':
        if (!options.pattern) {
          console.error('❌ Inductive arguments require --pattern');
          process.exit(1);
        }
        structure = {
          observations: options.premise,
          pattern: options.pattern,
          probability: parseFloat(options.probability || '0.75'),
        };
        break;

      case 'empirical':
        if (!options.hypothesis || !options.evidence) {
          console.error('❌ Empirical arguments require --hypothesis and --evidence');
          process.exit(1);
        }
        structure = {
          hypothesis: options.hypothesis,
          evidence: options.evidence,
          methodology: 'Direct observation', // Default for CLI
        };
        break;

      default:
        console.error('❌ Invalid argument type. Must be: deductive, inductive, or empirical');
        process.exit(1);
    }

    const content: ArgumentContent = {
      summary: options.summary,
      structure,
      type: options.argumentType as ArgumentType,
    };

    // Validate rebuttal type
    const validRebuttalTypes: RebuttalType[] = ['logical', 'empirical', 'methodological'];
    if (!validRebuttalTypes.includes(options.type)) {
      console.error(`❌ Invalid rebuttal type. Must be one of: ${validRebuttalTypes.join(', ')}`);
      process.exit(1);
    }

    const command: SubmitRebuttalCommand = {
      agentId: AgentIdGenerator.fromString(options.agent),
      targetArgumentId: options.target as ArgumentId, // Will need hash resolution
      rebuttalType: options.type as RebuttalType,
      content,
    };

    const result = await this.commandBus.execute(command, 'SubmitRebuttalCommand');

    if (result.isErr()) {
      console.error('❌ Failed to submit rebuttal:', result.error.message);
      process.exit(1);
    }

    const rebuttal = result.value;
    console.log('✓ Rebuttal submitted:', rebuttal.rebuttalId.slice(0, 12) + '...');
    console.log('Target:', rebuttal.targetId.slice(0, 12) + '...');
    console.log('Type:', rebuttal.rebuttalType);
    console.log('Created:', new Date(rebuttal.createdAt).toLocaleString());

    this.logger.info('Rebuttal submitted successfully', {
      rebuttalId: rebuttal.rebuttalId,
      targetId: rebuttal.targetId,
      type: rebuttal.rebuttalType,
    });
  }
}