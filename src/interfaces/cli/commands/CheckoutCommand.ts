/**
 * ARCHITECTURE: Interface layer - Checkout command
 * Pattern: Command adapter with Result-based error handling
 * Rationale: Switches active simulation context (Git-like checkout)
 */

import { Command } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { CheckoutSimulationCommand } from '../../../application/commands/CheckoutSimulationCommand';
import { SimulationId } from '../../../core/value-objects/SimulationId';

interface CheckoutOptions {
  simulationId: string;
}

interface ValidatedCheckoutOptions {
  simulationId: SimulationId;
}

export class CheckoutCommand extends BaseCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    context: CommandContext
  ) {
    super('checkout', 'Switch to a different simulation', context);
  }

  protected setupOptions(command: Command): void {
    command
      .argument('<simulation-id>', 'Simulation ID to switch to');
  }

  protected validateOptions(rawOptions: any): Result<ValidatedCheckoutOptions, ValidationError> {
    // When using argument('<simulation-id>'), Commander passes it as args[0]
    // BaseCommand extracts it as the first parameter
    const simulationId = typeof rawOptions === 'string' ? rawOptions : (rawOptions as any)?.simulationId;

    // Validate simulation ID format
    if (!simulationId || typeof simulationId !== 'string' || simulationId.trim().length === 0) {
      return err(new ValidationError(
        'Simulation ID is required',
        'simulationId'
      ));
    }

    // SimulationId is just a string type alias, so we can use it directly after trimming
    const trimmedId = simulationId.trim() as SimulationId;

    return ok({
      simulationId: trimmedId,
    });
  }

  protected async execute(validatedOptions: ValidatedCheckoutOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Checking out simulation', {
      simulationId: validatedOptions.simulationId,
    });

    const command: CheckoutSimulationCommand = {
      simulationId: validatedOptions.simulationId,
    };

    const result = await this.commandBus.execute(command, 'CheckoutSimulationCommand');

    if (result.isErr()) {
      return err(result.error);
    }

    const checkoutResult = result.value;

    // Display checkout results
    this.displaySuccess(`Switched to simulation '${checkoutResult.simulationId}'`, {
      'Topic': checkoutResult.topic,
      'Status': checkoutResult.status,
      'Arguments': checkoutResult.argumentCount,
    });

    this.context.logger.info('Checkout completed successfully', {
      simulationId: checkoutResult.simulationId,
      topic: checkoutResult.topic,
    });

    return ok(undefined);
  }
}
