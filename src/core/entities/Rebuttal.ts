/**
 * ARCHITECTURE: Specialized argument entity for rebuttals
 * Pattern: Extends Argument with additional relationship data
 * Rationale: Maintains argument-to-argument relationships for debate structure
 */

import { Argument, CreateArgumentParams, ArgumentType, ArgumentContent } from './Argument';
import { ArgumentId, ArgumentIdGenerator } from '../value-objects/ArgumentId';
import { TimestampGenerator } from '../value-objects/Timestamp';

export type RebuttalType = 'logical' | 'empirical' | 'methodological';

export const VALID_REBUTTAL_TYPES: readonly RebuttalType[] = ['logical', 'empirical', 'methodological'] as const;

export interface CreateRebuttalParams extends CreateArgumentParams {
  readonly targetArgumentId: ArgumentId;
  readonly rebuttalType: RebuttalType;
}

export class Rebuttal extends Argument {
  public readonly targetArgumentId: ArgumentId;
  public readonly rebuttalType: RebuttalType;

  private constructor(
    id: ArgumentId,
    agentId: string,
    type: ArgumentType,
    content: ArgumentContent,
    timestamp: string,
    simulationId: string,
    metadata: any,
    targetArgumentId: ArgumentId,
    rebuttalType: RebuttalType
  ) {
    super(id, agentId, type, content, timestamp, simulationId, metadata);
    this.targetArgumentId = targetArgumentId;
    this.rebuttalType = rebuttalType;
    Object.freeze(this);
  }

  public static create(params: CreateRebuttalParams): Rebuttal {
    this.validateRebuttalType(params.rebuttalType);
    this.validateTargetArgument(params.targetArgumentId, params.agentId);

    // Generate content-addressed ID including rebuttal data
    const contentString = JSON.stringify({
      type: params.type,
      content: params.content,
      agentId: params.agentId,
      simulationId: params.simulationId,
      timestamp: params.timestamp || TimestampGenerator.now(),
      targetArgumentId: params.targetArgumentId,
      rebuttalType: params.rebuttalType,
    });

    const id = ArgumentIdGenerator.fromContent(contentString);

    const metadata = {
      hash: id,
      shortHash: ArgumentIdGenerator.getShortHash(id),
      sequenceNumber: params.sequenceNumber ?? 0,
    };

    return new Rebuttal(
      id,
      params.agentId,
      params.type,
      params.content,
      params.timestamp || TimestampGenerator.now(),
      params.simulationId,
      metadata,
      params.targetArgumentId,
      params.rebuttalType
    );
  }

  public isRebuttalTo(argumentId: ArgumentId): boolean {
    return this.targetArgumentId === argumentId;
  }

  private static validateRebuttalType(type: RebuttalType): void {
    if (!VALID_REBUTTAL_TYPES.includes(type)) {
      throw new Error(`Invalid rebuttal type: ${type}. Must be one of: ${VALID_REBUTTAL_TYPES.join(', ')}`);
    }
  }

  private static validateTargetArgument(targetArgumentId: ArgumentId, agentId: string): void {
    // Note: In a real implementation, we would check if the target argument exists
    // and belongs to the same simulation. This would require repository access,
    // which violates the "zero dependencies" rule for core entities.
    // This validation will be moved to the application layer.

    if (!targetArgumentId || targetArgumentId.length === 0) {
      throw new Error('Target argument ID is required for rebuttals');
    }
  }
}