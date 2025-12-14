/**
 * ARCHITECTURE: Application layer command handler for voting
 * Pattern: Command handler with repository and service injection
 * Rationale: Orchestrates vote submission with threshold checking
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError, ConflictError } from '../../shared/errors';
import { ICommandHandler } from './CommandBus';
import { VoteToCloseCommand } from '../commands/VoteToCloseCommand';
import { ISimulationRepository } from '../../core/repositories/ISimulationRepository';
import { IAgentRepository } from '../../core/repositories/IAgentRepository';
import { VoteCalculator } from '../../core/services/VoteCalculator';
import { DebateStatus } from '../../simulations/debate';
import { ITimestampService } from '../../core/services/ITimestampService';
import { Vote } from '../../core/value-objects/Vote';
import { TOKENS } from '../../shared/container';

export interface VoteToCloseResult {
  readonly voteAccepted: boolean;
  readonly totalVotes: number;
  readonly votesNeeded: number;
  readonly debateClosed: boolean;
  readonly reason?: string;
}

@injectable()
export class VoteToCloseHandler implements ICommandHandler<VoteToCloseCommand, VoteToCloseResult> {
  constructor(
    @inject(TOKENS.SimulationRepository) private readonly simulationRepo: ISimulationRepository,
    @inject(TOKENS.AgentRepository) private readonly agentRepo: IAgentRepository,
    @inject(TOKENS.VoteCalculator) private readonly voteCalculator: VoteCalculator,
    @inject(TOKENS.TimestampService) private readonly timestampService: ITimestampService
  ) {}

  public async handle(command: VoteToCloseCommand): Promise<Result<VoteToCloseResult, Error>> {
    // Get active simulation
    const activeResult = await this.simulationRepo.getActive();
    if (activeResult.isErr()) {
      return err(new ConflictError('No active debate to vote on'));
    }

    let simulation = activeResult.value;

    // Verify agent exists
    const agentResult = await this.agentRepo.findById(command.agentId);
    if (agentResult.isErr()) {
      return err(new NotFoundError('Agent', command.agentId));
    }

    // SECURITY: Authorization check - only active or voting debates can accept votes
    if (simulation.status !== DebateStatus.ACTIVE && simulation.status !== DebateStatus.VOTING) {
      return err(new ConflictError(
        `Cannot vote on ${simulation.status} debate. Debate must be active or in voting phase.`
      ));
    }

    // SECURITY: Validate vote using vote calculator (checks if agent is participant)
    const voteValidation = this.voteCalculator.validateVote(command.agentId, simulation);
    if (voteValidation.isErr()) {
      return err(new ConflictError(voteValidation.error.message));
    }

    // Create vote (unused but validates structure)
    Vote.create({
      agentId: command.agentId,
      ...(command.reason !== undefined && { reason: command.reason }),
    });

    // Add vote to simulation
    const timestamp = this.timestampService.now() as import('../../core/value-objects/Timestamp').Timestamp;
    simulation = simulation.recordCloseVote(command.agentId, command.vote, command.reason, timestamp);

    // Transition to voting if not already voting
    if (simulation.status === DebateStatus.ACTIVE) {
      simulation = simulation.transitionTo(DebateStatus.VOTING);
    }

    // Calculate if threshold is met
    const voteStatus = this.voteCalculator.calculateVoteStatus(simulation);

    // Update simulation status if threshold met
    if (voteStatus.canClose) {
      simulation = simulation.transitionTo(DebateStatus.CLOSED);

      // Clear active simulation
      const clearResult = await this.simulationRepo.clearActive();
      if (clearResult.isErr()) {
        return err(clearResult.error);
      }
    }

    // Save updated simulation
    const saveResult = await this.simulationRepo.save(simulation);
    if (saveResult.isErr()) {
      return err(saveResult.error);
    }

    const result: VoteToCloseResult = {
      voteAccepted: true,
      totalVotes: voteStatus.total,
      votesNeeded: voteStatus.required,
      debateClosed: voteStatus.canClose,
      ...(voteStatus.canClose && { reason: `Debate closed with consensus (${voteStatus.yesVotes}/${voteStatus.required} votes)` }),
    };

    return ok(result);
  }
}