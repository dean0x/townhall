/**
 * ARCHITECTURE: Application layer query handler
 * Pattern: Query handler with repository injection
 * Rationale: Retrieves single argument with optional relationships
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError } from '../../shared/errors';
import { IQueryHandler } from './QueryBus';
import { GetArgumentQuery } from '../queries/GetArgumentQuery';
import { IArgumentRepository } from '../../core/repositories/IArgumentRepository';
import { Argument } from '../../core/entities/Argument';
import { ArgumentId } from '../../core/value-objects/ArgumentId';
import { TOKENS } from '../../shared/container';

export interface GetArgumentResult {
  readonly argument: Argument;
  readonly relationships?: {
    readonly rebuttals: ArgumentId[];
    readonly concessions: ArgumentId[];
    readonly supports: ArgumentId[];
  };
}

@injectable()
export class GetArgumentHandler implements IQueryHandler<GetArgumentQuery, GetArgumentResult> {
  constructor(
    @inject(TOKENS.ArgumentRepository) private readonly argumentRepo: IArgumentRepository
  ) {}

  public async handle(query: GetArgumentQuery): Promise<Result<GetArgumentResult, NotFoundError>> {
    // LIMITATION: Currently only supports full hash lookup
    // TODO(future): Implement short hash resolution via repository.findByShortHash()
    // For now, treat string input as full hash - short hashes will return NotFoundError
    let argumentId: ArgumentId;
    if (typeof query.argumentId === 'string') {
      argumentId = query.argumentId as ArgumentId;
    } else {
      argumentId = query.argumentId;
    }

    // Retrieve argument
    const argumentResult = await this.argumentRepo.findById(argumentId);
    if (argumentResult.isErr()) {
      return err(new NotFoundError('Argument', argumentId));
    }

    const argument = argumentResult.value;

    // Build result
    const result: GetArgumentResult = {
      argument,
    };

    // Add relationships if requested
    if (query.includeRelationships) {
      const relationshipsResult = await this.argumentRepo.findRelationships(argumentId);
      if (relationshipsResult.isOk()) {
        result.relationships = relationshipsResult.value;
      }
    }

    return ok(result);
  }
}