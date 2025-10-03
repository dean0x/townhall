/**
 * ARCHITECTURE: Interface layer - Concede command (refactored)
 * Pattern: Command adapter with Result-based error handling
 * Rationale: Separates CLI concerns from business logic with proper error propagation
 */

import { Command } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { IArgumentRepository } from '../../../core/repositories/IArgumentRepository';
import { SubmitConcessionCommand } from '../../../application/commands/SubmitConcessionCommand';
import { AgentIdGenerator, AgentId } from '../../../core/value-objects/AgentId';
import { ArgumentId, ArgumentIdGenerator } from '../../../core/value-objects/ArgumentId';

interface ConcedeOptions {
  target: string;
  agent: string;
  reason: string;
  acknowledgement?: string;
}

interface ValidatedConcedeOptions {
  targetArgumentId: ArgumentId;
  agentId: AgentId;
  concessionType: 'full' | 'partial' | 'conditional';
  conditions?: string;
  explanation?: string;
}

export class ConcedeCommand extends BaseCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    private readonly argumentRepository: IArgumentRepository,
    context: CommandContext
  ) {
    super('concede', 'Concede a point to another argument', context);
  }

  protected setupOptions(command: Command): void {
    command
      .requiredOption('--target <id>', 'Target argument ID to concede to (full hash or short hash)')
      .requiredOption('--agent <id>', 'Agent ID submitting the concession')
      .requiredOption('--reason <text>', 'Reason for conceding: convinced, evidence, or logic-superior')
      .option('--acknowledgement <text>', 'Optional acknowledgement message');
  }

  protected async validateOptions(options: ConcedeOptions): Promise<Result<ValidatedConcedeOptions, ValidationError>> {
    // Validate agent ID
    const agentIdResult = this.validateAgentId(options.agent);
    if (agentIdResult.isErr()) {
      return err(agentIdResult.error);
    }

    // Validate target argument ID (async - may need to expand short hash)
    const targetIdResult = await this.validateTargetId(options.target);
    if (targetIdResult.isErr()) {
      return err(targetIdResult.error);
    }

    // Validate and map concession reason
    const concessionTypeResult = this.validateAndMapReason(options.reason);
    if (concessionTypeResult.isErr()) {
      return err(concessionTypeResult.error);
    }

    // Determine conditions based on concession type
    let conditions: string | undefined;
    if (concessionTypeResult.value === 'conditional') {
      conditions = options.acknowledgement || 'I concede this point under current conditions';
    }

    return ok({
      targetArgumentId: targetIdResult.value,
      agentId: agentIdResult.value,
      concessionType: concessionTypeResult.value,
      conditions,
      explanation: options.acknowledgement,
    });
  }

  protected async execute(validatedOptions: ValidatedConcedeOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Submitting concession', {
      target: validatedOptions.targetArgumentId,
      agent: validatedOptions.agentId,
      concessionType: validatedOptions.concessionType,
    });

    const command: SubmitConcessionCommand = {
      agentId: validatedOptions.agentId,
      targetArgumentId: validatedOptions.targetArgumentId,
      concessionType: validatedOptions.concessionType,
      conditions: validatedOptions.conditions,
      explanation: validatedOptions.explanation,
    };

    const result = await this.commandBus.execute(command, 'SubmitConcessionCommand');

    if (result.isErr()) {
      return err(result.error);
    }

    const concession = result.value;
    this.displaySuccess('Concession submitted', {
      'ID': `${concession.concessionId.slice(0, 12)}...`,
      'Target': `${concession.targetId.slice(0, 12)}...`,
      'Reason': concession.reason,
      'Created': new Date(concession.createdAt).toLocaleString(),
    });

    this.context.logger.info('Concession submitted successfully', {
      concessionId: concession.concessionId,
      targetId: concession.targetId,
      reason: concession.reason,
    });

    return ok(undefined);
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

  private async validateTargetId(targetId: string): Promise<Result<ArgumentId, ValidationError>> {
    try {
      // Try as full UUID/hash first
      return ok(ArgumentIdGenerator.fromString(targetId));
    } catch {
      // Try short hash resolution via repository
      const expandResult = await this.argumentRepository.expandShortHash(targetId);
      if (expandResult.isErr()) {
        return err(new ValidationError(`Invalid argument ID: ${targetId}. Must be a valid UUID or unambiguous short hash.`));
      }
      return ok(expandResult.value);
    }
  }

  private validateAndMapReason(reason: string): Result<'full' | 'partial' | 'conditional', ValidationError> {
    const validReasons = ['convinced', 'evidence', 'logic-superior'];

    if (!validReasons.includes(reason)) {
      return err(new ValidationError(
        `Invalid reason. Must be one of: ${validReasons.join(', ')}`,
        'reason'
      ));
    }

    // Map user-friendly reasons to concession types
    const mapping: Record<string, 'full' | 'partial' | 'conditional'> = {
      'convinced': 'full',
      'evidence': 'partial',
      'logic-superior': 'conditional',
    };

    return ok(mapping[reason]);
  }
}