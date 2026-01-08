/**
 * ARCHITECTURE: Debate-specific dependency injection tokens
 * Pattern: Simulation-specific tokens separated from shared framework tokens
 * Rationale: Maintains clean layer boundaries - shared/ should not import from simulations/
 */

import { createToken } from '../../shared/injection';

// Debate repository interfaces
import type { IArgumentRepository, IDebateRepository } from './repositories';

// Debate services
import type { ArgumentValidator } from './services/ArgumentValidator';
import type { RelationshipBuilder } from './services/RelationshipBuilder';
import type { VoteCalculator } from './services/VoteCalculator';

/**
 * Typed injection tokens for debate simulation.
 * These are separate from shared/tokens.ts to maintain layer boundaries.
 */
export const DebateTokens = {
  // Repositories
  ArgumentRepository: createToken<IArgumentRepository>('ArgumentRepository'),
  SimulationRepository: createToken<IDebateRepository>('SimulationRepository'),

  // Services
  ArgumentValidator: createToken<ArgumentValidator>('ArgumentValidator'),
  RelationshipBuilder: createToken<RelationshipBuilder>('RelationshipBuilder'),
  VoteCalculator: createToken<VoteCalculator>('VoteCalculator'),
} as const;

/**
 * Legacy TOKENS constant for backward compatibility.
 * Maps to the symbols from the typed tokens.
 *
 * @deprecated Use DebateTokens directly with resolve() instead
 */
export const DEBATE_TOKENS = {
  ArgumentRepository: DebateTokens.ArgumentRepository.symbol,
  SimulationRepository: DebateTokens.SimulationRepository.symbol,
  ArgumentValidator: DebateTokens.ArgumentValidator.symbol,
  RelationshipBuilder: DebateTokens.RelationshipBuilder.symbol,
  VoteCalculator: DebateTokens.VoteCalculator.symbol,
} as const;
