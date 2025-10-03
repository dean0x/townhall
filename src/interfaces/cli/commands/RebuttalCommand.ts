/**
 * ARCHITECTURE: Interface layer - Rebuttal command (refactored)
 * Pattern: Command adapter with Result-based error handling
 * Rationale: Separates CLI concerns from business logic with proper error propagation
 */

import { Command } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { SubmitRebuttalCommand } from '../../../application/commands/SubmitRebuttalCommand';
import { RebuttalType } from '../../../core/entities/Rebuttal';
import { ArgumentContent, ArgumentType } from '../../../core/entities/Argument';
import { AgentIdGenerator, AgentId } from '../../../core/value-objects/AgentId';
import { ArgumentId, ArgumentIdGenerator } from '../../../core/value-objects/ArgumentId';

interface RebuttalOptions {
  target: string;
  agent: string;
  type: string;
  argumentType: string;
  summary: string;
  premise?: string[];
  conclusion?: string;
  pattern?: string;
  probability?: string;
  hypothesis?: string;
  evidence?: string[];
  confidence?: string;
}

interface ValidatedRebuttalOptions {
  targetArgumentId: ArgumentId;
  agentId: AgentId;
  rebuttalType: RebuttalType;
  argumentType: ArgumentType;
  content: ArgumentContent;
  confidence: number;
}

