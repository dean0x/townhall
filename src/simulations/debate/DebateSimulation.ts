/**
 * ARCHITECTURE: Debate-specific domain entity implementing ISimulation
 * Pattern: Immutable entity with content-addressed ID and state transitions
 * Rationale: Single active debate constraint enforced at application layer
 */

import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';
import { SimulationId, SimulationIdGenerator } from '../../core/value-objects/SimulationId';
import { Timestamp } from '../../core/value-objects/Timestamp';
import { AgentId } from '../../core/value-objects/AgentId';
import { DebateStatus } from './value-objects/DebateStatus';
import { ArgumentId } from './value-objects/ArgumentId';
import { CloseVote } from './CloseVote';
import type { ICryptoService } from '../../core/services/ICryptoService';
import type { ISimulation } from '../../core/simulation/ISimulation';
import { SimulationType, SimulationTypeFactory } from '../../core/simulation/SimulationType';

/**
 * Configuration for debate simulations.
 */
export interface DebateSimulationConfig {
  /** Minimum arguments before voting can begin */
  readonly minArgumentsBeforeVoting: number;
  /** Maximum length for argument text */
  readonly maxArgumentLength: number;
  /** Whether unanimous vote is required to close */
  readonly requireUnanimousClose: boolean;
}

/**
 * Default configuration for debates.
 */
export const DEFAULT_DEBATE_CONFIG: DebateSimulationConfig = {
  minArgumentsBeforeVoting: 2,
  maxArgumentLength: 10000,
  requireUnanimousClose: true,
};

export interface CreateSimulationParams {
  readonly topic: string;
  readonly createdAt: Timestamp;
  readonly cryptoService: ICryptoService;
  readonly config?: Partial<DebateSimulationConfig>;
}

/**
 * DebateSimulation entity representing a structured debate.
 * Implements ISimulation for generic simulation handling.
 */
export class DebateSimulation implements ISimulation<DebateSimulationConfig, DebateStatus> {
  /**
   * Simulation type discriminator for ISimulation interface.
   */
  public readonly type: SimulationType = SimulationTypeFactory.DEBATE;

  /**
   * Configuration for this debate.
   */
  public readonly config: DebateSimulationConfig;

  private constructor(
    public readonly id: SimulationId,
    public readonly topic: string,
    public readonly createdAt: Timestamp,
    public readonly status: DebateStatus,
    public readonly participantIds: readonly AgentId[],
    public readonly argumentIds: readonly ArgumentId[],
    public readonly votesToClose: readonly CloseVote[],
    config?: DebateSimulationConfig
  ) {
    this.config = config ?? DEFAULT_DEBATE_CONFIG;
    Object.freeze(this);
  }

  public static create(params: CreateSimulationParams): Result<DebateSimulation, ValidationError> {
    const topicValidation = this.validateTopic(params.topic);
    if (topicValidation.isErr()) {
      return err(topicValidation.error);
    }

    const idResult = SimulationIdGenerator.fromTopicAndTimestamp(
      params.topic,
      params.createdAt,
      params.cryptoService
    );

    if (idResult.isErr()) {
      return err(idResult.error);
    }

    const config: DebateSimulationConfig = {
      ...DEFAULT_DEBATE_CONFIG,
      ...params.config,
    };

    const simulation = new DebateSimulation(
      idResult.value,
      params.topic,
      params.createdAt,
      DebateStatus.ACTIVE,
      [],
      [],
      [],
      config
    );

    return ok(simulation);
  }

  /**
   * Reconstitute a simulation from storage with original ID
   * Used during deserialization to preserve content-addressed IDs
   * Returns error if data is corrupted (missing required fields)
   */
  public static reconstitute(
    id: SimulationId,
    topic: string,
    createdAt: Timestamp,
    status: DebateStatus,
    participantIds: readonly AgentId[],
    argumentIds: readonly ArgumentId[],
    votesToClose: readonly CloseVote[],
    config?: DebateSimulationConfig
  ): Result<DebateSimulation, ValidationError> {
    // Validate required fields to detect corruption
    if (!id || !topic || !createdAt || !status) {
      return err(new ValidationError('Data corruption: Missing required fields in simulation data'));
    }

    const simulation = new DebateSimulation(
      id,
      topic,
      createdAt,
      status,
      participantIds,
      argumentIds,
      votesToClose,
      config
    );

    return ok(simulation);
  }

  public addParticipant(agentId: AgentId): DebateSimulation {
    if (this.participantIds.includes(agentId)) {
      return this; // Already a participant
    }

    return new DebateSimulation(
      this.id,
      this.topic,
      this.createdAt,
      this.status,
      [...this.participantIds, agentId],
      this.argumentIds,
      this.votesToClose,
      this.config
    );
  }

  public addArgument(argumentId: ArgumentId, _isConcession: boolean = false): DebateSimulation {
    // ARCHITECTURE: Validation moved to application layer (handlers)
    // Rationale: Domain entities should be pure data transformations without business logic validation
    // The handlers will ensure:
    // - Regular arguments only during ACTIVE status
    // - Concessions allowed during ACTIVE and VOTING status

    return new DebateSimulation(
      this.id,
      this.topic,
      this.createdAt,
      this.status,
      this.participantIds,
      [...this.argumentIds, argumentId],
      this.votesToClose,
      this.config
    );
  }

  public transitionTo(newStatus: DebateStatus): DebateSimulation {
    // For now, allow the transition and let the caller handle validation
    // This maintains backward compatibility while following the Result pattern
    return new DebateSimulation(
      this.id,
      this.topic,
      this.createdAt,
      newStatus,
      this.participantIds,
      this.argumentIds,
      this.votesToClose,
      this.config
    );
  }

  public recordCloseVote(agentId: AgentId, vote: boolean, reason: string | undefined, timestamp: Timestamp): DebateSimulation {
    // For now, allow the vote and let the handler validate participants
    // This maintains the Entity as pure data without business rule validation

    const newVote: CloseVote = {
      agentId,
      vote,
      ...(reason !== undefined && { reason }),
      timestamp,
    };

    return new DebateSimulation(
      this.id,
      this.topic,
      this.createdAt,
      this.status,
      this.participantIds,
      this.argumentIds,
      [...this.votesToClose, newVote],
      this.config
    );
  }

  public getVoteCount(): { yes: number; no: number; total: number } {
    const yes = this.votesToClose.filter(v => v.vote).length;
    const no = this.votesToClose.filter(v => !v.vote).length;
    return { yes, no, total: yes + no };
  }

  public hasConsensusToClose(): boolean {
    const { yes } = this.getVoteCount();
    return yes === this.participantIds.length && this.participantIds.length > 0;
  }

  public isParticipant(agentId: AgentId): boolean {
    return this.participantIds.includes(agentId);
  }

  public getArgumentCount(): number {
    return this.argumentIds.length;
  }

  public getParticipantCount(): number {
    return this.participantIds.length;
  }

  private static validateTopic(topic: string): Result<void, ValidationError> {
    if (topic.length === 0 || topic.length > 500) {
      return err(new ValidationError('Topic must be between 1 and 500 characters'));
    }
    return ok(undefined);
  }
}
