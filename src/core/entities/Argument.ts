/**
 * ARCHITECTURE: Core domain entity with zero dependencies
 * Pattern: Immutable entity with factory method
 * Rationale: Content-addressed arguments ensure data integrity
 */

import { ArgumentId, ArgumentIdGenerator } from '../value-objects/ArgumentId';
import { AgentId } from '../value-objects/AgentId';
import { SimulationId } from '../value-objects/SimulationId';
import { Timestamp } from '../value-objects/Timestamp';
import { ArgumentType } from '../value-objects/ArgumentType';

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

  public static create(params: CreateArgumentParams): Argument {
    // Validate argument structure based on type
    this.validateStructure(params.type, params.content.structure);

    // Generate content-addressed ID
    const contentString = JSON.stringify({
      type: params.type,
      content: params.content,
      agentId: params.agentId,
      simulationId: params.simulationId,
      timestamp: params.timestamp,
    });

    const id = ArgumentIdGenerator.fromContent(contentString);

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
    return argument;
  }

  private static validateStructure(type: ArgumentType, structure: ArgumentStructure): void {
    switch (type) {
      case ArgumentType.DEDUCTIVE:
        this.validateDeductiveStructure(structure as DeductiveStructure);
        break;
      case ArgumentType.INDUCTIVE:
        this.validateInductiveStructure(structure as InductiveStructure);
        break;
      case ArgumentType.EMPIRICAL:
        this.validateEmpiricalStructure(structure as EmpiricalStructure);
        break;
    }
  }

  private static validateDeductiveStructure(structure: DeductiveStructure): void {
    if (!structure.premises || structure.premises.length < 2) {
      throw new Error('Deductive arguments require at least 2 premises');
    }
    if (!structure.conclusion || structure.conclusion.trim().length === 0) {
      throw new Error('Deductive arguments require a conclusion');
    }
  }

  private static validateInductiveStructure(structure: InductiveStructure): void {
    if (!structure.observations || structure.observations.length < 2) {
      throw new Error('Inductive arguments require at least 2 observations');
    }
    if (!structure.generalization || structure.generalization.trim().length === 0) {
      throw new Error('Inductive arguments require a generalization');
    }
    if (structure.confidence !== undefined && (structure.confidence < 0 || structure.confidence > 1)) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  private static validateEmpiricalStructure(structure: EmpiricalStructure): void {
    if (!structure.evidence || structure.evidence.length === 0) {
      throw new Error('Empirical arguments require at least one piece of evidence');
    }
    if (!structure.claim || structure.claim.trim().length === 0) {
      throw new Error('Empirical arguments require a claim');
    }

    structure.evidence.forEach((evidence, index) => {
      if (!evidence.source || evidence.source.trim().length === 0) {
        throw new Error(`Evidence item ${index + 1} must have a source`);
      }
      if (!evidence.relevance || evidence.relevance.trim().length === 0) {
        throw new Error(`Evidence item ${index + 1} must specify relevance`);
      }
    });
  }
}