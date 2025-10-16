/**
 * ARCHITECTURE: Specialized argument entity for rebuttals
 * Pattern: Extends Argument with additional relationship data
 * Rationale: Maintains argument-to-argument relationships for debate structure
 */

import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';
import { Argument, CreateArgumentParams, ArgumentType, ArgumentContent, ArgumentMetadata } from './Argument';
import { ArgumentId, ArgumentIdGenerator } from '../value-objects/ArgumentId';
import { AgentId } from '../value-objects/AgentId';
import { SimulationId } from '../value-objects/SimulationId';
import { Timestamp } from '../value-objects/Timestamp';
import { ICryptoService } from '../services/ICryptoService';

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
    agentId: AgentId,
    type: ArgumentType,
    content: ArgumentContent,
    timestamp: Timestamp,
    simulationId: SimulationId,
    metadata: ArgumentMetadata,
    targetArgumentId: ArgumentId,
    rebuttalType: RebuttalType
  ) {
    super(id, agentId, type, content, timestamp, simulationId, metadata);
    this.targetArgumentId = targetArgumentId;
    this.rebuttalType = rebuttalType;
  }

  public static create(params: CreateRebuttalParams, cryptoService: ICryptoService): Result<Rebuttal, ValidationError> {
    const rebuttalTypeValidation = this.validateRebuttalType(params.rebuttalType);
    if (rebuttalTypeValidation.isErr()) {
      return err(rebuttalTypeValidation.error);
    }

    const targetArgumentValidation = this.validateTargetArgument(params.targetArgumentId, params.agentId);
    if (targetArgumentValidation.isErr()) {
      return err(targetArgumentValidation.error);
    }

    // Generate content-addressed ID including rebuttal data using injected crypto service
    const contentString = JSON.stringify({
      type: params.type,
      content: params.content,
      agentId: params.agentId,
      simulationId: params.simulationId,
      timestamp: params.timestamp,
      targetArgumentId: params.targetArgumentId,
      rebuttalType: params.rebuttalType,
    });

    const id = ArgumentIdGenerator.fromContent(contentString, cryptoService);

    const metadata = {
      hash: id,
      shortHash: ArgumentIdGenerator.getShortHash(id),
      sequenceNumber: params.sequenceNumber ?? 0,
    };

    const rebuttal = new Rebuttal(
      id,
      params.agentId,
      params.type,
      params.content,
      params.timestamp,
      params.simulationId,
      metadata,
      params.targetArgumentId,
      params.rebuttalType
    );

    Object.freeze(rebuttal);
    return ok(rebuttal);
  }

  public isRebuttalTo(argumentId: ArgumentId): boolean {
    return this.targetArgumentId === argumentId;
  }

  private static validateRebuttalType(type: RebuttalType): Result<void, ValidationError> {
    if (!VALID_REBUTTAL_TYPES.includes(type)) {
      return err(new ValidationError(`Invalid rebuttal type: ${type}. Must be one of: ${VALID_REBUTTAL_TYPES.join(', ')}`));
    }
    return ok(undefined);
  }

  private static validateTargetArgument(targetArgumentId: ArgumentId, agentId: string): Result<void, ValidationError> {
    // Note: In a real implementation, we would check if the target argument exists
    // and belongs to the same simulation. This would require repository access,
    // which violates the "zero dependencies" rule for core entities.
    // This validation will be moved to the application layer.

    if (!targetArgumentId || targetArgumentId.length === 0) {
      return err(new ValidationError('Target argument ID is required for rebuttals'));
    }
    return ok(undefined);
  }
}