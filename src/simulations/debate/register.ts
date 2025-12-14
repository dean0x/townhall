/**
 * ARCHITECTURE: Debate simulation type registration
 * Pattern: Self-registration at module import time
 * Rationale: Ensures debate type is available in the registry
 *
 * IMPORTANT: This file should be imported during application startup
 * to register the debate simulation type with the registry.
 *
 * @example
 * ```typescript
 * // In application bootstrap:
 * import './simulations/debate/register';
 * ```
 */

import { SimulationTypeRegistry } from '../../core/simulation/SimulationTypeRegistry';
import { DebateTypeInfo } from './DebateConfig';

/**
 * Register the debate simulation type with the global registry.
 * This runs once when the module is first imported.
 */
export function registerDebateSimulationType(): void {
  if (!SimulationTypeRegistry.has(DebateTypeInfo.type)) {
    SimulationTypeRegistry.register(DebateTypeInfo);
  }
}

// Auto-register when this module is imported
registerDebateSimulationType();
