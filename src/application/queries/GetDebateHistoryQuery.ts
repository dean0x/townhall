/**
 * ARCHITECTURE: Application layer query
 * Pattern: Query represents information request
 * Rationale: Separates read operations from write operations
 */

import { SimulationId } from '../../core/value-objects/SimulationId';
import { AgentId } from '../../core/value-objects/AgentId';
import { ArgumentType } from '../../core/value-objects/ArgumentType';

export interface GetDebateHistoryQuery {
  readonly simulationId?: SimulationId; // Optional - defaults to active
  readonly agentFilter?: AgentId;
  readonly typeFilter?: ArgumentType;
  readonly limit?: number;
  readonly includeRelationships?: boolean;
}