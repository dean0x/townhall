/**
 * ARCHITECTURE: Application layer command for voting
 * Pattern: Command for consensus operations
 * Rationale: Encapsulates voting requirements
 */

import { AgentId } from '../../core/value-objects/AgentId';

export interface VoteToCloseCommand {
  readonly agentId: AgentId;
  readonly vote: boolean;
  readonly reason?: string;
}