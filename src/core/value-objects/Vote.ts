/**
 * ARCHITECTURE: Core domain value object
 * Pattern: Immutable value object
 * Rationale: Encapsulates vote data with validation
 */

import { AgentId } from './AgentId';
import { TimestampGenerator } from './Timestamp';

export interface VoteCreateParams {
  readonly agentId: AgentId;
  readonly reason?: string;
}

export class Vote {
  public readonly agentId: AgentId;
  public readonly reason?: string;
  public readonly timestamp: string;

  private constructor(agentId: AgentId, timestamp: string, reason?: string) {
    this.agentId = agentId;
    this.timestamp = timestamp;
    this.reason = reason;
  }

  public static create(params: VoteCreateParams): Vote {
    return new Vote(
      params.agentId,
      TimestampGenerator.now(),
      params.reason
    );
  }

  public equals(other: Vote): boolean {
    return this.agentId === other.agentId &&
           this.timestamp === other.timestamp;
  }

  public toString(): string {
    return `Vote(${this.agentId} at ${this.timestamp})`;
  }
}