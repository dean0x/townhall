/**
 * ARCHITECTURE: Application layer command handler
 * Pattern: Command handler with repository injection
 * Rationale: Switches active simulation context for multi-simulation workflows
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError, StorageError } from '../../shared/errors';
import { ICommandHandler } from './CommandBus';
import { CheckoutSimulationCommand } from '../commands/CheckoutSimulationCommand';
import { ISimulationRepository } from '../../core/repositories/ISimulationRepository';
import { TOKENS } from '../../shared/container';

export interface CheckoutSimulationResult {
  readonly simulationId: string;
  readonly topic: string;
  readonly status: string;
  readonly argumentCount: number;
}

@injectable()
export class CheckoutSimulationHandler implements ICommandHandler<CheckoutSimulationCommand, CheckoutSimulationResult> {
  constructor(
    @inject(TOKENS.SimulationRepository) private readonly simulationRepo: ISimulationRepository
  ) {}

  public async handle(command: CheckoutSimulationCommand): Promise<Result<CheckoutSimulationResult, NotFoundError | StorageError>> {
    // Switch to the specified simulation (overwrites HEAD)
    const switchResult = await this.simulationRepo.switchActive(command.simulationId);
    if (switchResult.isErr()) {
      return err(switchResult.error);
    }

    // Retrieve the simulation details to return
    const simulationResult = await this.simulationRepo.findById(command.simulationId);
    if (simulationResult.isErr()) {
      return err(simulationResult.error);
    }

    const simulation = simulationResult.value;

    return ok({
      simulationId: simulation.id,
      topic: simulation.topic,
      status: simulation.status,
      argumentCount: simulation.getArgumentCount(),
    });
  }
}
