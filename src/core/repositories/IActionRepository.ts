/**
 * ARCHITECTURE: Generic repository interface for all action types
 * Pattern: Interface in core, simulation-specific implementations in infrastructure
 * Rationale: Core depends on nothing - simulations implement this with their own action types
 *
 * Each simulation type (debate, decision, brainstorm) provides its own implementation
 * of this interface with simulation-specific action types (Argument, Proposal, Idea, etc.)
 */

import { Result } from '../../shared/result';
import { NotFoundError, StorageError } from '../../shared/errors';
import type { IAction, ActionId } from '../simulation/IAction';
import type { SimulationId } from '../value-objects/SimulationId';
import type { AgentId } from '../value-objects/AgentId';

/**
 * Generic repository interface for persisting and retrieving actions.
 *
 * @typeParam TAction - The specific action type (must implement IAction)
 * @typeParam TId - The specific action ID type (defaults to ActionId)
 *
 * @example
 * ```typescript
 * // Debate implements with Argument and ArgumentId
 * interface IArgumentRepository extends IActionRepository<Argument, ArgumentId> {
 *   // debate-specific methods like findReferencingArguments
 * }
 *
 * // Decision implements with Proposal and ProposalId
 * interface IProposalRepository extends IActionRepository<Proposal, ProposalId> {
 *   // decision-specific methods like findByCategory
 * }
 * ```
 */
export interface IActionRepository<
  TAction extends IAction<TId>,
  TId extends string = ActionId
> {
  /**
   * Save an action to storage.
   * Uses content-addressed storage (ID derived from content hash).
   */
  save(action: TAction): Promise<Result<TId, StorageError>>;

  /**
   * Find action by its ID (full or short hash).
   * @param id - Full content-addressed ID or short hash prefix
   * @returns The action if found, NotFoundError if not exists, StorageError if corrupted
   */
  findById(id: TId | string): Promise<Result<TAction, NotFoundError | StorageError>>;

  /**
   * Find all actions in a simulation.
   * @param simulationId - The simulation to query
   * @returns Array of actions (empty if none), StorageError on failure
   */
  findBySimulation(simulationId: SimulationId): Promise<Result<TAction[], StorageError>>;

  /**
   * Find all actions by an agent.
   * @param agentId - The agent who created the actions
   * @returns Array of actions (empty if none), StorageError on failure
   */
  findByAgent(agentId: AgentId): Promise<Result<TAction[], StorageError>>;

  /**
   * Check if an action exists.
   * @param id - The action ID to check
   * @returns true if exists, false otherwise, StorageError on I/O failure
   */
  exists(id: TId): Promise<Result<boolean, StorageError>>;

  /**
   * Expand short hash to full action ID.
   * @param shortHash - Short hash prefix (minimum 7 characters)
   * @returns Full ID if unique match found, NotFoundError if ambiguous or not found
   */
  expandShortHash(shortHash: string): Promise<Result<TId, NotFoundError>>;

  /**
   * Get all action IDs for a simulation (for indexing).
   * @param simulationId - The simulation to query
   * @returns Array of action IDs
   */
  getAllIds(simulationId: SimulationId): Promise<Result<TId[], StorageError>>;

  /**
   * Batch load multiple actions by ID.
   *
   * PERFORMANCE: Single operation to load multiple actions, avoiding N+1 patterns.
   *
   * @param ids - Array of action IDs to retrieve (duplicates are deduplicated internally)
   * @returns Map of found actions keyed by ID. Missing IDs are omitted from
   *          the map (not treated as errors for batch operations).
   * @throws StorageError if deserialization fails for any found action
   */
  findByIds(ids: TId[]): Promise<Result<Map<TId, TAction>, StorageError>>;
}