export class RebuttalCommand extends BaseCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    context: CommandContext
  ) {
    super('rebuttal', 'Submit a rebuttal to an existing argument', context);
  }

  protected setupOptions(command: Command): void {
    command
      .requiredOption('--target <id>', 'Target argument ID (full hash or short hash)')
      .requiredOption('--agent <id>', 'Agent ID submitting the rebuttal')
      .requiredOption('--type <type>', 'Rebuttal type: logical, empirical, or methodological')
      .requiredOption('--argument-type <type>', 'Argument type: deductive, inductive, or empirical')
      .requiredOption('--summary <text>', 'Brief summary of the rebuttal')
      .option('--premise <premise...>', 'Premises supporting the rebuttal (multiple allowed)')
      .option('--conclusion <text>', 'Conclusion (for deductive arguments)')
      .option('--pattern <text>', 'Pattern observed (for inductive arguments)')
      .option('--probability <number>', 'Probability estimate 0-1 (for inductive arguments)')
      .option('--hypothesis <text>', 'Hypothesis (for empirical arguments)')
      .option('--evidence <evidence...>', 'Supporting evidence (for empirical arguments)')
      .option('--confidence <number>', 'Confidence level (0-100)', '75');
  }

  protected validateOptions(options: RebuttalOptions): Result<ValidatedRebuttalOptions, ValidationError> {
    // Validate rebuttal type
    const rebuttalTypeResult = this.validateRebuttalType(options.type);
    if (rebuttalTypeResult.isErr()) {
      return err(rebuttalTypeResult.error);
    }

    // Validate argument type
    const argumentTypeResult = this.validateArgumentType(options.argumentType);
    if (argumentTypeResult.isErr()) {
      return err(argumentTypeResult.error);
    }

    // Validate agent ID
    const agentIdResult = this.validateAgentId(options.agent);
    if (agentIdResult.isErr()) {
      return err(agentIdResult.error);
    }

    // Validate target argument ID
    const targetIdResult = this.validateTargetId(options.target);
    if (targetIdResult.isErr()) {
      return err(targetIdResult.error);
    }

    // Build argument content based on type
    const contentResult = this.buildArgumentContent(
      options,
      argumentTypeResult.value
    );
    if (contentResult.isErr()) {
      return err(contentResult.error);
    }

    // Validate confidence
    const confidence = parseFloat(options.confidence || '75');
    if (isNaN(confidence) || confidence < 0 || confidence > 100) {
      return err(new ValidationError(
        'Confidence must be a number between 0 and 100',
        'confidence'
      ));
    }

    return ok({
      targetArgumentId: targetIdResult.value,
      agentId: agentIdResult.value,
      rebuttalType: rebuttalTypeResult.value,
      argumentType: argumentTypeResult.value,
      content: contentResult.value,
      confidence,
    });
  }

  protected async execute(validatedOptions: ValidatedRebuttalOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Submitting rebuttal', {
      target: validatedOptions.targetArgumentId.value,
      agent: validatedOptions.agentId.value,
      type: validatedOptions.rebuttalType,
    });

    const command: SubmitRebuttalCommand = {
      agentId: validatedOptions.agentId,
      targetArgumentId: validatedOptions.targetArgumentId,
      rebuttalType: validatedOptions.rebuttalType,
      type: validatedOptions.argumentType,
      content: validatedOptions.content,
      confidence: validatedOptions.confidence,
    };

    const result = await this.commandBus.execute(command, 'SubmitRebuttalCommand');

    if (result.isErr()) {
      return err(result.error);
    }

    const rebuttal = result.value;
    this.displaySuccess('Rebuttal submitted', {
      'ID': `${rebuttal.argumentId.slice(0, 12)}... (short: ${rebuttal.shortHash})`,
      'Target': validatedOptions.targetArgumentId.slice(0, 12) + '...',
      'Type': validatedOptions.rebuttalType,
      'Confidence': `${validatedOptions.confidence}%`,
      'Timestamp': new Date(rebuttal.timestamp).toLocaleString(),
    });

    this.context.logger.info('Rebuttal submitted successfully', {
      rebuttalId: rebuttal.argumentId,
      targetId: validatedOptions.targetArgumentId,
    });

    return ok(undefined);
  }

  private validateRebuttalType(type: string): Result<RebuttalType, ValidationError> {
    const validTypes: RebuttalType[] = ['logical', 'empirical', 'methodological'];
    if (!validTypes.includes(type as RebuttalType)) {
      return err(new ValidationError(
        `Invalid rebuttal type. Must be one of: ${validTypes.join(', ')}`,
        'type'
      ));
    }
    return ok(type as RebuttalType);
  }

  private validateArgumentType(type: string): Result<ArgumentType, ValidationError> {
    const validTypes: ArgumentType[] = ['deductive', 'inductive', 'empirical'];
    if (!validTypes.includes(type as ArgumentType)) {
      return err(new ValidationError(
        `Invalid argument type. Must be one of: ${validTypes.join(', ')}`,
        'argumentType'
      ));
    }
    return ok(type as ArgumentType);
  }

  private validateAgentId(agentId: string): Result<AgentId, ValidationError> {
    try {
      return ok(AgentIdGenerator.fromString(agentId));
    } catch (error) {
      return err(new ValidationError(
        `Invalid agent ID format: ${agentId}`,
        'agent'
      ));
    }
  }

  private validateTargetId(targetId: string): Result<ArgumentId, ValidationError> {
    try {
      // Try as full hash first
      return ok(ArgumentIdGenerator.fromString(targetId));
    } catch {
      // TODO: Implement short hash resolution
      // For now, treat as string and let backend handle it
      return ok(targetId as ArgumentId);
    }
  }

  private buildArgumentContent(
    options: RebuttalOptions,
    argumentType: ArgumentType
  ): Result<ArgumentContent, ValidationError> {
    switch (argumentType) {
      case 'deductive':
        return this.buildDeductiveContent(options);
      case 'inductive':
        return this.buildInductiveContent(options);
      case 'empirical':
        return this.buildEmpiricalContent(options);
      default:
        return err(new ValidationError(
          `Unsupported argument type: ${argumentType}`,
          'argumentType'
        ));
    }
  }

  private buildDeductiveContent(options: RebuttalOptions): Result<ArgumentContent, ValidationError> {
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
      text: options.summary,
      structure: {
        premises: options.premise,
        conclusion: options.conclusion,
      },
    });
  }

  private buildInductiveContent(options: RebuttalOptions): Result<ArgumentContent, ValidationError> {
    if (!options.premise || options.premise.length < 2) {
      return err(new ValidationError(
        'Inductive arguments require at least 2 premises (observations)',
        'premise'
      ));
    }

    if (!options.pattern) {
      return err(new ValidationError(
        'Inductive arguments require a pattern',
        'pattern'
      ));
    }

    const confidence = parseFloat(options.probability || '0.75');
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      return err(new ValidationError(
        'Probability must be between 0 and 1',
        'probability'
      ));
    }

    return ok({
      text: options.summary,
      structure: {
        observations: options.premise,
        generalization: options.pattern,
        confidence,
      },
    });
  }

  private buildEmpiricalContent(options: RebuttalOptions): Result<ArgumentContent, ValidationError> {
    if (!options.hypothesis) {
      return err(new ValidationError(
        'Empirical arguments require a hypothesis',
        'hypothesis'
      ));
    }

    if (!options.evidence || options.evidence.length === 0) {
      return err(new ValidationError(
        'Empirical arguments require at least one evidence source',
        'evidence'
      ));
    }

    const evidence = options.evidence.map(source => ({
      source,
      relevance: 'Supporting evidence for empirical rebuttal',
    }));

    return ok({
      text: options.summary,
      structure: {
        claim: options.hypothesis,
        evidence,
        methodology: 'Direct observation',
      },
    });
  }
}