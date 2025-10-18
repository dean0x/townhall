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
import { ICryptoService } from '../../core/services/ICryptoService';
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
    @inject(TOKENS.SimulationRepository) private readonly simulationRepo: ISimulationRepository,
    @inject(TOKENS.CryptoService) private readonly cryptoService: ICryptoService
  ) {}

  public async handle(command: InitializeDebateCommand): Promise<Result<InitializeDebateResult, Error>> {
    // Validate command
    const validationResult = this.validateCommand(command);
    if (validationResult.isErr()) {
      return validationResult;
    }

    // Create new simulation
    const timestamp = TimestampGenerator.now();
    const simulationResult = DebateSimulation.create({
      topic: command.topic,
      createdAt: timestamp,
      cryptoService: this.cryptoService,
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

    // Auto-checkout the new simulation (overwrites any existing active simulation)
    const switchActiveResult = await this.simulationRepo.switchActive(simulation.id);
    if (switchActiveResult.isErr()) {
      return switchActiveResult;
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