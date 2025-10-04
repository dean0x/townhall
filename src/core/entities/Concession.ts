/**
 * ARCHITECTURE: Specialized argument entity for concessions
 * Pattern: Extends Argument with acknowledgment relationship data
 * Rationale: Tracks when agents accept or partially accept other arguments
 */

import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';
import { Argument, CreateArgumentParams } from './Argument';
import { ArgumentId } from '../value-objects/ArgumentId';

export type ConcessionType = 'full' | 'partial' | 'conditional';

export const VALID_CONCESSION_TYPES: readonly ConcessionType[] = ['full', 'partial', 'conditional'] as const;

export interface CreateConcessionParams extends CreateArgumentParams {
  readonly targetArgumentId: ArgumentId;
  readonly concessionType: ConcessionType;
  readonly conditions?: string;
  readonly explanation?: string;
}

export class Concession extends Argument {
  private constructor(
    argument: Argument,
    public readonly targetArgumentId: ArgumentId,
    public readonly concessionType: ConcessionType,
    public readonly conditions?: string,
    public readonly explanation?: string
  ) {
    super(
      argument.id,
      argument.agentId,
      argument.type,
      argument.content,
      argument.timestamp,
      argument.simulationId,
      argument.metadata
    );
    Object.freeze(this);
  }

  public static create(params: CreateConcessionParams): Result<Concession, ValidationError> {
    const concessionTypeValidation = this.validateConcessionType(params.concessionType);
    if (concessionTypeValidation.isErr()) {
      return err(concessionTypeValidation.error);
    }

    const conditionalValidation = this.validateConditionalRequirements(params.concessionType, params.conditions);
    if (conditionalValidation.isErr()) {
      return err(conditionalValidation.error);
    }

    const targetArgumentValidation = this.validateTargetArgument(params.targetArgumentId);
    if (targetArgumentValidation.isErr()) {
      return err(targetArgumentValidation.error);
    }

    const argumentResult = Argument.create(params);
    if (argumentResult.isErr()) {
      return err(argumentResult.error);
    }

    const concession = new Concession(
      argumentResult.value,
      params.targetArgumentId,
      params.concessionType,
      params.conditions,
      params.explanation
    );

    return ok(concession);
  }

  public isConcessionTo(argumentId: ArgumentId): boolean {
    return this.targetArgumentId === argumentId;
  }

  public isConditional(): boolean {
    return this.concessionType === 'conditional';
  }

  public isPartial(): boolean {
    return this.concessionType === 'partial';
  }

  public isFull(): boolean {
    return this.concessionType === 'full';
  }

  private static validateConcessionType(type: ConcessionType): Result<void, ValidationError> {
    if (!VALID_CONCESSION_TYPES.includes(type)) {
      return err(new ValidationError(`Invalid concession type: ${type}. Must be one of: ${VALID_CONCESSION_TYPES.join(', ')}`));
    }
    return ok(undefined);
  }

  private static validateConditionalRequirements(type: ConcessionType, conditions?: string): Result<void, ValidationError> {
    if (type === 'conditional' && (!conditions || conditions.trim().length === 0)) {
      return err(new ValidationError('Conditional concessions must specify conditions'));
    }
    return ok(undefined);
  }

  private static validateTargetArgument(targetArgumentId: ArgumentId): Result<void, ValidationError> {
    // Note: In a real implementation, we would check if the target argument exists
    // and belongs to the same simulation. This would require repository access,
    // which violates the "zero dependencies" rule for core entities.
    // This validation will be moved to the application layer.

    if (!targetArgumentId || targetArgumentId.length === 0) {
      return err(new ValidationError('Target argument ID is required for concessions'));
    }
    return ok(undefined);
  }
}