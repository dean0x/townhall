/**
 * ARCHITECTURE: Debate-specific repository interface for simulations
 * Pattern: Extends generic ISimulationRepository with debate-specific types
 * Rationale: Provides type-safe access to DebateSimulation entities
 *
 * This interface is a type alias for ISimulationRepository specialized
 * for DebateSimulation, DebateSimulationConfig, and DebateStatus.
 */

import type { ISimulationRepository } from '../../../core/repositories/ISimulationRepository';
import type { DebateSimulation, DebateSimulationConfig } from '../DebateSimulation';
import type { DebateStatus } from '../value-objects/DebateStatus';

/**
 * Debate-specific simulation repository.
 *
 * This is a specialized version of ISimulationRepository for debates.
 * No additional methods needed at this time - the generic interface
 * provides all required functionality.
 */
export type IDebateRepository = ISimulationRepository<
  DebateSimulation,
  DebateSimulationConfig,
  DebateStatus
>;
