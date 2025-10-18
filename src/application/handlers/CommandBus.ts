/**
 * ARCHITECTURE: Application layer command bus
 * Pattern: Mediator pattern for command routing
 * Rationale: Decouples command dispatching from handling
 */

import { injectable } from 'tsyringe';
import { Result, err } from '../../shared/result';
import { InternalError } from '../../shared/errors';

export interface ICommandHandler<TCommand, TResult> {
  handle(command: TCommand): Promise<Result<TResult, Error>>;
}

export interface ICommandBus {
  execute<TCommand, TResult>(command: TCommand): Promise<Result<TResult, Error>>;
}

@injectable()
export class CommandBus implements ICommandBus {
  private readonly handlers = new Map<string, ICommandHandler<any, any>>();

  public register<TCommand, TResult>(
    commandName: string,
    handler: ICommandHandler<TCommand, TResult>
  ): void {
    this.handlers.set(commandName, handler);
  }

  public async execute<TCommand, TResult>(command: TCommand, commandName?: string): Promise<Result<TResult, Error>> {
    const name = commandName || (command as any).constructor?.name || 'UnknownCommand';
    const handler = this.handlers.get(name);

    if (!handler) {
      return err(new InternalError(`No handler registered for command: ${name}`));
    }

    try {
      return await handler.handle(command);
    } catch (error) {
      return err(new InternalError(
        `Command handler failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }
}