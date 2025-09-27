/**
 * ARCHITECTURE: Application layer command handler for argument creation
 * Pattern: Complex handler with multiple repository interactions
 * Rationale: Orchestrates argument creation with validation and relationships
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { ValidationError, NotFoundError } from '../../shared/errors';
import { ICommandHandler } from './CommandBus';
import { CreateArgumentCommand } from '../commands/CreateArgumentCommand';
import { ISimulationRepository } from '../../core/repositories/ISimulationRepository';
import { IArgumentRepository } from '../../core/repositories/IArgumentRepository';
import { IAgentRepository } from '../../core/repositories/IAgentRepository';
import { ArgumentValidator } from '../../core/services/ArgumentValidator';
import { Argument } from '../../core/entities/Argument';
import { TimestampGenerator } from '../../core/value-objects/Timestamp';
import { ArgumentId } from '../../core/value-objects/ArgumentId';
import { TOKENS } from '../../shared/container';

export interface CreateArgumentResult {
  readonly argumentId: ArgumentId;
  readonly shortHash: string;
  readonly sequenceNumber: number;
  readonly timestamp: string;
}

@injectable()
export class CreateArgumentHandler implements ICommandHandler<CreateArgumentCommand, CreateArgumentResult> {
  constructor(
    @inject(TOKENS.SimulationRepository) private readonly simulationRepo: ISimulationRepository,
    @inject(TOKENS.ArgumentRepository) private readonly argumentRepo: IArgumentRepository,
    @inject(TOKENS.AgentRepository) private readonly agentRepo: IAgentRepository,
    @inject(TOKENS.ArgumentValidator) private readonly validator: ArgumentValidator
  ) {}

  public async handle(command: CreateArgumentCommand): Promise<Result<CreateArgumentResult, Error>> {
    // Get active simulation
    const activeSimulationResult = await this.simulationRepo.getActive();
    if (activeSimulationResult.isErr()) {
      return err(new ValidationError('No active debate found. Start a debate first.'));
    }

    const simulation = activeSimulationResult.value;

    // Validate agent exists
    const agentResult = await this.agentRepo.findById(command.agentId);
    if (agentResult.isErr()) {
      return err(new NotFoundError('Agent', command.agentId));
    }

    // Validate argument structure
    const structureValidationResult = this.validateArgumentStructure(command);
    if (structureValidationResult.isErr()) {
      return err(structureValidationResult.error);
    }

    // Create argument
    const timestamp = TimestampGenerator.now();
    const sequenceNumber = simulation.getArgumentCount() + 1;

    const argument = Argument.create({
      agentId: command.agentId,
      type: command.type,
      content: command.content,
      simulationId: simulation.id,
      timestamp,
      sequenceNumber,
    });

    // Save argument
    const saveResult = await this.argumentRepo.save(argument);
    if (saveResult.isErr()) {
      return err(saveResult.error);
    }

    // Update simulation with new argument and participant
    const updatedSimulation = simulation
      .addParticipant(command.agentId)
      .addArgument(argument.id);

    const updateResult = await this.simulationRepo.save(updatedSimulation);
    if (updateResult.isErr()) {
      return err(updateResult.error);
    }

    return ok({
      argumentId: argument.id,
      shortHash: argument.metadata.shortHash,
      sequenceNumber: argument.metadata.sequenceNumber,
      timestamp: argument.timestamp,
    });
  }

  private validateArgumentStructure(command: CreateArgumentCommand): Result<void, ValidationError> {
    // Validate text content
    const textValidation = this.validator.validateTextLength(command.content.text);
    if (textValidation.isErr()) {
      return textValidation;
    }

    // Validate structure based on type
    switch (command.type) {
      case 'deductive':
        return this.validator.validateDeductive(command.content.structure as any);
      case 'inductive':
        return this.validator.validateInductive(command.content.structure as any);
      case 'empirical':
        return this.validator.validateEmpirical(command.content.structure as any);
      default:
        return err(new ValidationError(`Invalid argument type: ${command.type}`));
    }
  }
}