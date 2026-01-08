/**
 * ARCHITECTURE: Application layer command for argument creation
 * Pattern: Command encapsulates all data needed for operation
 * Rationale: Type-safe operation parameters
 */

import { AgentId } from '../../core/value-objects/AgentId';
import { ArgumentType, ArgumentContent } from '../../simulations/debate';
import { CitationId } from '../../core/value-objects/CitationId';

export interface CreateArgumentCommand {
  readonly agentId: AgentId;
  readonly type: ArgumentType;
  readonly content: ArgumentContent;
  readonly citationIds?: readonly CitationId[];  // Optional array of citation IDs
}