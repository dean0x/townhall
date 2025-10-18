/**
 * ARCHITECTURE: Application layer command for argument creation
 * Pattern: Command encapsulates all data needed for operation
 * Rationale: Type-safe operation parameters
 */

import { AgentId } from '../../core/value-objects/AgentId';
import { ArgumentType } from '../../core/value-objects/ArgumentType';
import { ArgumentContent } from '../../core/entities/Argument';

export interface CreateArgumentCommand {
  readonly agentId: AgentId;
  readonly type: ArgumentType;
  readonly content: ArgumentContent;
}