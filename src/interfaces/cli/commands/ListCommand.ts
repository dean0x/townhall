/**
 * ARCHITECTURE: Interface layer - List command
 * Pattern: Simple read command with repository injection
 * Rationale: Lists all simulations (Git-like branch listing)
 */

import { Command } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ISimulationRepository } from '../../../core/repositories/ISimulationRepository';

export class ListCommand extends BaseCommand {
  constructor(
    private readonly simulationRepo: ISimulationRepository,
    context: CommandContext
  ) {
    super('list', 'List all simulations', context);
  }

  protected setupOptions(command: Command): void {
    // No options needed for basic list command
  }

  protected validateOptions(_options: any): Result<void, ValidationError> {
    // No validation needed
    return ok(undefined);
  }

  protected async execute(_validatedOptions: void): Promise<Result<void, DomainError>> {
    this.context.logger.info('Listing all simulations');

    // Get active simulation ID (if any)
    const activeResult = await this.simulationRepo.getActive();
    const activeId = activeResult.isOk() ? activeResult.value.id : null;

    // Get all simulations
    const listResult = await this.simulationRepo.listAll();
    if (listResult.isErr()) {
      return listResult;
    }

    const simulations = listResult.value;

    if (simulations.length === 0) {
      console.log('No simulations found.');
      console.log('');
      console.log('To start a new simulation:');
      console.log('  townhall simulate debate <topic>');
      return ok(undefined);
    }

    // Display simulations
    console.log('Simulations:');
    console.log('');

    // Sort by creation date (newest first)
    const sorted = [...simulations].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    for (const sim of sorted) {
      const isActive = activeId === sim.id;
      const marker = isActive ? '* ' : '  ';
      const statusEmoji = sim.status === 'active' ? '🟢' : sim.status === 'closed' ? '🔴' : '⚪';

      console.log(`${marker}${statusEmoji} ${sim.id}`);
      console.log(`   Topic: ${sim.topic}`);
      console.log(`   Status: ${sim.status} | Arguments: ${sim.getArgumentCount()} | Participants: ${sim.participantIds.length}`);
      console.log(`   Created: ${new Date(sim.createdAt).toLocaleString()}`);
      console.log('');
    }

    if (activeId) {
      console.log('* = checked out');
      console.log('');
    }

    this.context.logger.info('Simulations listed successfully', {
      count: simulations.length,
      activeId,
    });

    return ok(undefined);
  }
}
