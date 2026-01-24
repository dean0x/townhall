/**
 * GetCitationHandler - Retrieves a citation by ID (full or short)
 *
 * Handles both full SHA-256 hashes and short hashes (minimum 7 characters).
 * Uses repository to resolve short IDs to full IDs if needed.
 */

import { inject, injectable } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { GetCitationQuery } from '../queries/GetCitationQuery';
import { Citation } from '../../core/entities/Citation';
import { CitationId } from '../../core/value-objects/CitationId';
import { ICitationRepository } from '../../core/repositories/ICitationRepository';
import { IQueryHandler } from './QueryBus';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { Tokens } from '../../shared/tokens';

@injectable()
export class GetCitationHandler implements IQueryHandler<GetCitationQuery, Citation> {
  constructor(
    @inject(Tokens.CitationRepository.symbol) private readonly citationRepo: ICitationRepository
  ) {}

  public async handle(query: GetCitationQuery): Promise<Result<Citation, Error>> {
    const citationId = query.citationId;

    // Try as full ID first
    let fullId: CitationId;
    if (citationId.length === 64) {
      // Full SHA-256 hash
      fullId = CitationId.fromString(citationId);
    } else if (citationId.length >= 7) {
      // Short hash - needs resolution
      const resolveResult = await this.citationRepo.resolveShortId(citationId);
      if (resolveResult.isErr()) {
        return err(new NotFoundError('Citation', citationId));
      }
      fullId = resolveResult.value;
    } else {
      // ID too short - provide clear feedback
      return err(new ValidationError(
        `Citation ID '${citationId}' is too short. Short IDs require at least 7 characters.`
      ));
    }

    // Retrieve citation
    const citationResult = await this.citationRepo.findById(fullId);
    if (citationResult.isErr()) {
      return err(new NotFoundError('Citation', citationId));
    }

    return ok(citationResult.value);
  }
}
