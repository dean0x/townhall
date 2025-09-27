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
import { IArgumentValidator } from '../../core/services/ArgumentValidator';
import { IRelationshipBuilder } from '../../core/services/RelationshipBuilder';
import { Rebuttal } from '../../core/entities/Rebuttal';
import { ArgumentId } from '../../core/value-objects/ArgumentId';
import { TOKENS } from '../../shared/container';

export interface SubmitRebuttalResult {
  readonly rebuttalId: ArgumentId;
  readonly targetId: ArgumentId;
  readonly rebuttalType: string;
  readonly createdAt: string;
}

@injectable()
export class SubmitRebuttalHandler implements ICommandHandler<SubmitRebuttalCommand, SubmitRebuttalResult> {
  constructor(
    @inject(TOKENS.ArgumentRepository) private readonly argumentRepo: IArgumentRepository,
    @inject(TOKENS.SimulationRepository) private readonly simulationRepo: ISimulationRepository,
    @inject(TOKENS.AgentRepository) private readonly agentRepo: IAgentRepository,
    @inject(TOKENS.ArgumentValidator) private readonly validator: IArgumentValidator,
    @inject(TOKENS.RelationshipBuilder) private readonly relationshipBuilder: IRelationshipBuilder
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

    // Create rebuttal
    const rebuttal = Rebuttal.create({
      agentId: command.agentId,
      simulationId: simulation.id,
      targetArgumentId: command.targetArgumentId,
      rebuttalType: command.rebuttalType,
      content: command.content,
    });

    // Validate rebuttal structure
    const validationResult = this.validator.validate(rebuttal);
    if (validationResult.isErr()) {
      return validationResult;
    }

    // Build relationships
    const relationshipResult = await this.relationshipBuilder.buildForRebuttal(rebuttal, targetArgument);
    if (relationshipResult.isErr()) {
      return relationshipResult;
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
      rebuttalId: rebuttal.id,
      targetId: command.targetArgumentId,
      rebuttalType: command.rebuttalType,
      createdAt: rebuttal.createdAt,
    });
  }
}