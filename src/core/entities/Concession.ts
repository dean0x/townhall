/**
 * ARCHITECTURE: Specialized argument entity for concessions
 * Pattern: Extends Argument with acknowledgment relationship data
 * Rationale: Tracks when agents accept or partially accept other arguments
 */

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

  public static create(params: CreateConcessionParams): Concession {
    this.validateConcessionType(params.concessionType);
    this.validateConditionalRequirements(params.concessionType, params.conditions);
    this.validateTargetArgument(params.targetArgumentId);

    const argument = Argument.create(params);

    return new Concession(
      argument,
      params.targetArgumentId,
      params.concessionType,
      params.conditions,
      params.explanation
    );
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

  private static validateConcessionType(type: ConcessionType): void {
    if (!VALID_CONCESSION_TYPES.includes(type)) {
      throw new Error(`Invalid concession type: ${type}. Must be one of: ${VALID_CONCESSION_TYPES.join(', ')}`);
    }
  }

  private static validateConditionalRequirements(type: ConcessionType, conditions?: string): void {
    if (type === 'conditional' && (!conditions || conditions.trim().length === 0)) {
      throw new Error('Conditional concessions must specify conditions');
    }
  }

  private static validateTargetArgument(targetArgumentId: ArgumentId): void {
    // Note: In a real implementation, we would check if the target argument exists
    // and belongs to the same simulation. This would require repository access,
    // which violates the "zero dependencies" rule for core entities.
    // This validation will be moved to the application layer.

    if (!targetArgumentId || targetArgumentId.length === 0) {
      throw new Error('Target argument ID is required for concessions');
    }
  }
}