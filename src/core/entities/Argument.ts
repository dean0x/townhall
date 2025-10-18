/**
 * ARCHITECTURE: Core domain entity with zero dependencies
 * Pattern: Immutable entity with factory method
 * Rationale: Content-addressed arguments ensure data integrity
 */

import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';
import { ArgumentId, ArgumentIdGenerator } from '../value-objects/ArgumentId';
import { AgentId } from '../value-objects/AgentId';
import { SimulationId } from '../value-objects/SimulationId';
import { Timestamp } from '../value-objects/Timestamp';
import { ArgumentType } from '../value-objects/ArgumentType';
import { ICryptoService } from '../services/ICryptoService';

export interface DeductiveStructure {
  readonly premises: readonly string[];
  readonly conclusion: string;
  readonly form?: string;
}

export interface InductiveStructure {
  readonly observations: readonly string[];
  readonly generalization: string;
  readonly confidence?: number;
}

export interface Evidence {
  readonly source: string;
  readonly citation?: string;
  readonly relevance: string;
}

export interface EmpiricalStructure {
  readonly evidence: readonly Evidence[];
  readonly claim: string;
  readonly methodology?: string;
}

export type ArgumentStructure = DeductiveStructure | InductiveStructure | EmpiricalStructure;

export interface ArgumentContent {
  readonly text: string;
  readonly structure: ArgumentStructure;
}

export interface ArgumentMetadata {
  readonly hash: string;
  readonly shortHash: string;
  readonly sequenceNumber: number;
}

export interface CreateArgumentParams {
  readonly agentId: AgentId;
  readonly type: ArgumentType;
  readonly content: ArgumentContent;
  readonly simulationId: SimulationId;
  readonly timestamp: Timestamp;
  readonly sequenceNumber?: number;
}

export class Argument {
  private constructor(
    public readonly id: ArgumentId,
    public readonly agentId: AgentId,
    public readonly type: ArgumentType,
    public readonly content: ArgumentContent,
    public readonly timestamp: Timestamp,
    public readonly simulationId: SimulationId,
    public readonly metadata: ArgumentMetadata
  ) {
    // Note: Object.freeze(this) moved to static create methods for inheritance support
  }

  public static create(params: CreateArgumentParams, cryptoService: ICryptoService): Result<Argument, ValidationError> {
    // Validate argument structure based on type
    const validationResult = this.validateStructure(params.type, params.content.structure);
    if (validationResult.isErr()) {
      return err(validationResult.error);
    }

    // Generate content-addressed ID using injected crypto service
    const contentString = JSON.stringify({
      type: params.type,
      content: params.content,
      agentId: params.agentId,
      simulationId: params.simulationId,
      timestamp: params.timestamp,
    });

    const id = ArgumentIdGenerator.fromContent(contentString, cryptoService);

    const metadata: ArgumentMetadata = {
      hash: id,
      shortHash: ArgumentIdGenerator.getShortHash(id),
      sequenceNumber: params.sequenceNumber ?? 0,
    };

    const argument = new Argument(
      id,
      params.agentId,
      params.type,
      params.content,
      params.timestamp,
      params.simulationId,
      metadata
    );

    Object.freeze(argument);
    return ok(argument);
  }

  private static validateStructure(type: ArgumentType, structure: ArgumentStructure): Result<void, ValidationError> {
    switch (type) {
      case ArgumentType.DEDUCTIVE:
        return this.validateDeductiveStructure(structure as DeductiveStructure);
      case ArgumentType.INDUCTIVE:
        return this.validateInductiveStructure(structure as InductiveStructure);
      case ArgumentType.EMPIRICAL:
        return this.validateEmpiricalStructure(structure as EmpiricalStructure);
      default: {
        // Exhaustive check: will cause compile error if new ArgumentType is added
        const exhaustiveCheck: never = type;
        return err(new ValidationError(`Unknown argument type: ${exhaustiveCheck}`));
      }
    }
  }

  private static validateDeductiveStructure(structure: DeductiveStructure): Result<void, ValidationError> {
    if (!structure.premises || structure.premises.length < 2) {
      return err(new ValidationError('Deductive arguments require at least 2 premises'));
    }
    if (!structure.conclusion || structure.conclusion.trim().length === 0) {
      return err(new ValidationError('Deductive arguments require a conclusion'));
    }
    return ok(undefined);
  }

  private static validateInductiveStructure(structure: InductiveStructure): Result<void, ValidationError> {
    if (!structure.observations || structure.observations.length < 2) {
      return err(new ValidationError('Inductive arguments require at least 2 observations'));
    }
    if (!structure.generalization || structure.generalization.trim().length === 0) {
      return err(new ValidationError('Inductive arguments require a generalization'));
    }
    if (structure.confidence !== undefined && (structure.confidence < 0 || structure.confidence > 1)) {
      return err(new ValidationError('Confidence must be between 0 and 1'));
    }
    return ok(undefined);
  }

  private static validateEmpiricalStructure(structure: EmpiricalStructure): Result<void, ValidationError> {
    if (!structure.evidence || structure.evidence.length === 0) {
      return err(new ValidationError('Empirical arguments require at least one piece of evidence'));
    }
    if (!structure.claim || structure.claim.trim().length === 0) {
      return err(new ValidationError('Empirical arguments require a claim'));
    }

    for (let index = 0; index < structure.evidence.length; index++) {
      const evidence = structure.evidence[index]!;
      if (!evidence.source || evidence.source.trim().length === 0) {
        return err(new ValidationError(`Evidence item ${index + 1} must have a source`));
      }
      if (!evidence.relevance || evidence.relevance.trim().length === 0) {
        return err(new ValidationError(`Evidence item ${index + 1} must specify relevance`));
      }
    }

    return ok(undefined);
  }
}