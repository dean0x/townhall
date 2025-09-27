/**
 * ARCHITECTURE: Application layer command for concessions
 * Pattern: Command with acknowledgment data
 * Rationale: Encapsulates concession-specific requirements
 */

import { AgentId } from '../../core/value-objects/AgentId';
import { ArgumentId } from '../../core/value-objects/ArgumentId';
import { ConcessionType } from '../../core/entities/Concession';

export interface SubmitConcessionCommand {
  readonly agentId: AgentId;
  readonly targetArgumentId: ArgumentId;
  readonly concessionType: ConcessionType;
  readonly conditions?: string;
  readonly explanation?: string;
}