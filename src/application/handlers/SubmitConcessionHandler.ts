/**
 * ARCHITECTURE: Application layer command handler for concessions
 * Pattern: Command handler with repository injection
 * Rationale: Orchestrates concession submission
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError, ConflictError } from '../../shared/errors';
import { ICommandHandler } from './CommandBus';
import { SubmitConcessionCommand } from '../commands/SubmitConcessionCommand';
import { IArgumentRepository } from '../../core/repositories/IArgumentRepository';
import { ISimulationRepository } from '../../core/repositories/ISimulationRepository';
import { IAgentRepository } from '../../core/repositories/IAgentRepository';
import { Concession } from '../../core/entities/Concession';
import { ArgumentId } from '../../core/value-objects/ArgumentId';
import { TOKENS } from '../../shared/container';

export interface SubmitConcessionResult {
  readonly concessionId: ArgumentId;
  readonly targetId: ArgumentId;
  readonly reason: string;
  readonly createdAt: string;
}

@injectable()
export class SubmitConcessionHandler implements ICommandHandler<SubmitConcessionCommand, SubmitConcessionResult> {
  constructor(
    @inject(TOKENS.ArgumentRepository) private readonly argumentRepo: IArgumentRepository,
    @inject(TOKENS.SimulationRepository) private readonly simulationRepo: ISimulationRepository,
    @inject(TOKENS.AgentRepository) private readonly agentRepo: IAgentRepository
  ) {}

  public async handle(command: SubmitConcessionCommand): Promise<Result<SubmitConcessionResult, Error>> {
    // Get active simulation
    const activeResult = await this.simulationRepo.getActive();
    if (activeResult.isErr()) {
      return err(new ConflictError('No active debate to submit concession to'));
    }

    const simulation = activeResult.value;

    // Verify target argument exists
    const targetResult = await this.argumentRepo.findById(command.targetArgumentId);
    if (targetResult.isErr()) {
      return err(new NotFoundError('Target argument', command.targetArgumentId));
    }

    // Verify agent exists
    const agentResult = await this.agentRepo.findById(command.agentId);
    if (agentResult.isErr()) {
      return err(new NotFoundError('Agent', command.agentId));
    }

    // Create concession
    const concession = Concession.create({
      agentId: command.agentId,
      simulationId: simulation.id,
      targetArgumentId: command.targetArgumentId,
      reason: command.reason,
      acknowledgement: command.acknowledgement,
    });

    // Save concession
    const saveResult = await this.argumentRepo.save(concession);
    if (saveResult.isErr()) {
      return saveResult;
    }

    // Add to simulation
    simulation.addArgument(concession.id);
    const updateResult = await this.simulationRepo.save(simulation);
    if (updateResult.isErr()) {
      return updateResult;
    }

    return ok({
      concessionId: concession.id,
      targetId: command.targetArgumentId,
      reason: command.reason,
      createdAt: concession.createdAt,
    });
  }
}