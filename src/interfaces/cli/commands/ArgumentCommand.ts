/**
 * ARCHITECTURE: Interface layer - Argument command (refactored)
 * Pattern: Complex command adapter with Result-based error handling
 * Rationale: Handles different argument types with proper error propagation
 */

import { Command, Option } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { CreateArgumentCommand } from '../../../application/commands/CreateArgumentCommand';
import { ArgumentType } from '../../../core/value-objects/ArgumentType';
import { AgentIdGenerator } from '../../../core/value-objects/AgentId';
import { ArgumentContent } from '../../../core/entities/Argument';

interface ArgumentOptions {
  agent: string;
  type: ArgumentType;
  premise?: string[];
  conclusion?: string;
  observation?: string[];
  generalization?: string;
  confidence?: number;
  evidence?: string[];
  relevance?: string[];
  citation?: string[];
  claim?: string;
  methodology?: string;
}

interface ValidatedArgumentOptions {
  agentId: string;
  type: ArgumentType;
  content: ArgumentContent;
}

export class ArgumentCommand extends BaseCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    context: CommandContext
  ) {
    super('argument', 'Submit a structured argument to the debate', context);
  }

  protected setupOptions(command: Command): void {
    command
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
      .option('--relevance <relevance...>', 'Relevance description for each evidence (required for empirical)')
      .option('--citation <citation...>', 'Citations for evidence (optional)')
      .option('--claim <claim>', 'Claim for empirical arguments')
      .option('--methodology <methodology>', 'Research methodology (optional)');
  }

  protected validateOptions(options: ArgumentOptions): Result<ValidatedArgumentOptions, ValidationError> {
    // Validate agent ID format
    const agentIdResult = this.validateAgentId(options.agent);
    if (agentIdResult.isErr()) {
      return err(agentIdResult.error);
    }

    // Build and validate argument content based on type
    const contentResult = this.buildArgumentContent(options);
    if (contentResult.isErr()) {
      return err(contentResult.error);
    }

    return ok({
      agentId: agentIdResult.value,
      type: options.type,
      content: contentResult.value,
    });
  }

  protected async execute(validatedOptions: ValidatedArgumentOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Creating argument', {
      agentId: validatedOptions.agentId,
      type: validatedOptions.type,
    });

    const command: CreateArgumentCommand = {
      agentId: AgentIdGenerator.fromString(validatedOptions.agentId),
      type: validatedOptions.type,
      content: validatedOptions.content,
    };

    const result = await this.commandBus.execute(command, 'CreateArgumentCommand');

    if (result.isErr()) {
      return err(result.error);
    }

    const argument = result.value;
    this.displaySuccess('Argument created', {
      'ID': `${argument.argumentId.slice(0, 12)}... (short: ${argument.shortHash})`,
      'Agent': validatedOptions.agentId,
      'Type': validatedOptions.type,
      'Sequence': argument.sequenceNumber,
      'Timestamp': new Date(argument.timestamp).toLocaleString(),
    });

    this.context.logger.info('Argument created successfully', {
      argumentId: argument.argumentId,
      sequenceNumber: argument.sequenceNumber,
    });

    return ok(undefined);
  }

  private validateAgentId(agentId: string): Result<string, ValidationError> {
    try {
      // Validate format
      AgentIdGenerator.fromString(agentId);
      return ok(agentId);
    } catch (error) {
      return err(new ValidationError(
        `Invalid agent ID format: ${agentId}. Must be a valid UUID`,
        'agent'
      ));
    }
  }

  private buildArgumentContent(options: ArgumentOptions): Result<ArgumentContent, ValidationError> {
    switch (options.type) {
      case 'deductive':
        return this.buildDeductiveContent(options);
      case 'inductive':
        return this.buildInductiveContent(options);
      case 'empirical':
        return this.buildEmpiricalContent(options);
      default:
        return err(new ValidationError(
          `Unsupported argument type: ${options.type}`,
          'type'
        ));
    }
  }

  private buildDeductiveContent(options: ArgumentOptions): Result<ArgumentContent, ValidationError> {
    if (!options.premise || options.premise.length < 2) {
      return err(new ValidationError(
        'Deductive arguments require at least 2 premises',
        'premise'
      ));
    }

    if (!options.conclusion) {
      return err(new ValidationError(
        'Deductive arguments require a conclusion',
        'conclusion'
      ));
    }

    return ok({
      text: options.conclusion,
      structure: {
        premises: options.premise,
        conclusion: options.conclusion,
      },
    });
  }

  private buildInductiveContent(options: ArgumentOptions): Result<ArgumentContent, ValidationError> {
    if (!options.observation || options.observation.length < 2) {
      return err(new ValidationError(
        'Inductive arguments require at least 2 observations',
        'observation'
      ));
    }

    if (!options.generalization) {
      return err(new ValidationError(
        'Inductive arguments require a generalization',
        'generalization'
      ));
    }

    const confidence = options.confidence ?? 0.75;
    if (confidence < 0 || confidence > 1) {
      return err(new ValidationError(
        'Confidence must be between 0 and 1',
        'confidence'
      ));
    }

    return ok({
      text: options.generalization,
      structure: {
        observations: options.observation,
        generalization: options.generalization,
        confidence,
      },
    });
  }

  private buildEmpiricalContent(options: ArgumentOptions): Result<ArgumentContent, ValidationError> {
    if (!options.evidence || options.evidence.length === 0) {
      return err(new ValidationError(
        'Empirical arguments require at least one evidence source',
        'evidence'
      ));
    }

    if (!options.claim) {
      return err(new ValidationError(
        'Empirical arguments require a claim',
        'claim'
      ));
    }

    // Validate relevance is provided for each evidence
    if (!options.relevance || options.relevance.length !== options.evidence.length) {
      return err(new ValidationError(
        `Empirical arguments require --relevance for each evidence source (expected ${options.evidence.length}, got ${options.relevance?.length || 0})`,
        'relevance'
      ));
    }

    const evidence = options.evidence.map((source, index) => ({
      source,
      relevance: options.relevance![index],
      citation: options.citation?.[index],
    }));

    return ok({
      text: options.claim,
      structure: {
        claim: options.claim,
        evidence,
        methodology: options.methodology || 'Direct observation',
      },
    });
  }
}