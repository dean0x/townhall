/**
 * ARCHITECTURE: Application layer command handler for rebuttals
 * Pattern: Command handler with repository and service injection
 * Rationale: Orchestrates rebuttal creation with validation
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors';
import { ICommandHandler } from './CommandBus';
import { SubmitRebuttalCommand } from '../commands/SubmitRebuttalCommand';
import { IArgumentRepository } from '../../core/repositories/IArgumentRepository';
import { ISimulationRepository } from '../../core/repositories/ISimulationRepository';
import { IAgentRepository } from '../../core/repositories/IAgentRepository';
import { ArgumentValidator } from '../../core/services/ArgumentValidator';
import { RelationshipBuilder } from '../../core/services/RelationshipBuilder';
import { Rebuttal } from '../../core/entities/Rebuttal';
import { ArgumentId } from '../../core/value-objects/ArgumentId';
import { TimestampGenerator } from '../../core/value-objects/Timestamp';
import { TOKENS } from '../../shared/container';

export interface SubmitRebuttalResult {
  readonly argumentId: string;
  readonly shortHash: string;
  readonly targetId: ArgumentId;
  readonly rebuttalType: string;
  readonly timestamp: string;
}

@injectable()
export class SubmitRebuttalHandler implements ICommandHandler<SubmitRebuttalCommand, SubmitRebuttalResult> {
  constructor(
    @inject(TOKENS.ArgumentRepository) private readonly argumentRepo: IArgumentRepository,
    @inject(TOKENS.SimulationRepository) private readonly simulationRepo: ISimulationRepository,
    @inject(TOKENS.AgentRepository) private readonly agentRepo: IAgentRepository,
    @inject(TOKENS.ArgumentValidator) private readonly validator: ArgumentValidator,
    @inject(TOKENS.RelationshipBuilder) private readonly relationshipBuilder: RelationshipBuilder
  ) {}

  public async handle(command: SubmitRebuttalCommand): Promise<Result<SubmitRebuttalResult, Error>> {
    // Get active simulation
    const activeResult = await this.simulationRepo.getActive();
    if (activeResult.isErr()) {
      return err(new ConflictError('No active debate to submit rebuttal to'));
    }

    const simulation = activeResult.value;

    // Verify target argument exists
    const targetResult = await this.argumentRepo.findById(command.targetArgumentId);
    if (targetResult.isErr()) {
      return err(new NotFoundError('Target argument', command.targetArgumentId));
    }

    const targetArgument = targetResult.value;

    // Verify agent exists
    const agentResult = await this.agentRepo.findById(command.agentId);
    if (agentResult.isErr()) {
      return err(new NotFoundError('Agent', command.agentId));
    }

    // Get sequence number for rebuttal (rebuttals are arguments too)
    const sequenceNumber = simulation.getArgumentCount() + 1;

    // Create rebuttal
    const rebuttal = Rebuttal.create({
      agentId: command.agentId,
      type: command.type,
      content: command.content,
      simulationId: simulation.id,
      timestamp: TimestampGenerator.now(),
      targetArgumentId: command.targetArgumentId,
      rebuttalType: command.rebuttalType,
      sequenceNumber,
    });

    // Validate rebuttal argument structure based on its type
    let validationResult: Result<void, ValidationError>;

    switch (command.type) {
      case 'deductive':
        validationResult = this.validator.validateDeductive(command.content.structure as any);
        break;
      case 'inductive':
        validationResult = this.validator.validateInductive(command.content.structure as any);
        break;
      case 'empirical':
        validationResult = this.validator.validateEmpirical(command.content.structure as any);
        break;
      default:
        return err(new ValidationError(`Invalid argument type: ${command.type}`));
    }

    if (validationResult.isErr()) {
      return err(validationResult.error);
    }

    // Build relationships
    const relationshipResult = this.relationshipBuilder.createRebuttalRelationship(rebuttal, targetArgument);
    if (relationshipResult.isErr()) {
      return err(relationshipResult.error);
    }

    // Save rebuttal
    const saveResult = await this.argumentRepo.save(rebuttal);
    if (saveResult.isErr()) {
      return saveResult;
    }

    // Add to simulation
    simulation.addArgument(rebuttal.id);
    const updateResult = await this.simulationRepo.save(simulation);
    if (updateResult.isErr()) {
      return updateResult;
    }

    return ok({
      argumentId: rebuttal.id,
      shortHash: rebuttal.metadata.shortHash,
      targetId: command.targetArgumentId,
      rebuttalType: command.rebuttalType,
      timestamp: rebuttal.timestamp,
    });
  }
}