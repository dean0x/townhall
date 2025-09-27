/**
 * ARCHITECTURE: Application layer command for rebuttals
 * Pattern: Command with relationship data
 * Rationale: Encapsulates rebuttal-specific requirements
 */

import { AgentId } from '../../core/value-objects/AgentId';
import { ArgumentId } from '../../core/value-objects/ArgumentId';
import { ArgumentContent } from '../../core/entities/Argument';
import { RebuttalType } from '../../core/entities/Rebuttal';

export interface SubmitRebuttalCommand {
  readonly agentId: AgentId;
  readonly targetArgumentId: ArgumentId;
  readonly rebuttalType: RebuttalType;
  readonly content: ArgumentContent;
}