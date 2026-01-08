/**
 * ARCHITECTURE: Application layer command for rebuttals
 * Pattern: Command with relationship data
 * Rationale: Encapsulates rebuttal-specific requirements
 */

import { AgentId } from '../../core/value-objects/AgentId';
import { ArgumentId, ArgumentType, ArgumentContent, RebuttalType } from '../../simulations/debate';

export interface SubmitRebuttalCommand {
  readonly agentId: AgentId;
  readonly targetArgumentId: ArgumentId;
  readonly rebuttalType: RebuttalType;
  readonly type: ArgumentType;
  readonly content: ArgumentContent;
}