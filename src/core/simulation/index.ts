/**
 * Core simulation interfaces and registry.
 *
 * This module provides the generic foundation for all simulation types.
 * Concrete implementations live in src/simulations/<type>/
 */

// Type identification
export { SimulationType, SimulationTypeName, SimulationTypeFactory } from './SimulationType';

// Core interfaces
export { ISimulation, SimulationSummary } from './ISimulation';
export { IAction, ActionId, ActionSummary, isAction } from './IAction';
export {
  ISimulationTypeConfig,
  SimulationCreateParams,
  SimulationTypeInfo,
} from './ISimulationConfig';

// Registry
export { SimulationTypeRegistry } from './SimulationTypeRegistry';
