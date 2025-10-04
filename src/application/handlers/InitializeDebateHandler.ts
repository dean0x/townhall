/**
 * ARCHITECTURE: Application layer command handler
 * Pattern: Command handler with repository injection
 * Rationale: Orchestrates domain entities and repository operations
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { ValidationError, ConflictError } from '../../shared/errors';
import { ICommandHandler } from './CommandBus';
import { InitializeDebateCommand } from '../commands/InitializeDebateCommand';
import { ISimulationRepository } from '../../core/repositories/ISimulationRepository';
import { DebateSimulation } from '../../core/entities/DebateSimulation';
import { TimestampGenerator } from '../../core/value-objects/Timestamp';
import { SimulationId } from '../../core/value-objects/SimulationId';
import { TOKENS } from '../../shared/container';

export interface InitializeDebateResult {
  readonly simulationId: SimulationId;
  readonly topic: string;
  readonly status: string;
  readonly createdAt: string;
}

@injectable()
export class InitializeDebateHandler implements ICommandHandler<InitializeDebateCommand, InitializeDebateResult> {
  constructor(
    @inject(TOKENS.SimulationRepository) private readonly simulationRepo: ISimulationRepository
  ) {}

  public async handle(command: InitializeDebateCommand): Promise<Result<InitializeDebateResult, Error>> {
    // Validate command
    const validationResult = this.validateCommand(command);
    if (validationResult.isErr()) {
      return validationResult;
    }

    // Check if there's already an active debate (single active constraint)
    const hasActiveResult = await this.simulationRepo.hasActive();
    if (hasActiveResult.isErr()) {
      return hasActiveResult;
    }

    if (hasActiveResult.value) {
      return err(new ConflictError('Cannot start new debate: another debate is already active'));
    }

    // Create new simulation
    const timestamp = TimestampGenerator.now();
    const simulationResult = DebateSimulation.create({
      topic: command.topic,
      createdAt: timestamp,
    });

    if (simulationResult.isErr()) {
      return err(simulationResult.error);
    }

    const simulation = simulationResult.value;

    // Save simulation
    const saveResult = await this.simulationRepo.save(simulation);
    if (saveResult.isErr()) {
      return saveResult;
    }

    // Set as active
    const setActiveResult = await this.simulationRepo.setActive(simulation.id);
    if (setActiveResult.isErr()) {
      return setActiveResult;
    }

    return ok({
      simulationId: simulation.id,
      topic: simulation.topic,
      status: simulation.status,
      createdAt: simulation.createdAt,
    });
  }

  private validateCommand(command: InitializeDebateCommand): Result<void, ValidationError> {
    if (!command.topic || command.topic.trim().length === 0) {
      return err(new ValidationError('Topic is required'));
    }

    if (command.topic.length > 500) {
      return err(new ValidationError('Topic cannot exceed 500 characters'));
    }

    return ok(undefined);
  }
}