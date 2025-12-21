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

  /**
   * Add a participant to the debate.
   * Returns the same instance if agent is already a participant (idempotent).
   *
   * @param agentId - The agent to add as participant
   * @returns New DebateSimulation with the participant added
   */
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

  /**
   * Add an argument to the debate.
   * Note: Status validation is handled by the application layer handlers.
   *
   * @param argumentId - The argument ID to add
   * @param _isConcession - Whether this is a concession (used by handlers for status validation)
   * @returns New DebateSimulation with the argument added
   */
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

  /**
   * Transition the debate to a new status.
   * Note: Status transition validation is handled by the caller.
   *
   * @param newStatus - The new debate status
   * @returns New DebateSimulation with the updated status
   */
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

  /**
   * Record a vote to close the debate.
   * Note: Participant validation is handled by the application layer.
   *
   * @param agentId - The agent casting the vote
   * @param vote - True to vote for closing, false to vote against
   * @param reason - Optional reason for the vote
   * @param timestamp - When the vote was cast
   * @returns New DebateSimulation with the vote recorded
   */
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

  /**
   * Get the current vote counts for closing the debate.
   *
   * @returns Object with yes, no, and total vote counts
   */
  public getVoteCount(): { yes: number; no: number; total: number } {
    const yes = this.votesToClose.filter(v => v.vote).length;
    const no = this.votesToClose.filter(v => !v.vote).length;
    return { yes, no, total: yes + no };
  }

  /**
   * Check if there is unanimous consensus to close the debate.
   * Requires all participants to have voted yes.
   *
   * @returns True if all participants voted to close
   */
  public hasConsensusToClose(): boolean {
    const { yes } = this.getVoteCount();
    return yes === this.participantIds.length && this.participantIds.length > 0;
  }

  /**
   * Check if an agent is a participant in this debate.
   *
   * @param agentId - The agent to check
   * @returns True if the agent is a participant
   */
  public isParticipant(agentId: AgentId): boolean {
    return this.participantIds.includes(agentId);
  }

  /**
   * Get the number of arguments in this debate.
   *
   * @returns The count of argument IDs
   */
  public getArgumentCount(): number {
    return this.argumentIds.length;
  }

  /**
   * Get the number of participants in this debate.
   *
   * @returns The count of participant agent IDs
   */
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
