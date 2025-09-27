/**
 * ARCHITECTURE: Core domain entity for debate simulations
 * Pattern: Immutable entity with content-addressed ID and state transitions
 * Rationale: Single active debate constraint enforced at application layer
 */

import { SimulationId, SimulationIdGenerator } from '../value-objects/SimulationId';
import { Timestamp } from '../value-objects/Timestamp';
import { DebateStatus, canTransitionTo } from '../value-objects/DebateStatus';
import { AgentId } from '../value-objects/AgentId';
import { ArgumentId } from '../value-objects/ArgumentId';

export interface CloseVote {
  readonly agentId: AgentId;
  readonly vote: boolean;
  readonly reason?: string;
  readonly timestamp: Timestamp;
}

export interface CreateSimulationParams {
  readonly topic: string;
  readonly createdAt: Timestamp;
}

export class DebateSimulation {
  private constructor(
    public readonly id: SimulationId,
    public readonly topic: string,
    public readonly createdAt: Timestamp,
    public readonly status: DebateStatus,
    public readonly participantIds: readonly AgentId[],
    public readonly argumentIds: readonly ArgumentId[],
    public readonly votesToClose: readonly CloseVote[]
  ) {
    Object.freeze(this);
  }

  public static create(params: CreateSimulationParams): DebateSimulation {
    this.validateTopic(params.topic);

    const id = SimulationIdGenerator.fromTopicAndTimestamp(params.topic, params.createdAt);

    return new DebateSimulation(
      id,
      params.topic,
      params.createdAt,
      DebateStatus.ACTIVE,
      [],
      [],
      []
    );
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
      this.votesToClose
    );
  }

  public addArgument(argumentId: ArgumentId): DebateSimulation {
    if (this.status !== DebateStatus.ACTIVE) {
      throw new Error('Cannot add arguments to inactive debate');
    }

    return new DebateSimulation(
      this.id,
      this.topic,
      this.createdAt,
      this.status,
      this.participantIds,
      [...this.argumentIds, argumentId],
      this.votesToClose
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
      this.votesToClose
    );
  }

  public recordCloseVote(agentId: AgentId, vote: boolean, reason?: string): DebateSimulation {
    // For now, allow the vote and let the handler validate participants
    // This maintains the Entity as pure data without business rule validation

    const newVote: CloseVote = {
      agentId,
      vote,
      reason,
      timestamp: new Date().toISOString() as Timestamp,
    };

    return new DebateSimulation(
      this.id,
      this.topic,
      this.createdAt,
      this.status,
      this.participantIds,
      this.argumentIds,
      [...this.votesToClose, newVote]
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

  private static validateTopic(topic: string): void {
    if (topic.length === 0 || topic.length > 500) {
      throw new Error('Topic must be between 1 and 500 characters');
    }
  }
}