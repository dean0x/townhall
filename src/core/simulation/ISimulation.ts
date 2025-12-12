/**
 * ARCHITECTURE: Generic interface for all simulation types
 * Pattern: Interface with type parameters for config and status
 * Rationale: Enables type-safe polymorphism across simulation types
 *
 * Simulation types (debate, decision, brainstorm) implement this interface
 * with their own config and status types.
 */

import type { SimulationId } from '../value-objects/SimulationId';
import type { AgentId } from '../value-objects/AgentId';
import type { Timestamp } from '../value-objects/Timestamp';
import type { SimulationType } from './SimulationType';

/**
 * Base interface that all simulations must implement.
 *
 * @typeParam TConfig - Simulation-specific configuration type
 * @typeParam TStatus - Simulation-specific status enum/union type
 *
 * @example
 * ```typescript
 * // Debate simulation implements with specific types
 * class DebateSimulation implements ISimulation<DebateConfig, DebateStatus> {
 *   readonly type = SimulationTypeFactory.DEBATE;
 *   // ...
 * }
 * ```
 */
export interface ISimulation<
  TConfig = unknown,
  TStatus extends string = string
> {
  /** Unique content-addressed identifier */
  readonly id: SimulationId;

  /** Discriminator for simulation type (e.g., 'debate', 'decision') */
  readonly type: SimulationType;

  /** Human-readable topic or title */
  readonly topic: string;

  /** Current status (type-specific enum) */
  readonly status: TStatus;

  /** When the simulation was created */
  readonly createdAt: Timestamp;

  /** Agents participating in this simulation */
  readonly participantIds: readonly AgentId[];

  /** Type-specific configuration */
  readonly config: TConfig;
}

/**
 * Minimal simulation data for storage/transfer.
 * Used when full entity isn't needed.
 */
export interface SimulationSummary {
  readonly id: SimulationId;
  readonly type: SimulationType;
  readonly topic: string;
  readonly status: string;
  readonly createdAt: Timestamp;
  readonly participantCount: number;
}
