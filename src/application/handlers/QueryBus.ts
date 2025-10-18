/**
 * ARCHITECTURE: Application layer query bus
 * Pattern: Mediator pattern for query routing
 * Rationale: Separates read operations from commands
 */

import { injectable } from 'tsyringe';
import { Result, err } from '../../shared/result';
import { InternalError } from '../../shared/errors';

export interface IQueryHandler<TQuery, TResult> {
  handle(query: TQuery): Promise<Result<TResult, Error>>;
}

export interface IQueryBus {
  execute<TQuery, TResult>(query: TQuery, queryName?: string): Promise<Result<TResult, Error>>;
}

@injectable()
export class QueryBus implements IQueryBus {
  private readonly handlers = new Map<string, IQueryHandler<any, any>>();

  public register<TQuery, TResult>(
    queryName: string,
    handler: IQueryHandler<TQuery, TResult>
  ): void {
    this.handlers.set(queryName, handler);
  }

  public async execute<TQuery, TResult>(query: TQuery, queryName?: string): Promise<Result<TResult, Error>> {
    const name = queryName || (query as any).constructor?.name || 'UnknownQuery';
    const handler = this.handlers.get(name);

    if (!handler) {
      return err(new InternalError(`No handler registered for query: ${name}`));
    }

    try {
      return await handler.handle(query);
    } catch (error) {
      return err(new InternalError(
        `Query handler failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }
}