/**
 * ARCHITECTURE: Interface layer - Argument command
 * Pattern: Complex command adapter with validation and type conversion
 * Rationale: Handles different argument types with type-specific options
 */

import { Command, Option } from 'commander';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { CreateArgumentCommand } from '../../../application/commands/CreateArgumentCommand';
import { ArgumentType } from '../../../core/value-objects/ArgumentType';
import { AgentIdGenerator } from '../../../core/value-objects/AgentId';
import { ILogger } from '../../../application/ports/ILogger';

interface ArgumentOptions {
  agent: string;
  type: ArgumentType;
  premise?: string[];
  conclusion?: string;
  observation?: string[];
  generalization?: string;
  confidence?: number;
  evidence?: string[];
  citation?: string[];
  claim?: string;
  methodology?: string;
}

export class ArgumentCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    private readonly logger: ILogger
  ) {}

  public build(): Command {
    return new Command('argument')
      .description('Submit a structured argument to the debate')
      .requiredOption('--agent <uuid>', 'Agent UUID from MD file frontmatter')
      .addOption(new Option('--type <type>', 'Argument type').choices(['deductive', 'inductive', 'empirical']).makeOptionMandatory())

      // Deductive options
      .option('--premise <premise...>', 'Premises for deductive arguments (minimum 2)')
      .option('--conclusion <conclusion>', 'Conclusion for deductive arguments')

      // Inductive options
      .option('--observation <observation...>', 'Observations for inductive arguments (minimum 2)')
      .option('--generalization <generalization>', 'Generalization for inductive arguments')
      .option('--confidence <number>', 'Confidence level (0-1) for inductive arguments', parseFloat)

      // Empirical options
      .option('--evidence <evidence...>', 'Evidence sources for empirical arguments')
      .option('--citation <citation...>', 'Citations for evidence (optional)')
      .option('--claim <claim>', 'Claim for empirical arguments')
      .option('--methodology <methodology>', 'Research methodology (optional)')

      .action(async (options: ArgumentOptions) => {
        await this.execute(options);
      });
  }

  private async execute(options: ArgumentOptions): Promise<void> {
    this.logger.info('Creating argument', {
      agentId: options.agent,
      type: options.type,
    });

    try {
      // Validate agent ID format
      const agentId = AgentIdGenerator.fromString(options.agent);

      // Build argument content based on type
      const content = this.buildArgumentContent(options);

      const command: CreateArgumentCommand = {
        agentId,
        type: options.type,
        content,
      };

      const result = await this.commandBus.execute(command, 'CreateArgumentCommand');

      if (result.isErr()) {
        console.error('❌ Failed to create argument:', result.error.message);
        process.exit(1);
      }

      const argument = result.value;
      console.log('✓ Argument created:', argument.argumentId.slice(0, 12) + '...');
      console.log('Agent:', options.agent);
      console.log('Type:', options.type);
      console.log('ID:', argument.argumentId, '(short:', argument.shortHash + ')');
      console.log('Sequence:', argument.sequenceNumber);
      console.log('Timestamp:', new Date(argument.timestamp).toLocaleString());

      this.logger.info('Argument created successfully', {
        argumentId: argument.argumentId,
        sequenceNumber: argument.sequenceNumber,
      });

    } catch (error) {
      console.error('❌ Invalid input:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  private buildArgumentContent(options: ArgumentOptions): any {
    const text = this.generateArgumentText(options);

    switch (options.type) {
      case ArgumentType.DEDUCTIVE:
        return {
          text,
          structure: {
            premises: options.premise || [],
            conclusion: options.conclusion || '',
          },
        };

      case ArgumentType.INDUCTIVE:
        return {
          text,
          structure: {
            observations: options.observation || [],
            generalization: options.generalization || '',
            confidence: options.confidence,
          },
        };

      case ArgumentType.EMPIRICAL:
        const evidence = (options.evidence || []).map((source, index) => ({
          source,
          citation: options.citation?.[index],
          relevance: 'Supporting evidence', // Default relevance
        }));

        return {
          text,
          structure: {
            evidence,
            claim: options.claim || '',
            methodology: options.methodology,
          },
        };

      default:
        throw new Error(`Unsupported argument type: ${options.type}`);
    }
  }

  private generateArgumentText(options: ArgumentOptions): string {
    switch (options.type) {
      case ArgumentType.DEDUCTIVE:
        const premises = (options.premise || []).join('. ');
        return `${premises}. Therefore, ${options.conclusion || 'conclusion'}.`;

      case ArgumentType.INDUCTIVE:
        const observations = (options.observation || []).join('. ');
        return `${observations}. Therefore, ${options.generalization || 'generalization'}.`;

      case ArgumentType.EMPIRICAL:
        const evidenceText = (options.evidence || []).join('. ');
        return `Based on evidence: ${evidenceText}. Therefore, ${options.claim || 'claim'}.`;

      default:
        return 'Argument text';
    }
  }
}