/**
 * Debate Simulation Module
 *
 * Self-contained simulation type for structured argumentation.
 * Provides entities, services, and configuration for debate workflows.
 *
 * @example
 * ```typescript
 * import {
 *   DebateSimulation,
 *   Argument,
 *   Rebuttal,
 *   Concession,
 *   ArgumentValidator,
 *   DebateSimulationTypeConfig,
 * } from './simulations/debate';
 * ```
 */

// Entities
export {
  Argument,
  ARGUMENT_ACTION_TYPE,
  type DeductiveStructure,
  type InductiveStructure,
  type Evidence,
  type EmpiricalStructure,
  type ArgumentStructure,
  type ArgumentContent,
  type ArgumentMetadata,
  type CreateArgumentParams,
  Rebuttal,
  REBUTTAL_ACTION_TYPE,
  type RebuttalType,
  VALID_REBUTTAL_TYPES,
  type CreateRebuttalParams,
  Concession,
  CONCESSION_ACTION_TYPE,
  type ConcessionType,
  VALID_CONCESSION_TYPES,
  type CreateConcessionParams,
} from './entities';

// Value Objects
export {
  ArgumentId,
  ArgumentIdGenerator,
  ArgumentType,
  ARGUMENT_TYPES,
  isValidArgumentType,
  parseArgumentType,
  getArgumentTypeDescription,
  DebateStatus,
  DEBATE_STATUSES,
  isValidDebateStatus,
  parseDebateStatus,
  canTransitionTo,
  getStatusDescription,
} from './value-objects';

// Services
export {
  ArgumentValidator,
  RelationshipBuilder,
  VoteCalculator,
  type ArgumentRelationship,
  type RelationType,
  type RelationshipChain,
  type VoteStatus,
  type VotingRules,
} from './services';

// Repositories
export type { IArgumentRepository, IDebateRepository } from './repositories';

// Simulation
export {
  DebateSimulation,
  type DebateSimulationConfig,
  DEFAULT_DEBATE_CONFIG,
  type CreateSimulationParams,
} from './DebateSimulation';

// Voting
export { CloseVote, createCloseVote, isCloseVote } from './CloseVote';

// Phases
export { DebatePhase, isDebatePhase, getNextPhase, canSubmitArguments, canVote } from './DebatePhase';

// Configuration and Registration
export { DebateTypeInfo, DebateSimulationTypeConfig } from './DebateConfig';
export { registerDebateSimulationType } from './register';

// Dependency Injection Tokens
export { DebateTokens, DEBATE_TOKENS } from './tokens';
