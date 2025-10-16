/**
 * ARCHITECTURE: Application layer command
 * Pattern: Command represents user intent to switch active simulation
 * Rationale: Decouples checkout action from business logic
 */

import { SimulationId } from '../../core/value-objects/SimulationId';

export interface CheckoutSimulationCommand {
  readonly simulationId: SimulationId;
}
