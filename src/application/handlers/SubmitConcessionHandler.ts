/**
 * ARCHITECTURE: Application layer command handler for concessions
 * Pattern: Command handler with repository injection
 * Rationale: Orchestrates concession submission
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors';
import { ArgumentType, Concession, ArgumentId } from '../../simulations/debate';
import { ICommandHandler } from './CommandBus';
import { SubmitConcessionCommand } from '../commands/SubmitConcessionCommand';
import type { IArgumentRepository, IDebateRepository } from '../../simulations/debate/repositories';
import { IAgentRepository } from '../../core/repositories/IAgentRepository';
import { TimestampGenerator } from '../../core/value-objects/Timestamp';
import { ICryptoService } from '../../core/services/ICryptoService';
import { Tokens } from '../../shared/tokens';
import { DebateTokens } from '../../simulations/debate/tokens';

export interface SubmitConcessionResult {
  readonly concessionId: ArgumentId;
  readonly targetId: ArgumentId;
  readonly reason: string;
  readonly createdAt: string;
}

@injectable()
export class SubmitConcessionHandler implements ICommandHandler<SubmitConcessionCommand, SubmitConcessionResult> {
  constructor(
    @inject(DebateTokens.ArgumentRepository.symbol) private readonly argumentRepo: IArgumentRepository,
    @inject(DebateTokens.SimulationRepository.symbol) private readonly simulationRepo: IDebateRepository,
    @inject(Tokens.AgentRepository.symbol) private readonly agentRepo: IAgentRepository,
    @inject(Tokens.CryptoService.symbol) private readonly cryptoService: ICryptoService
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

    const targetArgument = targetResult.value;

    // Verify agent exists
    const agentResult = await this.agentRepo.findById(command.agentId);
    if (agentResult.isErr()) {
      return err(new NotFoundError('Agent', command.agentId));
    }

    // SECURITY: Authorization check - verify agent can participate
    if (simulation.status !== 'active') {
      return err(new ValidationError(
        `Cannot submit concession to ${simulation.status} debate. Debate must be active.`
      ));
    }

    // SECURITY: Business rule - cannot concede to your own argument
    if (targetArgument.agentId === command.agentId) {
      return err(new ValidationError(
        'Cannot concede to your own argument. Concessions must target arguments from other agents.'
      ));
    }

    // Get sequence number for concession (concessions are arguments too)
    const sequenceNumber = simulation.getArgumentCount() + 1;

    // Create concession
    const concessionResult = Concession.create({
      agentId: command.agentId,
      type: ArgumentType.DEDUCTIVE, // Default type for concessions
      content: {
        text: command.explanation || `Concession (${command.concessionType})`,
        structure: {
          premises: [
            'I acknowledge the validity of the target argument',
            'The evidence presented is compelling'
          ],
          conclusion: `Therefore, I ${command.concessionType}ly concede to this argument`,
        },
      },
      simulationId: simulation.id,
      timestamp: TimestampGenerator.now(),
      targetArgumentId: command.targetArgumentId,
      concessionType: command.concessionType,
      ...(command.explanation !== undefined && { explanation: command.explanation }),
      ...(command.conditions !== undefined && { conditions: command.conditions }),
      sequenceNumber,
    }, this.cryptoService);

    if (concessionResult.isErr()) {
      return err(concessionResult.error);
    }

    const concession = concessionResult.value;

    // Save concession
    const saveResult = await this.argumentRepo.save(concession);
    if (saveResult.isErr()) {
      return err(saveResult.error);
    }

    // Add to simulation (pass true to indicate this is a concession)
    const updatedSimulation = simulation.addArgument(concession.id, true);
    const updateResult = await this.simulationRepo.save(updatedSimulation);
    if (updateResult.isErr()) {
      return err(updateResult.error);
    }

    return ok({
      concessionId: concession.id,
      targetId: command.targetArgumentId,
      reason: command.concessionType,
      createdAt: concession.timestamp,
    });
  }
}