/**
 * Decision Simulation Module
 *
 * Self-contained simulation type for group decision-making.
 * Provides value objects, entities, services, and configuration for decision workflows.
 *
 * @example
 * ```typescript
 * import {
 *   DecisionStatus,
 *   ProposalId,
 *   ProposalIdGenerator,
 *   EvaluationId,
 *   ObjectionId,
 *   DecisionTokens,
 * } from './simulations/decision';
 * ```
 */

// Value Objects
export {
  DecisionStatus,
  DECISION_STATUSES,
  isValidDecisionStatus,
  parseDecisionStatus,
  canTransitionTo,
  getStatusDescription,
  isTerminalStatus,
  ProposalId,
  ProposalIdGenerator,
  EvaluationId,
  EvaluationIdGenerator,
  ObjectionId,
  ObjectionIdGenerator,
} from './value-objects';

// Dependency Injection Tokens
export { DecisionTokens } from './tokens';

// Entities (future phases)
// export { Proposal, Evaluation, Objection } from './entities';

// Services (future phases)
// export { ProposalValidator, ConsensusCalculator } from './services';

// Repositories (future phases)
// export type { IProposalRepository, IDecisionRepository } from './repositories';
