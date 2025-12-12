/**
 * ARCHITECTURE: Central registry for simulation type registration
 * Pattern: Service Locator with static registration
 * Rationale: Single point where all simulation types are known
 *
 * IMPORTANT: This is the ONLY place in core/ that imports from simulations/
 * All other core/ code works with interfaces, not concrete types.
 */

import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';
import type { SimulationType } from './SimulationType';
import type { SimulationTypeInfo } from './ISimulationConfig';

/**
 * Registry for simulation types.
 *
 * Simulation types register themselves at startup, providing metadata
 * and factory functions. The registry enables:
 * - Looking up simulation type info by type identifier
 * - Listing all available simulation types
 * - Validating simulation type identifiers
 *
 * @example
 * ```typescript
 * // Registration (done once at startup in simulations/)
 * SimulationTypeRegistry.register({
 *   type: SimulationTypeFactory.DEBATE,
 *   name: 'Debate',
 *   description: 'Structured argumentation',
 *   actionTypes: ['argument', 'rebuttal', 'concession'],
 * });
 *
 * // Usage
 * const info = SimulationTypeRegistry.get('debate');
 * const allTypes = SimulationTypeRegistry.getAll();
 * ```
 */
export class SimulationTypeRegistry {
  private static readonly types = new Map<string, SimulationTypeInfo>();

  /**
   * Register a simulation type.
   * Called during application startup by each simulation module.
   *
   * @throws Error if type is already registered (prevents double registration)
   */
  static register(config: SimulationTypeInfo): void {
    const typeKey = String(config.type);
    if (this.types.has(typeKey)) {
      throw new Error(`Simulation type '${typeKey}' is already registered`);
    }
    this.types.set(typeKey, config);
  }

  /**
   * Get simulation type info by type identifier.
   *
   * @returns Result with type info or error if not found
   */
  static get(type: SimulationType | string): Result<SimulationTypeInfo, ValidationError> {
    const typeKey = String(type);
    const info = this.types.get(typeKey);
    if (!info) {
      return err(new ValidationError(`Unknown simulation type: '${typeKey}'`));
    }
    return ok(info);
  }

  /**
   * Check if a simulation type is registered.
   */
  static has(type: SimulationType | string): boolean {
    return this.types.has(String(type));
  }

  /**
   * Get all registered simulation types.
   */
  static getAll(): readonly SimulationTypeInfo[] {
    return Array.from(this.types.values());
  }

  /**
   * Get all registered type identifiers.
   */
  static getTypeNames(): readonly string[] {
    return Array.from(this.types.keys());
  }

  /**
   * Clear all registrations.
   * Primarily for testing - allows resetting registry state.
   */
  static clear(): void {
    this.types.clear();
  }

  /**
   * Get count of registered types.
   */
  static get count(): number {
    return this.types.size;
  }
}
