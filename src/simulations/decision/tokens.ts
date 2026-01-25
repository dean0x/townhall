/**
 * ARCHITECTURE: Decision-specific dependency injection tokens
 * Pattern: Simulation-specific tokens separated from shared framework tokens
 * Rationale: Maintains clean layer boundaries - shared/ should not import from simulations/
 */

import { createToken } from '../../shared/injection';

// Note: Repository and service interfaces will be added in future phases
// For now, we define the token structure with placeholder types

/**
 * Placeholder interface for future IProposalRepository
 * TODO: Replace with actual import when repositories/IProposalRepository.ts is created
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface IProposalRepository {
  // TEMPORARY: Placeholder - will be replaced with actual interface in future phase
}

/**
 * Placeholder interface for future IDecisionRepository
 * TODO: Replace with actual import when repositories/IDecisionRepository.ts is created
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface IDecisionRepository {
  // TEMPORARY: Placeholder - will be replaced with actual interface in future phase
}

/**
 * Placeholder interface for future ProposalValidator
 * TODO: Replace with actual import when services/ProposalValidator.ts is created
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ProposalValidator {
  // TEMPORARY: Placeholder - will be replaced with actual interface in future phase
}

/**
 * Placeholder interface for future ConsensusCalculator
 * TODO: Replace with actual import when services/ConsensusCalculator.ts is created
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ConsensusCalculator {
  // TEMPORARY: Placeholder - will be replaced with actual interface in future phase
}

/**
 * Typed injection tokens for decision simulation.
 * These are separate from shared/tokens.ts to maintain layer boundaries.
 */
export const DecisionTokens = {
  // Repositories
  ProposalRepository: createToken<IProposalRepository>('DecisionProposalRepository'),
  SimulationRepository: createToken<IDecisionRepository>('DecisionSimulationRepository'),

  // Services
  ProposalValidator: createToken<ProposalValidator>('DecisionProposalValidator'),
  ConsensusCalculator: createToken<ConsensusCalculator>('DecisionConsensusCalculator'),
} as const;
