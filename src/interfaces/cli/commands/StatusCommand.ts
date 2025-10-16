/**
 * ARCHITECTURE: Interface layer - Status command
 * Pattern: Simple read command with repository injection
 * Rationale: Shows current simulation context (Git-like status)
 */

import { Command } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ISimulationRepository } from '../../../core/repositories/ISimulationRepository';

export class StatusCommand extends BaseCommand {
  constructor(
    private readonly simulationRepo: ISimulationRepository,
    context: CommandContext
  ) {
    super('status', 'Show current simulation context', context);
  }

  protected setupOptions(command: Command): void {
    // No options needed for status command
  }

  protected validateOptions(_options: any): Result<void, ValidationError> {
    // No validation needed
    return ok(undefined);
  }

  protected async execute(_validatedOptions: void): Promise<Result<void, DomainError>> {
    this.context.logger.info('Retrieving simulation status');

    // Get active simulation
    const activeResult = await this.simulationRepo.getActive();

    if (activeResult.isErr()) {
      console.log('No simulation checked out.');
      console.log('');
      console.log('To start a new simulation:');
      console.log('  townhall simulate debate <topic>');
      console.log('');
      console.log('To checkout an existing simulation:');
      console.log('  townhall list');
      console.log('  townhall checkout <simulation-id>');
      return ok(undefined);
    }

    const simulation = activeResult.value;

    // Display current simulation status
    console.log('Current simulation:');
    console.log('');
    this.displaySuccess('Checked out', {
      'Simulation ID': simulation.id,
      'Topic': simulation.topic,
      'Status': simulation.status,
      'Participants': simulation.participantIds.length,
      'Arguments': simulation.getArgumentCount(),
      'Created': new Date(simulation.createdAt).toLocaleString(),
    });

    this.context.logger.info('Status retrieved successfully', {
      simulationId: simulation.id,
    });

    return ok(undefined);
  }
}
